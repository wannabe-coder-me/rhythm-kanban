import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfDay } from "date-fns";

// GET /api/life/identities - List identities with habits and proofs
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = startOfDay(new Date());

  const identities = await prisma.identity.findMany({
    where: { userId: session.user.id, active: true },
    include: {
      habits: {
        where: { active: true },
        include: {
          completions: {
            where: { date: today },
          },
        },
      },
      proofs: {
        orderBy: { date: "desc" },
        take: 5,
      },
    },
    orderBy: [{ pillar: "asc" }, { order: "asc" }],
  });

  // Calculate streaks and today's completion status
  const identitiesWithStats = await Promise.all(
    identities.map(async (identity) => {
      const habitsWithStats = await Promise.all(
        identity.habits.map(async (habit) => {
          const completedToday = habit.completions.length > 0;
          
          // Calculate streak (simple consecutive days check)
          const streak = await calculateStreak(habit.id);
          
          return {
            ...habit,
            completions: undefined, // Don't send raw completions
            completedToday,
            streak,
          };
        })
      );

      return {
        ...identity,
        habits: habitsWithStats,
      };
    })
  );

  return NextResponse.json(identitiesWithStats);
}

// POST /api/life/identities - Create an identity
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { pillar, statement } = body;

  if (!pillar || !statement) {
    return NextResponse.json(
      { error: "Pillar and statement are required" },
      { status: 400 }
    );
  }

  const maxOrder = await prisma.identity.aggregate({
    where: { userId: session.user.id, pillar },
    _max: { order: true },
  });

  const identity = await prisma.identity.create({
    data: {
      userId: session.user.id,
      pillar,
      statement,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  return NextResponse.json(identity, { status: 201 });
}

async function calculateStreak(habitId: string): Promise<number> {
  const completions = await prisma.habitCompletion.findMany({
    where: { habitId, completed: true },
    orderBy: { date: "desc" },
    take: 365, // Max streak we care about
  });

  if (completions.length === 0) return 0;

  let streak = 0;
  let currentDate = startOfDay(new Date());
  
  // Check if completed today
  const todayCompletion = completions.find(
    (c) => new Date(c.date).getTime() === currentDate.getTime()
  );
  
  if (!todayCompletion) {
    // Check yesterday - if not completed yesterday, streak is 0
    currentDate = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);
  }

  for (const completion of completions) {
    const completionDate = startOfDay(new Date(completion.date));
    if (completionDate.getTime() === currentDate.getTime()) {
      streak++;
      currentDate = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);
    } else if (completionDate.getTime() < currentDate.getTime()) {
      break; // Gap in streak
    }
  }

  return streak;
}
