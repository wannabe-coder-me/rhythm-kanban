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

  return NextResponse.json(comment);
}
