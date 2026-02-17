import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAndEmitActivity } from "@/lib/activity";

// PATCH /api/subtasks/[id] - Update a subtask
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: subtaskId } = await params;
  const body = await req.json();

  // Find subtask and verify access
  const subtask = await prisma.task.findFirst({
    where: { id: subtaskId },
    include: {
      parent: true,
      column: {
        include: {
          board: { select: { members: true } },
        },
      },
    },
  });

  if (!subtask) {
    return NextResponse.json({ error: "Subtask not found" }, { status: 404 });
  }

  // Must be a subtask (have a parent)
  if (!subtask.parentId) {
    return NextResponse.json({ error: "Not a subtask" }, { status: 400 });
  }

  const isMember = subtask.column.board.members.some((m) => m.userId === user.id);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Build update data
  const updateData: { title?: string; completed?: boolean } = {};
  if (typeof body.title === "string") {
    updateData.title = body.title.trim();
  }
  if (typeof body.completed === "boolean") {
    updateData.completed = body.completed;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const updated = await prisma.task.update({
    where: { id: subtaskId },
    data: updateData,
  });

  // Log activity on parent task
  if (body.completed !== undefined && subtask.parentId) {
    await createAndEmitActivity(
      subtask.parentId,
      user.id,
      body.completed ? "completed_subtask" : "uncompleted_subtask",
      { subtaskTitle: updated.title }
    );
  }

  return NextResponse.json({
    id: updated.id,
    taskId: subtask.parentId,
    title: updated.title,
    completed: updated.completed,
    position: updated.position,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
}

// DELETE /api/subtasks/[id] - Delete a subtask
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: subtaskId } = await params;

  // Find subtask and verify access
  const subtask = await prisma.task.findFirst({
    where: { id: subtaskId },
    include: {
      column: {
        include: {
          board: { select: { members: true } },
        },
      },
    },
  });

  if (!subtask) {
    return NextResponse.json({ error: "Subtask not found" }, { status: 404 });
  }

  // Must be a subtask (have a parent)
  if (!subtask.parentId) {
    return NextResponse.json({ error: "Not a subtask" }, { status: 400 });
  }

  const isMember = subtask.column.board.members.some((m) => m.userId === user.id);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parentId = subtask.parentId;
  const title = subtask.title;

  await prisma.task.delete({ where: { id: subtaskId } });

  // Log activity on parent task
  await createAndEmitActivity(parentId, user.id, "deleted_subtask", {
    subtaskTitle: title,
  });

  return NextResponse.json({ success: true });
}
