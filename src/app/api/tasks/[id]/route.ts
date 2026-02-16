import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyAssigned } from "@/lib/notifications";
import { emitBoardEvent } from "@/lib/events";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const task = await prisma.task.findFirst({
    where: {
      id,
      column: {
        board: { members: { some: { userId: session.user.id } } },
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { title, description, priority, dueDate, labelIds, assigneeId, columnId, position, completed, isRecurring, recurrenceRule } = body;

  const task = await prisma.task.findFirst({
    where: { id },
    include: {
      column: { include: { board: { select: { id: true, ownerId: true, members: true } } } },
    },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const isOwner = task.column.board.ownerId === session.user.id;
  const isMember = task.column.board.members.some((m) => m.userId === session.user.id);
  if (!isOwner && !isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const activities: { action: string; details: object }[] = [];

  // Track changes for activity log
  if (columnId && columnId !== task.columnId) {
    const newColumn = await prisma.column.findUnique({ where: { id: columnId } });
    activities.push({
      action: "moved",
      details: { from: task.column.name, to: newColumn?.name },
    });
  }

  if (assigneeId !== undefined && assigneeId !== task.assigneeId) {
    const newAssignee = assigneeId
      ? await prisma.user.findUnique({ where: { id: assigneeId } })
      : null;
    activities.push({
      action: "assigned",
      details: { assignee: newAssignee?.name || "Unassigned" },
    });

    // Send notification to the new assignee (if not self-assigning)
    if (assigneeId && assigneeId !== session.user.id) {
      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
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
    },
  });

  // Create activities
  for (const activity of activities) {
    await prisma.activity.create({
      data: {
        taskId: id,
        userId: session.user.id,
        action: activity.action,
        details: activity.details as object,
      },
    });
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
      userId: session.user.id,
    });
  }
  emitBoardEvent(boardId, {
    type: "task:updated",
    task: updated,
    userId: session.user.id,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
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

  const isOwner = task.column.board.ownerId === session.user.id;
  const isMember = task.column.board.members.some((m) => m.userId === session.user.id);
  if (!isOwner && !isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const boardId = task.column.board.id;
  await prisma.task.delete({ where: { id } });

  // Emit real-time event
  emitBoardEvent(boardId, {
    type: "task:deleted",
    taskId: id,
    userId: session.user.id,
  });

  return NextResponse.json({ success: true });
}

// POST /api/tasks/[id] - Create a subtask for this task
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
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

  const isMember = parentTask.column.board.members.some((m) => m.userId === session.user.id);
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
      createdById: session.user.id,
      position: parentTask.subtasks.length,
      completed: false,
    },
    include: {
      assignee: true,
    },
  });

  // Create activity
  await prisma.activity.create({
    data: {
      taskId: parentId,
      userId: session.user.id,
      action: "added subtask",
      details: { subtaskTitle: subtask.title },
    },
  });

  // Emit real-time event
  const boardId = parentTask.column.board.id;
  emitBoardEvent(boardId, {
    type: "task:created",
    task: subtask,
    userId: session.user.id,
  });

  return NextResponse.json(subtask);
}
