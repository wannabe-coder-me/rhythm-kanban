import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: Get invite details (for invite landing page)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const invite = await prisma.boardInvite.findUnique({
    where: { token },
    include: {
      board: {
        select: { id: true, name: true, description: true },
      },
      invitedBy: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
  });

  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  // Check if expired
  if (new Date() > invite.expiresAt) {
    // Update status if not already
    if (invite.status === "pending") {
      await prisma.boardInvite.update({
        where: { id: invite.id },
        data: { status: "expired" },
      });
    }
    return NextResponse.json({ error: "Invite has expired" }, { status: 410 });
  }

  // Check if already used
  if (invite.status !== "pending") {
    return NextResponse.json(
      { error: `Invite has been ${invite.status}` },
      { status: 410 }
    );
  }

  return NextResponse.json(invite);
}

// POST: Accept invite
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token } = await params;

  const invite = await prisma.boardInvite.findUnique({
    where: { token },
    include: {
      board: {
        select: { id: true, name: true },
      },
    },
  });

  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  // Check if expired
  if (new Date() > invite.expiresAt) {
    if (invite.status === "pending") {
      await prisma.boardInvite.update({
        where: { id: invite.id },
        data: { status: "expired" },
      });
    }
    return NextResponse.json({ error: "Invite has expired" }, { status: 410 });
  }

  // Check if already used
  if (invite.status !== "pending") {
    return NextResponse.json(
      { error: `Invite has been ${invite.status}` },
      { status: 410 }
    );
  }

  // Check if user email matches invite (optional - can be removed to allow any logged in user)
  // For now, we'll allow any authenticated user to accept if they have the token

  // Check if already a member
  const existingMember = await prisma.boardMember.findFirst({
    where: { boardId: invite.boardId, userId: session.user.id },
  });

  if (existingMember) {
    // Mark invite as accepted and return success
    await prisma.boardInvite.update({
      where: { id: invite.id },
      data: { status: "accepted", acceptedAt: new Date() },
    });
    return NextResponse.json({
      success: true,
      boardId: invite.boardId,
      message: "You are already a member of this board",
    });
  }

  // Add user as board member
  await prisma.$transaction([
    prisma.boardMember.create({
      data: {
        boardId: invite.boardId,
        userId: session.user.id,
        role: invite.role,
        invitedById: invite.invitedById,
        joinedAt: new Date(),
      },
    }),
    prisma.boardInvite.update({
      where: { id: invite.id },
      data: { status: "accepted", acceptedAt: new Date() },
    }),
  ]);

  return NextResponse.json({
    success: true,
    boardId: invite.boardId,
    boardName: invite.board.name,
  });
}
