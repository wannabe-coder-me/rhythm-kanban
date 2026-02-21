import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/life/north-stars/[id] - Update a North Star
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;
  const body = await request.json();

  // Verify ownership
  const existing = await prisma.northStar.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "North Star not found" }, { status: 404 });
  }

  const { title, description, targetDate, progress, achieved } = body;

  const northStar = await prisma.northStar.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(targetDate !== undefined && { targetDate: targetDate ? new Date(targetDate) : null }),
      ...(progress !== undefined && { progress }),
      ...(achieved !== undefined && { 
        achieved,
        achievedAt: achieved ? new Date() : null,
      }),
    },
  });

  return NextResponse.json(northStar);
}

// DELETE /api/life/north-stars/[id] - Archive a North Star
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  // Verify ownership
  const existing = await prisma.northStar.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "North Star not found" }, { status: 404 });
  }

  // Soft delete by deactivating
  await prisma.northStar.update({
    where: { id },
    data: { active: false },
  });

  return NextResponse.json({ success: true });
}
