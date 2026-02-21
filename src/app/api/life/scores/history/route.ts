import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/life/scores/history - Get score history
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scores = await prisma.lifeScore.findMany({
    where: { userId: session.user.id },
    orderBy: { weekStart: "desc" },
    take: 52, // Last year of weeks
  });

  return NextResponse.json(scores);
}
