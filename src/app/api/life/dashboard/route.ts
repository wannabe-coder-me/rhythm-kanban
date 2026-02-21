import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfDay, startOfWeek, endOfDay } from "date-fns";

// GET /api/life/dashboard - Get dashboard data
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });

  // Get active North Stars with progress
  const northStars = await prisma.northStar.findMany({
    where: { userId, active: true },
    include: {
      _count: { select: { actions: true } },
    },
  });

  const northStarsWithStats = await Promise.all(
    northStars.map(async (ns) => {
      const completedActions = await prisma.task.count({
        where: { northStarId: ns.id, completed: true },
      });
      return {
        ...ns,
        completedActions,
        totalActions: ns._count.actions,
      };
    })
  );

  // Get today's ritual status
  const morningRitual = await prisma.ritualEntry.findFirst({
    where: {
      userId,
      date: todayStart,
      type: "morning",
    },
  });

  const eveningRitual = await prisma.ritualEntry.findFirst({
    where: {
      userId,
      date: todayStart,
      type: "evening",
    },
  });

  // Get today's actions (tasks linked to North Stars due today or overdue)
  const todaysActions = await prisma.task.findMany({
    where: {
      northStarId: { not: null },
      completed: false,
      OR: [
        { dueDate: { gte: todayStart, lte: todayEnd } },
        { dueDate: { lt: todayStart } }, // Overdue
      ],
      column: {
        board: {
          members: {
            some: { userId },
          },
        },
      },
    },
    include: {
      northStar: true,
      column: {
        include: { board: true },
      },
    },
    orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
    take: 10,
  });

  // Get habit streaks
  const identities = await prisma.identity.findMany({
    where: { userId, active: true },
    include: {
      habits: {
        where: { active: true },
        include: {
          completions: {
            orderBy: { date: "desc" },
            take: 30,
          },
        },
      },
    },
  });

  // Calculate streaks for each habit
  const habitsWithStreaks = identities.flatMap((identity) =>
    identity.habits.map((habit) => {
      let streak = 0;
      const sortedCompletions = habit.completions.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      // Count consecutive days
      let checkDate = new Date(todayStart);
      for (const completion of sortedCompletions) {
        const completionDate = new Date(completion.date);
        if (
          completionDate.toDateString() === checkDate.toDateString() &&
          completion.completed
        ) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }

      return {
        id: habit.id,
        title: habit.title,
        identityStatement: identity.statement,
        pillar: identity.pillar,
        streak,
        completedToday: habit.completions.some(
          (c) =>
            new Date(c.date).toDateString() === todayStart.toDateString() &&
            c.completed
        ),
      };
    })
  );

  // Get latest life score
  const latestLifeScore = await prisma.lifeScore.findFirst({
    where: { userId },
    orderBy: { weekStart: "desc" },
  });

  // Get life settings
  const settings = await prisma.lifeSettings.findUnique({
    where: { userId },
  });

  return NextResponse.json({
    northStars: northStarsWithStats,
    rituals: {
      morning: {
        completed: !!morningRitual?.completedAt,
        data: morningRitual,
      },
      evening: {
        completed: !!eveningRitual?.completedAt,
        data: eveningRitual,
      },
    },
    todaysActions,
    habits: habitsWithStreaks.sort((a, b) => b.streak - a.streak).slice(0, 5),
    lifeScore: latestLifeScore,
    settings,
    onboardingComplete: settings?.onboardingCompleted ?? false,
  });
}
