import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET - Get system stats (admin only)
export async function GET() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (currentUser?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [
    totalUsers,
    adminUsers,
    managerUsers,
    regularUsers,
    activeUsers,
    totalBoards,
    privateBoards,
    teamBoards,
    publicBoards,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "admin" } }),
    prisma.user.count({ where: { role: "manager" } }),
    prisma.user.count({ where: { role: "user" } }),
    prisma.user.count({ where: { lastActiveAt: { gte: sevenDaysAgo } } }),
    prisma.board.count(),
    prisma.board.count({ where: { visibility: "private" } }),
    prisma.board.count({ where: { visibility: "team" } }),
    prisma.board.count({ where: { visibility: "public" } }),
  ]);

  return NextResponse.json({
    users: {
      total: totalUsers,
      byRole: {
        admin: adminUsers,
        manager: managerUsers,
        user: regularUsers,
      },
      activeLastWeek: activeUsers,
    },
    boards: {
      total: totalBoards,
      byVisibility: {
        private: privateBoards,
        team: teamBoards,
        public: publicBoards,
      },
    },
  });
}
