import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Pillar } from "@prisma/client";

// GET /api/life/north-stars - Get active North Stars
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("active") !== "false";
  const pillar = searchParams.get("pillar") as Pillar | null;

  const where: any = {
    userId: session.user.id,
  };

  if (activeOnly) where.active = true;
  if (pillar) where.pillar = pillar;

  const northStars = await prisma.northStar.findMany({
    where,
    include: {
      milestones: {
        orderBy: { order: "asc" },
      },
      _count: {
        select: {
          actions: true,
        },
      },
    },
    orderBy: { pillar: "asc" },
  });

  // Also get count of completed actions
  const withStats = await Promise.all(
    northStars.map(async (ns) => {
      const completedActions = await prisma.task.count({
        where: {
          northStarId: ns.id,
          completed: true,
        },
      });
      return {
        ...ns,
        completedActions,
        totalActions: ns._count.actions,
      };
    })
  );

  return NextResponse.json(withStats);
}

// POST /api/life/north-stars - Create or update a North Star
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { pillar, title, description, targetDate } = body;

  if (!pillar || !title) {
    return NextResponse.json(
      { error: "Pillar and title are required" },
      { status: 400 }
    );
  }

  // Deactivate any existing active North Star for this pillar
  await prisma.northStar.updateMany({
    where: {
      userId: session.user.id,
      pillar,
      active: true,
    },
    data: { active: false },
  });

  // Create new North Star
  const northStar = await prisma.northStar.create({
    data: {
      userId: session.user.id,
      pillar,
      title,
      description,
      targetDate: targetDate ? new Date(targetDate) : null,
      active: true,
    },
  });

  return NextResponse.json(northStar, { status: 201 });
}
