import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/boards/[id]/task-templates - List all templates for a board
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: boardId } = await params;

  // Verify user is a member of this board
  const member = await prisma.boardMember.findFirst({
    where: { boardId, userId: session.user.id },
  });

  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const templates = await prisma.taskTemplate.findMany({
    where: { boardId },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(templates);
}

// POST /api/boards/[id]/task-templates - Create a new template
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: boardId } = await params;
  const { name, title, description, priority, labels, subtasks } = await req.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Template name is required" }, { status: 400 });
  }

  if (!title?.trim()) {
    return NextResponse.json({ error: "Default title is required" }, { status: 400 });
  }

  // Verify user is a member of this board
  const member = await prisma.boardMember.findFirst({
    where: { boardId, userId: session.user.id },
  });

  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check if template with same name exists
  const existing = await prisma.taskTemplate.findFirst({
    where: { boardId, name: name.trim() },
  });

  if (existing) {
    return NextResponse.json(
      { error: "A template with this name already exists" },
      { status: 400 }
    );
  }

  const template = await prisma.taskTemplate.create({
    data: {
      boardId,
      name: name.trim(),
      title: title.trim(),
      description: description?.trim() || null,
      priority: priority || "medium",
      labels: labels || [],
      subtasks: subtasks || [],
      createdById: session.user.id,
    },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
  });

  return NextResponse.json(template);
}
