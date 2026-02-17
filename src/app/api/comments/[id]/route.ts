import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/comments/[id] - Update a comment
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: commentId } = await params;
  const { content } = await req.json();

  if (!content?.trim()) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  // Find comment
  const comment = await prisma.comment.findFirst({
    where: { id: commentId },
    include: {
      task: {
        include: {
          column: {
            include: {
              board: { select: { members: true } },
            },
          },
        },
      },
    },
  });

  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  // Only the author can edit their comment
  if (comment.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.comment.update({
    where: { id: commentId },
    data: { content: content.trim() },
    include: { user: true },
  });

  return NextResponse.json(updated);
}

// DELETE /api/comments/[id] - Delete a comment
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: commentId } = await params;

  // Find comment
  const comment = await prisma.comment.findFirst({
    where: { id: commentId },
    include: {
      task: {
        include: {
          column: {
            include: {
              board: { select: { ownerId: true, members: true } },
            },
          },
        },
      },
    },
  });

  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  // User can delete if they're the author OR board owner
  const isAuthor = comment.userId === user.id;
  const isOwner = comment.task.column.board.ownerId === user.id;

  if (!isAuthor && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.comment.delete({ where: { id: commentId } });

  return NextResponse.json({ success: true });
}
