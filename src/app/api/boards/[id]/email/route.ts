import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";

// GET - Get board email settings
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: boardId } = await params;

  // Verify user has access to this board
  const board = await prisma.board.findFirst({
    where: {
      id: boardId,
      OR: [
        { ownerId: session.user.id },
        { members: { some: { userId: session.user.id } } },
        { visibility: "public" },
      ],
    },
    include: {
      emailAddress: true,
      columns: { orderBy: { position: "asc" } },
    },
  });

  if (!board) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  return NextResponse.json({
    emailAddress: board.emailAddress,
    columns: board.columns,
  });
}

// POST - Enable email-to-task for board (creates email address)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: boardId } = await params;

  // Verify user is owner or admin
  const board = await prisma.board.findFirst({
    where: {
      id: boardId,
      OR: [
        { ownerId: session.user.id },
        { members: { some: { userId: session.user.id, role: "admin" } } },
      ],
    },
    include: {
      emailAddress: true,
      columns: { orderBy: { position: "asc" } },
    },
  });

  if (!board) {
    return NextResponse.json({ error: "Board not found or unauthorized" }, { status: 404 });
  }

  // Check if email address already exists
  if (board.emailAddress) {
    return NextResponse.json({ error: "Email address already exists" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const { columnId } = body;

  // Generate unique email address
  const shortId = nanoid(8).toLowerCase();
  const email = `board-${shortId}@kanban.rhythm.engineering`;

  // Use first column as default if not specified
  const defaultColumnId = columnId || board.columns[0]?.id;

  const emailAddress = await prisma.boardEmailAddress.create({
    data: {
      boardId,
      email,
      columnId: defaultColumnId,
      isActive: true,
    },
  });

  return NextResponse.json(emailAddress);
}

// PATCH - Update email settings
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: boardId } = await params;

  // Verify user is owner or admin
  const board = await prisma.board.findFirst({
    where: {
      id: boardId,
      OR: [
        { ownerId: session.user.id },
        { members: { some: { userId: session.user.id, role: "admin" } } },
      ],
    },
    include: { emailAddress: true },
  });

  if (!board) {
    return NextResponse.json({ error: "Board not found or unauthorized" }, { status: 404 });
  }

  if (!board.emailAddress) {
    return NextResponse.json({ error: "Email not enabled for this board" }, { status: 400 });
  }

  const body = await request.json();
  const { isActive, columnId, autoAssign, requireMember } = body;

  const updated = await prisma.boardEmailAddress.update({
    where: { boardId },
    data: {
      ...(typeof isActive === "boolean" && { isActive }),
      ...(columnId !== undefined && { columnId }),
      ...(typeof autoAssign === "boolean" && { autoAssign }),
      ...(typeof requireMember === "boolean" && { requireMember }),
    },
  });

  return NextResponse.json(updated);
}

// DELETE - Disable/remove email address
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: boardId } = await params;

  // Verify user is owner
  const board = await prisma.board.findFirst({
    where: {
      id: boardId,
      ownerId: session.user.id,
    },
    include: { emailAddress: true },
  });

  if (!board) {
    return NextResponse.json({ error: "Board not found or unauthorized" }, { status: 404 });
  }

  if (!board.emailAddress) {
    return NextResponse.json({ error: "Email not enabled for this board" }, { status: 400 });
  }

  await prisma.boardEmailAddress.delete({
    where: { boardId },
  });

  return NextResponse.json({ success: true });
}
