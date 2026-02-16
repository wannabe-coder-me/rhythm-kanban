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

  const { id: boardId } = await params;
  const { columnIds } = await req.json();

  if (!Array.isArray(columnIds) || columnIds.length === 0) {
    return NextResponse.json({ error: "columnIds array is required" }, { status: 400 });
  }

  // Verify user is a member of the board
  const member = await prisma.boardMember.findFirst({
    where: { boardId, userId: session.user.id },
  });

  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify all columns belong to this board
  const columns = await prisma.column.findMany({
    where: { boardId },
    select: { id: true },
  });

  const boardColumnIds = new Set(columns.map((c) => c.id));
  const allColumnsValid = columnIds.every((id: string) => boardColumnIds.has(id));

  if (!allColumnsValid) {
    return NextResponse.json(
      { error: "Some column IDs do not belong to this board" },
      { status: 400 }
    );
  }

  // Update positions in a transaction
  await prisma.$transaction(
    columnIds.map((columnId: string, index: number) =>
      prisma.column.update({
        where: { id: columnId },
        data: { position: index },
      })
    )
  );

  // Return updated columns
  const updatedColumns = await prisma.column.findMany({
    where: { boardId },
    orderBy: { position: "asc" },
    include: {
      tasks: {
        where: { parentId: null }, // Only get parent tasks
        orderBy: { position: "asc" },
        include: {
          assignee: true,
          subtasks: {
            include: { assignee: true },
            orderBy: { position: "asc" },
          },
        },
      },
    },
  });

  return NextResponse.json(updatedColumns);
}
