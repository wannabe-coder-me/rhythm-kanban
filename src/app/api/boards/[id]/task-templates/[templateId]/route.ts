import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/boards/[id]/task-templates/[templateId] - Get a single template
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; templateId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: boardId, templateId } = await params;

  // Verify user is a member of this board
  const member = await prisma.boardMember.findFirst({
    where: { boardId, userId: session.user.id },
  });

  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const template = await prisma.taskTemplate.findFirst({
    where: { id: templateId, boardId },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
  });

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  return NextResponse.json(template);
}

// PATCH /api/boards/[id]/task-templates/[templateId] - Update a template
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; templateId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: boardId, templateId } = await params;
  const { name, title, description, priority, labels, subtasks } = await req.json();

  // Verify user is a member of this board
  const member = await prisma.boardMember.findFirst({
    where: { boardId, userId: session.user.id },
  });

  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify template exists
  const template = await prisma.taskTemplate.findFirst({
    where: { id: templateId, boardId },
  });

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  // Check for duplicate name if name is being changed
  if (name && name.trim() !== template.name) {
    const existing = await prisma.taskTemplate.findFirst({
      where: { boardId, name: name.trim(), id: { not: templateId } },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A template with this name already exists" },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.taskTemplate.update({
    where: { id: templateId },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(priority !== undefined && { priority }),
      ...(labels !== undefined && { labels }),
      ...(subtasks !== undefined && { subtasks }),
    },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
  });

  return NextResponse.json(updated);
}

// DELETE /api/boards/[id]/task-templates/[templateId] - Delete a template
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; templateId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: boardId, templateId } = await params;

  // Verify user is a member of this board
  const member = await prisma.boardMember.findFirst({
    where: { boardId, userId: session.user.id },
  });

  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify template exists
  const template = await prisma.taskTemplate.findFirst({
    where: { id: templateId, boardId },
  });

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  await prisma.taskTemplate.delete({ where: { id: templateId } });

  return NextResponse.json({ success: true });
}
