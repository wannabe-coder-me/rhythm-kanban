import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/boards/[id]/labels - List all labels for a board
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: boardId } = await params;

  // Verify user is a member of the board
  const member = await prisma.boardMember.findFirst({
    where: { boardId, userId: session.user.id },
  });

  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const labels = await prisma.label.findMany({
    where: { boardId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(labels);
}

// POST /api/boards/[id]/labels - Create a new label
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: boardId } = await params;
  const { name, color } = await req.json();

  if (!name?.trim() || !color) {
    return NextResponse.json(
      { error: "Name and color are required" },
      { status: 400 }
    );
  }

  // Verify user is a member of the board
  const member = await prisma.boardMember.findFirst({
    where: { boardId, userId: session.user.id },
  });

  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check if label with same name already exists
  const existing = await prisma.label.findFirst({
    where: { boardId, name: name.trim() },
  });

  if (existing) {
    return NextResponse.json(
      { error: "A label with this name already exists" },
      { status: 409 }
    );
  }

  const label = await prisma.label.create({
    data: {
      boardId,
      name: name.trim(),
      color,
    },
  });

  return NextResponse.json(label);
}

// PATCH /api/boards/[id]/labels - Update a label
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: boardId } = await params;
  const { labelId, name, color } = await req.json();

  if (!labelId) {
    return NextResponse.json({ error: "Label ID is required" }, { status: 400 });
  }

  // Verify user is a member of the board
  const member = await prisma.boardMember.findFirst({
    where: { boardId, userId: session.user.id },
  });

  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify label belongs to this board
  const label = await prisma.label.findFirst({
    where: { id: labelId, boardId },
  });

  if (!label) {
    return NextResponse.json({ error: "Label not found" }, { status: 404 });
  }

  // If changing name, check for duplicates
  if (name && name.trim() !== label.name) {
    const existing = await prisma.label.findFirst({
      where: { boardId, name: name.trim(), id: { not: labelId } },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A label with this name already exists" },
        { status: 409 }
      );
    }
  }

  const updated = await prisma.label.update({
    where: { id: labelId },
    data: {
      ...(name && { name: name.trim() }),
      ...(color && { color }),
    },
  });

  return NextResponse.json(updated);
}

// DELETE /api/boards/[id]/labels - Delete a label
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: boardId } = await params;
  const { searchParams } = new URL(req.url);
  const labelId = searchParams.get("labelId");

  if (!labelId) {
    return NextResponse.json({ error: "Label ID is required" }, { status: 400 });
  }

  // Verify user is a member of the board
  const member = await prisma.boardMember.findFirst({
    where: { boardId, userId: session.user.id },
  });

  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify label belongs to this board
  const label = await prisma.label.findFirst({
    where: { id: labelId, boardId },
  });

  if (!label) {
    return NextResponse.json({ error: "Label not found" }, { status: 404 });
  }

  await prisma.label.delete({ where: { id: labelId } });

  return NextResponse.json({ success: true });
}
