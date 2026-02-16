import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: parentTaskId } = await params;
  const { subtaskIds } = await req.json();

  if (!Array.isArray(subtaskIds)) {
    return NextResponse.json({ error: "subtaskIds must be an array" }, { status: 400 });
  }

  // Verify parent task exists and user has access
  const parentTask = await prisma.task.findFirst({
    where: { id: parentTaskId },
    include: {
      column: {
        include: {
          board: {
            select: { id: true, ownerId: true, members: true },
          },
        },
      },
    },
  });

  if (!parentTask) {
    return NextResponse.json({ error: "Parent task not found" }, { status: 404 });
  }

  const isOwner = parentTask.column.board.ownerId === session.user.id;
  const isMember = parentTask.column.board.members.some((m) => m.userId === session.user.id);
  if (!isOwner && !isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Update positions in a transaction
  await prisma.$transaction(
    subtaskIds.map((subtaskId: string, index: number) =>
      prisma.task.update({
        where: { id: subtaskId },
        data: { position: index },
      })
    )
  );

  return NextResponse.json({ success: true });
}
