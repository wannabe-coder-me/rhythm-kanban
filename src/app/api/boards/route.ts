import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const boards = await prisma.board.findMany({
    where: {
      members: {
        some: { userId: session.user.id },
      },
    },
    include: {
      _count: { select: { columns: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(boards);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, description } = await req.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const board = await prisma.board.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      members: {
        create: {
          userId: session.user.id,
          role: "owner",
        },
      },
      columns: {
        createMany: {
          data: [
            { name: "To Do", position: 0, color: "#6366f1" },
            { name: "In Progress", position: 1, color: "#f59e0b" },
            { name: "Done", position: 2, color: "#22c55e" },
          ],
        },
      },
    },
    include: {
      columns: { orderBy: { position: "asc" } },
      members: { include: { user: true } },
    },
  });

  return NextResponse.json(board);
}
