import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH: Update member role
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: boardId, userId: targetUserId } = await params;
  const { role } = await req.json();

  // Validate role
  if (!["admin", "member", "viewer"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Get board info
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { ownerId: true },
  });

  if (!board) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  // Check permissions
  const currentMembership = await prisma.boardMember.findUnique({
    where: {
      boardId_userId: { boardId, userId: session.user.id },
    },
  });

  const isOwner = board.ownerId === session.user.id;
  const isAdmin = currentMembership?.role === "admin";

  if (!isOwner && !isAdmin) {
    return NextResponse.json(
      { error: "Only owners and admins can change roles" },
      { status: 403 }
    );
  }

  // Cannot change owner's role
  if (board.ownerId === targetUserId) {
    return NextResponse.json(
      { error: "Cannot change owner's role" },
      { status: 400 }
    );
  }

  // Admins cannot change other admins' roles (only owner can)
  const targetMembership = await prisma.boardMember.findUnique({
    where: {
      boardId_userId: { boardId, userId: targetUserId },
    },
  });

  if (!targetMembership) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  if (!isOwner && targetMembership.role === "admin") {
    return NextResponse.json(
      { error: "Only the owner can change admin roles" },
      { status: 403 }
    );
  }

  // Update role
  const updatedMember = await prisma.boardMember.update({
    where: {
      boardId_userId: { boardId, userId: targetUserId },
    },
    data: { role },
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
    ...updatedMember,
    isOwner: board.ownerId === targetUserId,
  });
}

// DELETE: Remove member from board
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: boardId, userId: targetUserId } = await params;

  // Get board info
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { ownerId: true },
  });

  if (!board) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  // Cannot remove owner
  if (board.ownerId === targetUserId) {
    return NextResponse.json(
      { error: "Cannot remove the board owner" },
      { status: 400 }
    );
  }

  // Check permissions (owner, admin, or self)
  const currentMembership = await prisma.boardMember.findUnique({
    where: {
      boardId_userId: { boardId, userId: session.user.id },
    },
  });

  const isOwner = board.ownerId === session.user.id;
  const isAdmin = currentMembership?.role === "admin";
  const isSelf = session.user.id === targetUserId;

  // Check target membership
  const targetMembership = await prisma.boardMember.findUnique({
    where: {
      boardId_userId: { boardId, userId: targetUserId },
    },
  });

  if (!targetMembership) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Admins cannot remove other admins (only owner can)
  if (!isOwner && !isSelf && targetMembership.role === "admin") {
    return NextResponse.json(
      { error: "Only the owner can remove admins" },
      { status: 403 }
    );
  }

  // Must be owner, admin, or removing self
  if (!isOwner && !isAdmin && !isSelf) {
    return NextResponse.json(
      { error: "Permission denied" },
      { status: 403 }
    );
  }

  // Remove member
  await prisma.boardMember.delete({
    where: {
      boardId_userId: { boardId, userId: targetUserId },
    },
  });

  return NextResponse.json({ success: true });
}
