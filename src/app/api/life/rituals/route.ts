import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfDay } from "date-fns";

// GET /api/life/rituals - Get ritual for a specific date
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get("date");
  const type = searchParams.get("type") as "morning" | "evening" | null;

  const date = dateStr ? startOfDay(new Date(dateStr)) : startOfDay(new Date());

  const where: any = {
    userId: session.user.id,
    date,
  };

  if (type) where.type = type;

  const rituals = await prisma.ritualEntry.findMany({
    where,
  });

  return NextResponse.json(rituals);
}

// POST /api/life/rituals - Create or update a ritual entry
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    date: dateStr,
    type,
    gratitude1,
    gratitude2,
    gratitude3,
    gratitude4,
    gratitude5,
    proud1,
    proud2,
    proud3,
    proud4,
    proud5,
    identity,
    wins,
    reflection,
    northStarReviewed,
    completed,
  } = body;

  if (!type || !["morning", "evening"].includes(type)) {
    return NextResponse.json(
      { error: "Type must be 'morning' or 'evening'" },
      { status: 400 }
    );
  }

  const date = dateStr ? startOfDay(new Date(dateStr)) : startOfDay(new Date());

  // Upsert the ritual entry
  const ritual = await prisma.ritualEntry.upsert({
    where: {
      userId_date_type: {
        userId: session.user.id,
        date,
        type,
      },
    },
    update: {
      ...(gratitude1 !== undefined && { gratitude1 }),
      ...(gratitude2 !== undefined && { gratitude2 }),
      ...(gratitude3 !== undefined && { gratitude3 }),
      ...(gratitude4 !== undefined && { gratitude4 }),
      ...(gratitude5 !== undefined && { gratitude5 }),
      ...(proud1 !== undefined && { proud1 }),
      ...(proud2 !== undefined && { proud2 }),
      ...(proud3 !== undefined && { proud3 }),
      ...(proud4 !== undefined && { proud4 }),
      ...(proud5 !== undefined && { proud5 }),
      ...(identity !== undefined && { identity }),
      ...(wins !== undefined && { wins }),
      ...(reflection !== undefined && { reflection }),
      ...(northStarReviewed !== undefined && { northStarReviewed }),
      ...(completed && { completedAt: new Date() }),
    },
    create: {
      userId: session.user.id,
      date,
      type,
      gratitude1,
      gratitude2,
      gratitude3,
      gratitude4,
      gratitude5,
      proud1,
      proud2,
      proud3,
      proud4,
      proud5,
      identity,
      wins,
      reflection,
      northStarReviewed: northStarReviewed || false,
      completedAt: completed ? new Date() : null,
    },
  });

  return NextResponse.json(ritual);
}
