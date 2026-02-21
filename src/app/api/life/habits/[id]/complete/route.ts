import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfDay } from "date-fns";

// POST /api/life/habits/[id]/complete - Toggle habit completion for today
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;
  const body = await request.json();
  const { completed, note, date } = body;

  // Verify ownership through identity
  const habit = await prisma.habit.findFirst({
    where: { id },
    include: { identity: true },
  });

  if (!habit || habit.identity.userId !== session.user.id) {
    return NextResponse.json({ error: "Habit not found" }, { status: 404 });
  }

  const targetDate = date ? startOfDay(new Date(date)) : startOfDay(new Date());

  if (completed) {
    // Create or update completion
    const completion = await prisma.habitCompletion.upsert({
      where: {
        habitId_date: {
          habitId: id,
          date: targetDate,
        },
      },
      update: {
        completed: true,
        note,
      },
      create: {
        habitId: id,
        date: targetDate,
        completed: true,
        note,
      },
    });

    return NextResponse.json(completion);
  } else {
    // Delete completion
    await prisma.habitCompletion.deleteMany({
      where: {
        habitId: id,
        date: targetDate,
      },
    });

    return NextResponse.json({ success: true, completed: false });
  }
}
