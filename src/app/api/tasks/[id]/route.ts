import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  const { title, description, priority, dueDate, labels, assigneeId, columnId, position } = body;

  const task = await prisma.task.findFirst({
    where: { id },
    include: {
      column: { include: { board: { include: { members: true } } } },
    },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const isMember = task.column.board.members.some((m) => m.userId === session.user.id);
  if (!isMember) {
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
      ...(labels && { labels }),
      ...(assigneeId !== undefined && { assigneeId: assigneeId || null }),
    },
    include: {
      assignee: true,
      createdBy: true,
      column: true,
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
      column: { include: { board: { include: { members: true } } } },
    },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const isMember = task.column.board.members.some((m) => m.userId === session.user.id);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.task.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
