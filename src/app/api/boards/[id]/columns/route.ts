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

  const columns = await prisma.column.findMany({
    where: {
      boardId: id,
      board: { members: { some: { userId: session.user.id } } },
    },
    orderBy: { position: "asc" },
    include: {
      tasks: {
        orderBy: { position: "asc" },
        include: { assignee: true },
      },
    },
  });

  return NextResponse.json(columns);
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
  const { name, color } = await req.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const member = await prisma.boardMember.findFirst({
    where: { boardId: id, userId: session.user.id },
  });

  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const maxPosition = await prisma.column.aggregate({
    where: { boardId: id },
    _max: { position: true },
  });

  const column = await prisma.column.create({
    data: {
      boardId: id,
      name: name.trim(),
      color: color || "#6366f1",
      position: (maxPosition._max.position ?? -1) + 1,
    },
    include: { tasks: true },
  });

  return NextResponse.json(column);
}
