import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/life/settings - Get user's life settings
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let settings = await prisma.lifeSettings.findUnique({
    where: { userId: session.user.id },
  });

  // Create default settings if none exist
  if (!settings) {
    settings = await prisma.lifeSettings.create({
      data: {
        userId: session.user.id,
        timezone: "America/Chicago",
        weeklyReviewDay: 0, // Sunday
      },
    });
  }

  return NextResponse.json(settings);
}

// POST /api/life/settings - Create or update settings
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    morningRitualTime,
    eveningRitualTime,
    weeklyReviewDay,
    timezone,
    onboardingCompleted,
    onboardingStep,
  } = body;

  const settings = await prisma.lifeSettings.upsert({
    where: { userId: session.user.id },
    update: {
      ...(morningRitualTime !== undefined && { morningRitualTime }),
      ...(eveningRitualTime !== undefined && { eveningRitualTime }),
      ...(weeklyReviewDay !== undefined && { weeklyReviewDay }),
      ...(timezone !== undefined && { timezone }),
      ...(onboardingCompleted !== undefined && { onboardingCompleted }),
      ...(onboardingStep !== undefined && { onboardingStep }),
    },
    create: {
      userId: session.user.id,
      morningRitualTime,
      eveningRitualTime,
      weeklyReviewDay: weeklyReviewDay ?? 0,
      timezone: timezone ?? "America/Chicago",
      onboardingCompleted: onboardingCompleted ?? false,
      onboardingStep: onboardingStep ?? 0,
    },
  });

  return NextResponse.json(settings);
}
