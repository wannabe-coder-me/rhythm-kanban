import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const boardId = searchParams.get("boardId");

  if (boardId) {
    // Get users who are members of this board
    const members = await prisma.boardMember.findMany({
      where: { boardId },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });
    return NextResponse.json(members.map((m) => m.user));
  }

  // Get all users (limited)
  const users = await prisma.user.findMany({
    take: 50,
    select: { id: true, name: true, email: true, image: true },
  });

  return NextResponse.json(users);
}
