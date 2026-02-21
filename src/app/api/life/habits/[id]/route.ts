import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// DELETE /api/life/habits/[id] - Delete a habit
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  // Verify ownership through identity
  const habit = await prisma.habit.findFirst({
    where: { id },
    include: { identity: true },
  });

  if (!habit || habit.identity.userId !== session.user.id) {
    return NextResponse.json({ error: "Habit not found" }, { status: 404 });
  }

  await prisma.habit.delete({ where: { id } });

  return NextResponse.json({ success: true });
}

// PATCH /api/life/habits/[id] - Update a habit
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
  const { title, frequency, active } = body;

  // Verify ownership
  const habit = await prisma.habit.findFirst({
    where: { id },
    include: { identity: true },
  });

  if (!habit || habit.identity.userId !== session.user.id) {
    return NextResponse.json({ error: "Habit not found" }, { status: 404 });
  }

  const updated = await prisma.habit.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(frequency !== undefined && { frequency }),
      ...(active !== undefined && { active }),
    },
  });

  return NextResponse.json(updated);
}
