import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

// GET: List pending invites for board
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: boardId } = await params;

  // Check if user is admin/owner of board
  const member = await prisma.boardMember.findFirst({
    where: { boardId, userId: session.user.id },
  });

  if (!member || member.role === "member") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invites = await prisma.boardInvite.findMany({
    where: {
      boardId,
      status: "pending",
    },
    include: {
      invitedBy: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(invites);
}

// POST: Create invite
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: boardId } = await params;
  const { email, role = "member" } = await req.json();

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Validate role
  const validRoles = ["owner", "admin", "member"];
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Check if user is admin/owner of board
  const member = await prisma.boardMember.findFirst({
    where: { boardId, userId: session.user.id },
  });

  if (!member || member.role === "member") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check if user is already a member
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    const existingMember = await prisma.boardMember.findFirst({
      where: { boardId, userId: existingUser.id },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: "User is already a member of this board" },
        { status: 400 }
      );
    }
  }

  // Check for pending invite
  const existingInvite = await prisma.boardInvite.findFirst({
    where: {
      boardId,
      email: normalizedEmail,
      status: "pending",
    },
  });

  if (existingInvite) {
    return NextResponse.json(
      { error: "An invite is already pending for this email" },
      { status: 400 }
    );
  }

  // Create invite (7 days expiration)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const invite = await prisma.boardInvite.create({
    data: {
      boardId,
      email: normalizedEmail,
      role,
      token: randomUUID(),
      invitedById: session.user.id,
      expiresAt,
    },
    include: {
      invitedBy: {
        select: { id: true, name: true, email: true, image: true },
      },
      board: {
        select: { id: true, name: true },
      },
    },
  });

  return NextResponse.json(invite, { status: 201 });
}

// DELETE: Revoke invite
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
  const inviteId = searchParams.get("inviteId");

  if (!inviteId) {
    return NextResponse.json({ error: "Invite ID required" }, { status: 400 });
  }

  // Check if user is admin/owner of board
  const member = await prisma.boardMember.findFirst({
    where: { boardId, userId: session.user.id },
  });

  if (!member || member.role === "member") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Update invite status to revoked
  await prisma.boardInvite.update({
    where: { id: inviteId },
    data: { status: "revoked" },
  });

  return NextResponse.json({ success: true });
}
