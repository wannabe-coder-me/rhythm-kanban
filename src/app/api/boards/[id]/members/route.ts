import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/mobile-auth";

// GET: List all members of a board
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: boardId } = await params;

  // Get board with members, checking user has access
  const board = await prisma.board.findFirst({
    where: {
      id: boardId,
      OR: [
        { ownerId: user.id },
        { members: { some: { userId: user.id } } },
      ],
    },
    select: {
      id: true,
      ownerId: true,
      members: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              image: true,
            },
          },
        },
        orderBy: { role: "asc" },
      },
    },
  });

  if (!board) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // Add isOwner flag to each member
  const membersWithOwnerFlag = board.members.map((m) => ({
    ...m,
    isOwner: board.ownerId === m.userId,
  }));

  return NextResponse.json(membersWithOwnerFlag);
}

// POST: Add a member directly (for admins)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: boardId } = await params;
  const { email, role = "member" } = await req.json();

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  // Validate role
  if (!["admin", "member", "viewer"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Check if current user can add members (must be owner or admin)
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { ownerId: true },
  });

  if (!board) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  const currentMembership = await prisma.boardMember.findUnique({
    where: {
      boardId_userId: { boardId, userId: user.id },
    },
  });

  const isOwner = board.ownerId === user.id;
  const isAdmin = currentMembership?.role === "admin";

  if (!isOwner && !isAdmin) {
    return NextResponse.json(
      { error: "Only owners and admins can add members" },
      { status: 403 }
    );
  }

  // Find user by email
  const userToAdd = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, email: true, name: true, image: true },
  });

  if (!userToAdd) {
    return NextResponse.json(
      { error: "User not found. They must have an account first." },
      { status: 404 }
    );
  }

  // Check if already a member
  const existingMembership = await prisma.boardMember.findUnique({
    where: {
      boardId_userId: { boardId, userId: userToAdd.id },
    },
  });

  if (existingMembership) {
    return NextResponse.json(
      { error: "User is already a member of this board" },
      { status: 400 }
    );
  }

  // Add member
  const newMember = await prisma.boardMember.create({
    data: {
      boardId,
      userId: userToAdd.id,
      role,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
        },
      },
    },
  });

  return NextResponse.json({
    ...newMember,
    isOwner: false,
  });
}
