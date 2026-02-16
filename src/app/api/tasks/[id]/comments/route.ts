import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyComment, notifyMentioned, parseMentions } from "@/lib/notifications";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const comments = await prisma.comment.findMany({
    where: {
      taskId: id,
      task: {
        column: {
          board: { members: { some: { userId: session.user.id } } },
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
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

  const isMember = task.column.board.members.some((m) => m.userId === session.user.id);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const comment = await prisma.comment.create({
    data: {
      taskId: id,
      userId: session.user.id,
      content: content.trim(),
    },
    include: { user: true },
  });

  // Create activity
  await prisma.activity.create({
    data: {
      taskId: id,
      userId: session.user.id,
      action: "commented",
      details: { preview: content.substring(0, 50) },
    },
  });

  // Get current user's name for notifications
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true },
  });
  const commenterName = currentUser?.name || "Someone";

  // Notify task creator (if not the commenter)
  if (task.createdById && task.createdById !== session.user.id) {
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
    task.assigneeId !== session.user.id &&
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
      mentionedUserId !== session.user.id &&
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
