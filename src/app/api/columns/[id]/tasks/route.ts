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

  const tasks = await prisma.task.findMany({
    where: {
      columnId: id,
      column: {
        board: { members: { some: { userId: session.user.id } } },
      },
    },
    orderBy: { position: "asc" },
    include: {
      assignee: true,
      createdBy: true,
    },
  });

  return NextResponse.json(tasks);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { title, description, priority, dueDate, labels, assigneeId } = await req.json();

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const column = await prisma.column.findFirst({
    where: { id },
    include: { board: { include: { members: true } } },
  });

  if (!column) {
    return NextResponse.json({ error: "Column not found" }, { status: 404 });
  }

  const isMember = column.board.members.some((m) => m.userId === session.user.id);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const maxPosition = await prisma.task.aggregate({
    where: { columnId: id },
    _max: { position: true },
  });

  const task = await prisma.task.create({
    data: {
      columnId: id,
      title: title.trim(),
      description: description?.trim() || null,
      priority: priority || "medium",
      dueDate: dueDate ? new Date(dueDate) : null,
      labels: labels || [],
      assigneeId: assigneeId || null,
      createdById: session.user.id,
      position: (maxPosition._max.position ?? -1) + 1,
    },
    include: {
      assignee: true,
      createdBy: true,
    },
  });

  // Create activity
  await prisma.activity.create({
    data: {
      taskId: task.id,
      userId: session.user.id,
      action: "created",
      details: { title: task.title },
    },
  });

  return NextResponse.json(task);
}
