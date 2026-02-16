import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET - Get user details (admin only)
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (currentUser?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      role: true,
      lastActiveAt: true,
      createdAt: true,
      ownedBoards: {
        select: {
          id: true,
          name: true,
          visibility: true,
          createdAt: true,
          _count: {
            select: {
              members: true,
            },
          },
        },
      },
      boardMembers: {
        include: {
          board: {
            select: {
              id: true,
              name: true,
              visibility: true,
              owner: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}

// PATCH - Update user (admin only)
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (currentUser?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { role, name, email } = body;

  // Prevent self-demotion from admin
  if (params.id === session.user.id && role && role !== "admin") {
    return NextResponse.json({ error: "Cannot demote yourself from admin" }, { status: 400 });
  }

  // Validate role
  if (role && !["admin", "manager", "user"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Check email uniqueness if updating
  if (email) {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    if (existingUser && existingUser.id !== params.id) {
      return NextResponse.json({ error: "Email already in use" }, { status: 400 });
    }
  }

  const updateData: Record<string, unknown> = {};
  if (role) updateData.role = role;
  if (name !== undefined) updateData.name = name;
  if (email) updateData.email = email;

  const user = await prisma.user.update({
    where: { id: params.id },
    data: updateData,
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      role: true,
      lastActiveAt: true,
      createdAt: true,
      _count: {
        select: {
          ownedBoards: true,
        },
      },
    },
  });

  return NextResponse.json(user);
}

// DELETE - Remove user (admin only)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (currentUser?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Prevent self-deletion
  if (params.id === session.user.id) {
    return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
  }

  // Check user exists and get their boards
  const user = await prisma.user.findUnique({
    where: { id: params.id },
    include: {
      ownedBoards: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Parse query params for board handling
  const { searchParams } = new URL(request.url);
  const boardAction = searchParams.get("boardAction") || "delete"; // "delete" | "transfer"
  const transferToUserId = searchParams.get("transferToUserId");

  // If user has boards and we want to transfer
  if (user.ownedBoards.length > 0) {
    if (boardAction === "transfer") {
      if (!transferToUserId) {
        return NextResponse.json({ 
          error: "User has boards. Provide transferToUserId or use boardAction=delete" 
        }, { status: 400 });
      }

      // Validate transfer target
      const targetUser = await prisma.user.findUnique({
        where: { id: transferToUserId },
      });
      if (!targetUser) {
        return NextResponse.json({ error: "Transfer target user not found" }, { status: 400 });
      }

      // Transfer all boards to new owner
      await prisma.board.updateMany({
        where: { ownerId: params.id },
        data: { ownerId: transferToUserId },
      });
    } else {
      // Delete all their boards
      await prisma.board.deleteMany({
        where: { ownerId: params.id },
      });
    }
  }

  // Now delete the user (cascade will clean up memberships, etc.)
  await prisma.user.delete({
    where: { id: params.id },
  });

  return NextResponse.json({ success: true });
}
