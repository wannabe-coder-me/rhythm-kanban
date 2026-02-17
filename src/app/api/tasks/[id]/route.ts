import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/mobile-auth";

import { prisma } from "@/lib/prisma";
import { notifyAssigned } from "@/lib/notifications";
import { emitBoardEvent } from "@/lib/events";
import { createAndEmitActivity } from "@/lib/activity";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const task = await prisma.task.findFirst({
    where: {
      id,
      column: {
        board: { members: { some: { userId: user.id } } },
      },
    },
    include: {
      assignee: true,
      createdBy: true,
      labels: true,
      comments: {
        include: { user: true },
        orderBy: { createdAt: "desc" },
      },
      activities: {
        include: { user: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      column: true,
      subtasks: {
        include: { assignee: true, labels: true },
        orderBy: { position: "asc" },
      },
      attachments: {
        include: { uploadedBy: true },
        orderBy: { createdAt: "desc" },
      },
      blockedBy: {
        include: {
          blockedBy: {
            select: {
              id: true,
              title: true,
              completed: true,
              columnId: true,
              column: { select: { name: true } },
            },
          },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      },
      blocking: {
        include: {
          task: {
            select: {
              id: true,
              title: true,
              completed: true,
              columnId: true,
              column: { select: { name: true } },
            },
          },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      },
      customFieldValues: {
        include: {
          customField: true,
        },
      },
    },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json(task);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { title, description, priority, startDate, dueDate, labelIds, assigneeId, columnId, position, completed, isRecurring, recurrenceRule, customFields } = body;

  const task = await prisma.task.findFirst({
    where: { id },
    include: {
      column: { include: { board: { select: { id: true, ownerId: true, members: true } } } },
    },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const isOwner = task.column.board.ownerId === user.id;
  const isMember = task.column.board.members.some((m) => m.userId === user.id);
  if (!isOwner && !isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const activities: { action: string; details: Record<string, unknown> }[] = [];

  // Track changes for activity log
  if (columnId && columnId !== task.columnId) {
    const newColumn = await prisma.column.findUnique({ where: { id: columnId } });
    activities.push({
      action: "moved",
      details: { from: task.column.name, to: newColumn?.name } as Record<string, unknown>,
    });
  }

  if (assigneeId !== undefined && assigneeId !== task.assigneeId) {
    const newAssignee = assigneeId
      ? await prisma.user.findUnique({ where: { id: assigneeId } })
      : null;
    activities.push({
      action: "assigned",
      details: { assignee: newAssignee?.name || "Unassigned" } as Record<string, unknown>,
    });

    // Send notification to the new assignee (if not self-assigning)
    if (assigneeId && assigneeId !== user.id) {
      const currentUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { name: true },
      });
      await notifyAssigned(
        assigneeId,
        task.title,
        task.id,
        task.column.board.id,
        currentUser?.name || "Someone"
      );
    }
  }

  // Handle position/column changes
  if (columnId !== undefined || position !== undefined) {
    const targetColumnId = columnId || task.columnId;
    const targetPosition = position ?? 0;

    // Get all tasks in target column
    const columnTasks = await prisma.task.findMany({
      where: { columnId: targetColumnId, id: { not: id } },
      orderBy: { position: "asc" },
    });

    // Insert at new position
    const reordered = [...columnTasks];
    reordered.splice(targetPosition, 0, { id } as typeof task);

    // Update positions
    await prisma.$transaction(
      reordered.map((t, idx) =>
        prisma.task.update({
          where: { id: t.id },
          data: { position: idx, ...(t.id === id ? { columnId: targetColumnId } : {}) },
        })
      )
    );
  }

  const updated = await prisma.task.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(priority && { priority }),
      ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      ...(labelIds !== undefined && {
        labels: {
          set: labelIds.map((labelId: string) => ({ id: labelId })),
        },
      }),
      ...(assigneeId !== undefined && { assigneeId: assigneeId || null }),
      ...(completed !== undefined && { completed }),
      ...(isRecurring !== undefined && { isRecurring }),
      ...(recurrenceRule !== undefined && { recurrenceRule }),
    },
    include: {
      assignee: true,
      createdBy: true,
      labels: true,
      column: true,
      subtasks: {
        include: { assignee: true, labels: true },
        orderBy: { position: "asc" },
      },
      customFieldValues: {
        include: { customField: true },
      },
    },
  });

  // Create activities and emit to subscribers
  for (const activity of activities) {
    await createAndEmitActivity(id, user.id, activity.action, activity.details);
  }

  // Track completion activity
  if (completed !== undefined && completed !== task.completed) {
    await createAndEmitActivity(
      id,
      user.id,
      completed ? "completed" : "reopened",
      { title: task.title }
    );
  }

  // Auto-archive when moved to Done column or marked complete
  const targetColumn = columnId 
    ? await prisma.column.findUnique({ where: { id: columnId } })
    : updated.column;
  const isDoneColumn = targetColumn?.name?.toLowerCase().includes('done') || 
                       targetColumn?.name?.toLowerCase().includes('complete') ||
                       targetColumn?.name?.toLowerCase().includes('finished');
  const shouldArchive = (isDoneColumn || completed === true) && !task.archived;
  const shouldUnarchive = completed === false && task.archived;

  if (shouldArchive || shouldUnarchive) {
    await prisma.task.update({
      where: { id },
      data: {
        archived: shouldArchive,
        archivedAt: shouldArchive ? new Date() : null,
      },
    });
  }

  // Handle custom field values
  if (customFields && typeof customFields === "object") {
    for (const [fieldId, value] of Object.entries(customFields)) {
      // Verify field belongs to this board
      const field = await prisma.customField.findFirst({
        where: { id: fieldId, boardId: task.column.board.id },
      });

      if (field) {
        // Upsert the value
        await prisma.customFieldValue.upsert({
          where: {
            taskId_customFieldId: { taskId: id, customFieldId: fieldId },
          },
          update: {
            value: value === null || value === undefined ? null : String(value),
          },
          create: {
            taskId: id,
            customFieldId: fieldId,
            value: value === null || value === undefined ? null : String(value),
          },
        });
      }
    }
  }

  // Emit real-time event
  const boardId = task.column.board.id;
  if (columnId && columnId !== task.columnId) {
    // Task was moved to a different column
    emitBoardEvent(boardId, {
      type: "task:moved",
      taskId: id,
      columnId,
      position: position ?? 0,
      userId: user.id,
    });
  }
  emitBoardEvent(boardId, {
    type: "task:updated",
    task: updated,
    userId: user.id,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const task = await prisma.task.findFirst({
    where: { id },
    include: {
      column: { include: { board: { select: { id: true, ownerId: true, members: true } } } },
    },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const isOwner = task.column.board.ownerId === user.id;
  const isMember = task.column.board.members.some((m) => m.userId === user.id);
  if (!isOwner && !isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const boardId = task.column.board.id;
  await prisma.task.delete({ where: { id } });

  // Emit real-time event
  emitBoardEvent(boardId, {
    type: "task:deleted",
    taskId: id,
    userId: user.id,
  });

  return NextResponse.json({ success: true });
}

// POST /api/tasks/[id] - Create a subtask for this task
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: parentId } = await params;
  const { title, assigneeId } = await req.json();

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  // Get parent task and verify access
  const parentTask = await prisma.task.findFirst({
    where: { id: parentId },
    include: {
      column: { include: { board: { include: { members: true } } } },
      subtasks: true,
    },
  });

  if (!parentTask) {
    return NextResponse.json({ error: "Parent task not found" }, { status: 404 });
  }

  const isMember = parentTask.column.board.members.some((m) => m.userId === user.id);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Create subtask inheriting parent's column
  const subtask = await prisma.task.create({
    data: {
      columnId: parentTask.columnId,
      parentId,
      title: title.trim(),
      priority: "medium",
      assigneeId: assigneeId || null,
      createdById: user.id,
      position: parentTask.subtasks.length,
      completed: false,
    },
    include: {
      assignee: true,
    },
  });

  // Create activity and emit to subscribers
  await createAndEmitActivity(parentId, user.id, "added subtask", { subtaskTitle: subtask.title });

  // Emit real-time event
  const boardId = parentTask.column.board.id;
  emitBoardEvent(boardId, {
    type: "task:created",
    task: subtask,
    userId: user.id,
  });

  return NextResponse.json(subtask);
}
