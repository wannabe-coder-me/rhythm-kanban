import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewBoard, canEditBoard, canDeleteBoard } from "@/lib/permissions";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Get user with role
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Get board with owner and members
  const board = await prisma.board.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true, image: true } },
      columns: {
        orderBy: { position: "asc" },
        include: {
          tasks: {
            where: { parentId: null },
            orderBy: { position: "asc" },
            include: {
              assignee: true,
              createdBy: true,
              labels: true,
              subtasks: {
                orderBy: { position: "asc" },
                include: {
                  assignee: true,
                  labels: true,
                },
              },
              _count: {
                select: { attachments: true, blockedBy: true },
              },
              blockedBy: {
                where: { blockedBy: { completed: false } },
                select: { id: true },
              },
              customFieldValues: {
                include: { customField: true },
              },
            },
          },
        },
      },
      members: {
        include: { 
          user: { select: { id: true, name: true, email: true, image: true } },
          invitedBy: { select: { id: true, name: true } },
        },
      },
      labels: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!board) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  // Get user's membership
  const membership = board.members.find(m => m.userId === user.id) || null;

  // Check view permission
  if (!canViewBoard(user, board, membership)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(board);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { name, description, visibility, newOwnerId } = await req.json();

  // Get user with role
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Get board with members
  const board = await prisma.board.findUnique({
    where: { id },
    include: { members: true },
  });

  if (!board) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  // Get user's membership
  const membership = board.members.find(m => m.userId === user.id) || null;

  // Ownership transfer requires owner or system admin
  if (newOwnerId) {
    if (!canDeleteBoard(user, board)) {
      return NextResponse.json(
        { error: "Only the owner can transfer ownership" },
        { status: 403 }
      );
    }

    // Validate new owner is a member
    const newOwnerMember = board.members.find(m => m.userId === newOwnerId);
    if (!newOwnerMember) {
      return NextResponse.json(
        { error: "New owner must be a board member" },
        { status: 400 }
      );
    }
  }

  // Check edit permission for other changes
  if (!canEditBoard(user, board, membership)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Validate visibility if provided
  if (visibility && !["private", "team", "public"].includes(visibility)) {
    return NextResponse.json({ error: "Invalid visibility" }, { status: 400 });
  }

  const updated = await prisma.board.update({
    where: { id },
    data: {
      ...(name && { name: name.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(visibility && { visibility }),
      ...(newOwnerId && { ownerId: newOwnerId }),
    },
    include: {
      owner: { select: { id: true, name: true, email: true, image: true } },
    },
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

  // Get user with role
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Get board
  const board = await prisma.board.findUnique({
    where: { id },
  });

  if (!board) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  // Check delete permission (only owner or system admin)
  if (!canDeleteBoard(user, board)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.board.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
