import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { getTemplateById } from "@/lib/board-templates";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // System admins see all boards
  if (isAdmin(user)) {
    const boards = await prisma.board.findMany({
      include: {
        owner: { select: { id: true, name: true, email: true, image: true } },
        _count: { select: { columns: true, members: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(boards);
  }

  // Regular users see:
  // 1. Boards they own
  // 2. Boards they're members of
  // 3. Team-visible boards (all authenticated users)
  // 4. Public boards
  const boards = await prisma.board.findMany({
    where: {
      OR: [
        { ownerId: session.user.id },
        { members: { some: { userId: session.user.id } } },
        { visibility: "team" },
        { visibility: "public" },
      ],
    },
    include: {
      owner: { select: { id: true, name: true, email: true, image: true } },
      _count: { select: { columns: true, members: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(boards);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  console.log("[POST /api/boards] Session:", session?.user?.id, session?.user?.email);
  
  if (!session?.user?.id) {
    console.log("[POST /api/boards] No user ID in session");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, description, visibility = "private", templateId } = body;
  console.log("[POST /api/boards] Creating board:", name, "for user:", session.user.id, "template:", templateId);

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  // Validate visibility
  if (!["private", "team", "public"].includes(visibility)) {
    return NextResponse.json({ error: "Invalid visibility" }, { status: 400 });
  }

  // Get template config (default to blank template columns if no template)
  const template = templateId ? getTemplateById(templateId) : null;
  const columns = template?.columns ?? [
    { name: "To Do", color: "#6366f1" },
    { name: "In Progress", color: "#f59e0b" },
    { name: "Done", color: "#22c55e" },
  ];
  const labels = template?.labels ?? [];

  try {
    const board = await prisma.board.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        visibility,
        ownerId: session.user.id,
        // Owner is automatically added as admin member
        members: {
          create: {
            userId: session.user.id,
            role: "admin",
            joinedAt: new Date(),
          },
        },
        columns: {
          createMany: {
            data: columns.map((col, index) => ({
              name: col.name,
              position: index,
              color: col.color,
            })),
          },
        },
        labels: labels.length > 0 ? {
          createMany: {
            data: labels.map((label) => ({
              name: label.name,
              color: label.color,
            })),
          },
        } : undefined,
      },
      include: {
        owner: { select: { id: true, name: true, email: true, image: true } },
        columns: { orderBy: { position: "asc" } },
        members: { include: { user: true } },
        labels: true,
      },
    });

    console.log("[POST /api/boards] Board created:", board.id, "with", columns.length, "columns and", labels.length, "labels");
    return NextResponse.json(board);
  } catch (error) {
    console.error("[POST /api/boards] Error creating board:", error);
    return NextResponse.json({ error: "Failed to create board", details: String(error) }, { status: 500 });
  }
}
