import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfWeek, parseISO } from "date-fns";

// GET /api/life/reviews - Get review for a specific week
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

  const review = await prisma.weeklyReview.findUnique({
    where: {
      userId_weekStart: {
        userId: session.user.id,
        weekStart,
      },
    },
  });

  return NextResponse.json(review);
}

// POST /api/life/reviews - Create or update review for a week
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    weekStart: weekStartStr,
    wins,
    insights,
    adjustments,
    nextFocus,
    completedAt,
  } = body;

  const weekStart = weekStartStr 
    ? startOfWeek(parseISO(weekStartStr), { weekStartsOn: 0 })
    : startOfWeek(new Date(), { weekStartsOn: 0 });

  const review = await prisma.weeklyReview.upsert({
    where: {
      userId_weekStart: {
        userId: session.user.id,
        weekStart,
      },
    },
    update: {
      ...(wins !== undefined && { wins }),
      ...(insights !== undefined && { insights }),
      ...(adjustments !== undefined && { adjustments }),
      ...(nextFocus !== undefined && { nextFocus }),
      ...(completedAt !== undefined && { completedAt: new Date(completedAt) }),
    },
    create: {
      userId: session.user.id,
      weekStart,
      wins,
      insights,
      adjustments,
      nextFocus,
      completedAt: completedAt ? new Date(completedAt) : null,
    },
  });

  return NextResponse.json(review);
}
