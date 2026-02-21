import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfWeek, parseISO } from "date-fns";

// GET /api/life/scores - Get score for a specific week
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const weekParam = searchParams.get("week");
  
  const weekStart = weekParam 
    ? startOfWeek(parseISO(weekParam), { weekStartsOn: 0 })
    : startOfWeek(new Date(), { weekStartsOn: 0 });

  const score = await prisma.lifeScore.findUnique({
    where: {
      userId_weekStart: {
        userId: session.user.id,
        weekStart,
      },
    },
  });

  return NextResponse.json(score);
}

// POST /api/life/scores - Create or update score for a week
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    weekStart: weekStartStr,
    healthScore,
    wealthScore,
    relationScore,
    careerScore,
    spiritualScore,
    contributionScore,
    notes,
  } = body;

  const weekStart = weekStartStr 
    ? startOfWeek(parseISO(weekStartStr), { weekStartsOn: 0 })
    : startOfWeek(new Date(), { weekStartsOn: 0 });

  // Calculate overall score
  const scores = [healthScore, wealthScore, relationScore, careerScore, spiritualScore, contributionScore]
    .filter((s) => s !== null && s !== undefined);
  const overallScore = scores.length > 0 
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null;

  const score = await prisma.lifeScore.upsert({
    where: {
      userId_weekStart: {
        userId: session.user.id,
        weekStart,
      },
    },
    update: {
      healthScore,
      wealthScore,
      relationScore,
      careerScore,
      spiritualScore,
      contributionScore,
      overallScore,
      notes,
    },
    create: {
      userId: session.user.id,
      weekStart,
      healthScore,
      wealthScore,
      relationScore,
      careerScore,
      spiritualScore,
      contributionScore,
      overallScore,
      notes,
    },
  });

  return NextResponse.json(score);
}
