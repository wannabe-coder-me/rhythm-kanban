import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { subDays, startOfDay, endOfDay } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const boardId = searchParams.get("boardId");
  const userId = searchParams.get("userId");
  const action = searchParams.get("action");
  const dateRange = searchParams.get("dateRange") || "week"; // today, week, month, all
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
  const offset = parseInt(searchParams.get("offset") || "0");
  const since = searchParams.get("since"); // ISO timestamp for real-time updates

  // Get all boards the user has access to
  const userBoardIds = await prisma.boardMember.findMany({
    where: { userId: session.user.id },
    select: { boardId: true },
  });
  const accessibleBoardIds = userBoardIds.map((b) => b.boardId);

  // Build date filter
  const now = new Date();
  let dateFilter: { gte?: Date; lte?: Date } | undefined;
  
  if (since) {
    dateFilter = { gte: new Date(since) };
  } else if (dateRange !== "all") {
    const today = startOfDay(now);
    switch (dateRange) {
      case "today":
        dateFilter = { gte: today, lte: endOfDay(now) };
        break;
      case "week":
        dateFilter = { gte: subDays(today, 7) };
        break;
      case "month":
        dateFilter = { gte: subDays(today, 30) };
        break;
    }
  }

  // Build where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    task: {
      column: {
        boardId: boardId ? boardId : { in: accessibleBoardIds },
      },
    },
  };

  if (userId) {
    where.userId = userId;
  }

  if (action) {
    where.action = action;
  }

  if (dateFilter) {
    where.createdAt = dateFilter;
  }

  // Get activities
  const activities = await prisma.activity.findMany({
    where,
    include: {
      user: {
        select: { id: true, name: true, email: true, image: true },
      },
      task: {
        select: {
          id: true,
          title: true,
          completed: true,
          column: {
            select: {
              id: true,
              name: true,
              board: {
                select: { id: true, name: true },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    skip: offset,
    take: limit + 1, // +1 to check if there are more
  });

  const hasMore = activities.length > limit;
  const results = hasMore ? activities.slice(0, limit) : activities;

  // Transform for frontend
  const transformed = results.map((activity) => ({
    id: activity.id,
    action: activity.action,
    details: activity.details,
    createdAt: activity.createdAt.toISOString(),
    user: activity.user,
    task: {
      id: activity.task.id,
      title: activity.task.title,
      completed: activity.task.completed,
    },
    board: {
      id: activity.task.column.board.id,
      name: activity.task.column.board.name,
    },
    column: {
      id: activity.task.column.id,
      name: activity.task.column.name,
    },
  }));

  return NextResponse.json({
    activities: transformed,
    hasMore,
    offset,
    limit,
  });
}
