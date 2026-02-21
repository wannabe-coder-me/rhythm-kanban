import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/life/habits - Create a habit
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { identityId, title, frequency } = body;

  if (!identityId || !title) {
    return NextResponse.json(
      { error: "Identity ID and title are required" },
      { status: 400 }
    );
  }

  // Verify identity belongs to user
  const identity = await prisma.identity.findFirst({
    where: { id: identityId, userId: session.user.id },
  });

  if (!identity) {
    return NextResponse.json({ error: "Identity not found" }, { status: 404 });
  }

  const habit = await prisma.habit.create({
    data: {
      identityId,
      title,
      frequency: frequency || "daily",
    },
  });

  return NextResponse.json(habit, { status: 201 });
}
