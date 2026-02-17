import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/columns/[id]/tasks/reorder - Reorder tasks in a column
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: columnId } = await params;
  const { taskIds } = await req.json();

  if (!Array.isArray(taskIds)) {
    return NextResponse.json({ error: "taskIds must be an array" }, { status: 400 });
  }

  // Verify column exists and user has access
  const column = await prisma.column.findFirst({
    where: { id: columnId },
    include: {
      board: { select: { members: true } },
    },
  });

  if (!column) {
    return NextResponse.json({ error: "Column not found" }, { status: 404 });
  }

  const isMember = column.board.members.some((m) => m.userId === user.id);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Update positions in a transaction
  await prisma.$transaction(
    taskIds.map((taskId: string, index: number) =>
      prisma.task.update({
        where: { id: taskId },
        data: { position: index },
      })
    )
  );

  return NextResponse.json({ success: true });
}
