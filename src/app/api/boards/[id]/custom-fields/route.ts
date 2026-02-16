import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/boards/[id]/custom-fields - List all custom fields for a board
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

  const customFields = await prisma.customField.findMany({
    where: { boardId },
    orderBy: { position: "asc" },
  });

  return NextResponse.json(customFields);
}

// POST /api/boards/[id]/custom-fields - Create a new custom field
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: boardId } = await params;
  const { name, type, options, required } = await req.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const validTypes = ["text", "number", "date", "select", "checkbox", "url"];
  if (!type || !validTypes.includes(type)) {
    return NextResponse.json(
      { error: "Invalid field type. Must be one of: " + validTypes.join(", ") },
      { status: 400 }
    );
  }

  // Verify user is a member of the board with edit rights
  const member = await prisma.boardMember.findFirst({
    where: { boardId, userId: session.user.id },
  });

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { ownerId: true },
  });

  if (!member && board?.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check if field with same name already exists
  const existing = await prisma.customField.findFirst({
    where: { boardId, name: name.trim() },
  });

  if (existing) {
    return NextResponse.json(
      { error: "A custom field with this name already exists" },
      { status: 409 }
    );
  }

  // Get next position
  const lastField = await prisma.customField.findFirst({
    where: { boardId },
    orderBy: { position: "desc" },
  });

  const customField = await prisma.customField.create({
    data: {
      boardId,
      name: name.trim(),
      type,
      options: type === "select" && options ? JSON.stringify(options) : null,
      required: required || false,
      position: (lastField?.position ?? -1) + 1,
    },
  });

  return NextResponse.json(customField);
}

// PATCH /api/boards/[id]/custom-fields - Update a custom field
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: boardId } = await params;
  const { fieldId, name, type, options, required, position } = await req.json();

  if (!fieldId) {
    return NextResponse.json({ error: "Field ID is required" }, { status: 400 });
  }

  // Verify user is a member of the board
  const member = await prisma.boardMember.findFirst({
    where: { boardId, userId: session.user.id },
  });

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { ownerId: true },
  });

  if (!member && board?.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify field belongs to this board
  const field = await prisma.customField.findFirst({
    where: { id: fieldId, boardId },
  });

  if (!field) {
    return NextResponse.json({ error: "Custom field not found" }, { status: 404 });
  }

  // If changing name, check for duplicates
  if (name && name.trim() !== field.name) {
    const existing = await prisma.customField.findFirst({
      where: { boardId, name: name.trim(), id: { not: fieldId } },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A custom field with this name already exists" },
        { status: 409 }
      );
    }
  }

  // Handle reordering if position is provided
  if (typeof position === "number" && position !== field.position) {
    const allFields = await prisma.customField.findMany({
      where: { boardId },
      orderBy: { position: "asc" },
    });

    // Reorder
    const reordered = allFields.filter((f) => f.id !== fieldId);
    reordered.splice(position, 0, field);

    // Update all positions in a transaction
    await prisma.$transaction(
      reordered.map((f, idx) =>
        prisma.customField.update({
          where: { id: f.id },
          data: { position: idx },
        })
      )
    );
  }

  const validTypes = ["text", "number", "date", "select", "checkbox", "url"];

  const updated = await prisma.customField.update({
    where: { id: fieldId },
    data: {
      ...(name && { name: name.trim() }),
      ...(type && validTypes.includes(type) && { type }),
      ...(options !== undefined && {
        options: type === "select" || field.type === "select" 
          ? JSON.stringify(options) 
          : null,
      }),
      ...(typeof required === "boolean" && { required }),
    },
  });

  return NextResponse.json(updated);
}

// DELETE /api/boards/[id]/custom-fields - Delete a custom field
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
  const fieldId = searchParams.get("fieldId");

  if (!fieldId) {
    return NextResponse.json({ error: "Field ID is required" }, { status: 400 });
  }

  // Verify user is a member of the board
  const member = await prisma.boardMember.findFirst({
    where: { boardId, userId: session.user.id },
  });

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { ownerId: true },
  });

  if (!member && board?.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify field belongs to this board
  const field = await prisma.customField.findFirst({
    where: { id: fieldId, boardId },
  });

  if (!field) {
    return NextResponse.json({ error: "Custom field not found" }, { status: 404 });
  }

  // Delete field (cascade will delete all values)
  await prisma.customField.delete({ where: { id: fieldId } });

  return NextResponse.json({ success: true });
}
