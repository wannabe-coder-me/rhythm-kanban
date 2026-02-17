import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAndEmitActivity } from "@/lib/activity";

// GET /api/tasks/[id]/subtasks - List subtasks for a task
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: parentId } = await params;

  // Verify parent task exists and user has access
  const parentTask = await prisma.task.findFirst({
    where: { id: parentId },
    include: {
      column: {
        include: {
          board: { select: { members: true } },
        },
      },
    },
  });

  if (!parentTask) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const isMember = parentTask.column.board.members.some((m) => m.userId === user.id);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const subtasks = await prisma.task.findMany({
    where: { parentId },
    orderBy: { position: "asc" },
    select: {
      id: true,
      title: true,
      completed: true,
      position: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Map to simpler subtask format
  const formattedSubtasks = subtasks.map((s) => ({
    id: s.id,
    taskId: parentId,
    title: s.title,
    completed: s.completed,
    position: s.position,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));

  return NextResponse.json(formattedSubtasks);
}

// POST /api/tasks/[id]/subtasks - Create a subtask
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: parentId } = await params;
  const { title } = await req.json();

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  // Verify parent task exists and user has access
  const parentTask = await prisma.task.findFirst({
    where: { id: parentId },
    include: {
      column: {
        include: {
          board: { select: { id: true, members: true } },
        },
      },
      subtasks: { select: { position: true } },
    },
  });

  if (!parentTask) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const isMember = parentTask.column.board.members.some((m) => m.userId === user.id);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get next position
  const maxPosition = parentTask.subtasks.reduce(
    (max, s) => Math.max(max, s.position),
    -1
  );

  const subtask = await prisma.task.create({
    data: {
      title: title.trim(),
      columnId: parentTask.columnId,
      parentId: parentId,
      createdById: user.id,
      position: maxPosition + 1,
      priority: "medium",
    },
  });

  // Log activity
  await createAndEmitActivity(parentId, user.id, "added_subtask", {
    subtaskTitle: title.trim(),
  });

  return NextResponse.json({
    id: subtask.id,
    taskId: parentId,
    title: subtask.title,
    completed: subtask.completed,
    position: subtask.position,
    createdAt: subtask.createdAt.toISOString(),
    updatedAt: subtask.updatedAt.toISOString(),
  });
}
