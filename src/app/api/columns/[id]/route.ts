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

  const { id } = await params;
  const { name, color, position } = await req.json();

  const column = await prisma.column.findFirst({
    where: { id },
    include: { board: { include: { members: true } } },
  });

  if (!column) {
    return NextResponse.json({ error: "Column not found" }, { status: 404 });
  }

  const isMember = column.board.members.some((m) => m.userId === session.user.id);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Handle position update (reordering)
  if (position !== undefined && position !== column.position) {
    const columns = await prisma.column.findMany({
      where: { boardId: column.boardId },
      orderBy: { position: "asc" },
    });

    const oldIndex = columns.findIndex((c) => c.id === id);
    const newIndex = position;

    // Reorder columns
    const reordered = [...columns];
    const [removed] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, removed);

    await prisma.$transaction(
      reordered.map((col, idx) =>
        prisma.column.update({
          where: { id: col.id },
          data: { position: idx },
        })
      )
    );
  }

  const updated = await prisma.column.update({
    where: { id },
    data: {
      ...(name && { name: name.trim() }),
      ...(color && { color }),
    },
    include: { tasks: { include: { assignee: true } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const column = await prisma.column.findFirst({
    where: { id },
    include: { board: { include: { members: true } } },
  });

  if (!column) {
    return NextResponse.json({ error: "Column not found" }, { status: 404 });
  }

  const member = column.board.members.find((m) => m.userId === session.user.id);
  if (!member || member.role === "member") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.column.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
