import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { createAndEmitActivity } from "@/lib/activity";

// POST /api/tasks/[id]/labels/[labelId] - Add label to task
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; labelId: string }> }
) {
  const user = await getAuthUser(req);
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: taskId, labelId } = await params;

  // Verify task exists and user has access
  const task = await prisma.task.findFirst({
    where: { id: taskId },
    include: {
      column: {
        include: {
          board: { select: { id: true, members: true } },
        },
      },
      labels: true,
    },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const isMember = task.column.board.members.some((m) => m.userId === user.id);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify label exists and belongs to the same board
  const label = await prisma.label.findFirst({
    where: { id: labelId, boardId: task.column.board.id },
  });

  if (!label) {
    return NextResponse.json({ error: "Label not found" }, { status: 404 });
  }

  // Check if already attached
  const alreadyAttached = task.labels.some((l) => l.id === labelId);
  if (alreadyAttached) {
    return NextResponse.json({ error: "Label already attached" }, { status: 409 });
  }

  // Connect label to task
  await prisma.task.update({
    where: { id: taskId },
    data: {
      labels: { connect: { id: labelId } },
    },
  });

  // Log activity
  await createAndEmitActivity(taskId, user.id, "added_label", {
    labelName: label.name,
    labelColor: label.color,
  });

  return NextResponse.json({ success: true });
}

// DELETE /api/tasks/[id]/labels/[labelId] - Remove label from task
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; labelId: string }> }
) {
  const user = await getAuthUser(req);
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: taskId, labelId } = await params;

  // Verify task exists and user has access
  const task = await prisma.task.findFirst({
    where: { id: taskId },
    include: {
      column: {
        include: {
          board: { select: { id: true, members: true } },
        },
      },
      labels: true,
    },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const isMember = task.column.board.members.some((m) => m.userId === user.id);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check if label is attached
  const label = task.labels.find((l) => l.id === labelId);
  if (!label) {
    return NextResponse.json({ error: "Label not attached to task" }, { status: 404 });
  }

  // Disconnect label from task
  await prisma.task.update({
    where: { id: taskId },
    data: {
      labels: { disconnect: { id: labelId } },
    },
  });

  // Log activity
  await createAndEmitActivity(taskId, user.id, "removed_label", {
    labelName: label.name,
  });

  return NextResponse.json({ success: true });
}
