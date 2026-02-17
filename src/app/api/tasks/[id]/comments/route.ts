import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/mobile-auth";
import { notifyComment, notifyMentioned, parseMentions } from "@/lib/notifications";
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

  const comments = await prisma.comment.findMany({
    where: {
      taskId: id,
      task: {
        column: {
          board: {
            OR: [
              { ownerId: user.id },
              { members: { some: { userId: user.id } } },
            ],
          },
        },
      },
    },
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(comments);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { content } = await req.json();

  if (!content?.trim()) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  const task = await prisma.task.findFirst({
    where: { id },
    include: {
      column: { include: { board: { include: { members: true } } } },
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

  const comment = await prisma.comment.create({
    data: {
      taskId: id,
      userId: user.id,
      content: content.trim(),
    },
    include: { user: true },
  });

  // Create activity and emit to subscribers
  await createAndEmitActivity(id, user.id, "commented", { preview: content.substring(0, 50) });

  // Get current user's name for notifications
  const currentUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { name: true },
  });
  const commenterName = currentUser?.name || "Someone";

  // Notify task creator (if not the commenter)
  if (task.createdById && task.createdById !== user.id) {
    await notifyComment(
      task.createdById,
      task.title,
      task.id,
      task.column.board.id,
      commenterName,
      true
    );
  }

  // Notify assignee (if different from creator and commenter)
  if (
    task.assigneeId &&
    task.assigneeId !== user.id &&
    task.assigneeId !== task.createdById
  ) {
    await notifyComment(
      task.assigneeId,
      task.title,
      task.id,
      task.column.board.id,
      commenterName,
      false
    );
  }

  // Handle @mentions
  const mentionedUserIds = await parseMentions(content, task.column.board.id);
  for (const mentionedUserId of mentionedUserIds) {
    // Don't notify if already notified as creator/assignee or is the commenter
    if (
      mentionedUserId !== user.id &&
      mentionedUserId !== task.createdById &&
      mentionedUserId !== task.assigneeId
    ) {
      await notifyMentioned(
        mentionedUserId,
        task.title,
        task.id,
        task.column.board.id,
        commenterName
      );
    }
  }

  return NextResponse.json(comment);
}
