import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Pillar, TimeHorizon } from "@prisma/client";

// GET /api/life/visions - List visions (optionally by pillar)
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const pillar = searchParams.get("pillar") as Pillar | null;
  const horizon = searchParams.get("horizon") as TimeHorizon | null;

  const where: any = {
    userId: session.user.id,
    archived: false,
  };

  if (pillar) where.pillar = pillar;
  if (horizon) where.horizon = horizon;

  const visions = await prisma.vision.findMany({
    where,
    orderBy: [{ pillar: "asc" }, { order: "asc" }],
  });

  return NextResponse.json(visions);
}

// POST /api/life/visions - Create a vision
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { pillar, title, description, imageUrl, horizon } = body;

  if (!pillar || !title) {
    return NextResponse.json(
      { error: "Pillar and title are required" },
      { status: 400 }
    );
  }

  // Get max order for this pillar
  const maxOrder = await prisma.vision.aggregate({
    where: { userId: session.user.id, pillar },
    _max: { order: true },
  });

  const vision = await prisma.vision.create({
    data: {
      userId: session.user.id,
      pillar,
      title,
      description,
      imageUrl,
      horizon: horizon || "SOMEDAY",
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  return NextResponse.json(vision, { status: 201 });
}
