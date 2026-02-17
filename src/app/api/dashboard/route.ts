import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { subDays, startOfDay, endOfDay, addDays, format } from "date-fns";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const now = new Date();
  const today = startOfDay(now);
  const _endOfToday = endOfDay(now);
  const startOfWeek = subDays(today, today.getDay());
  const endOfWeek = addDays(startOfWeek, 6);
  const thirtyDaysAgo = subDays(today, 30);
  const sevenDaysFromNow = addDays(today, 7);

  // Get all tasks assigned to user
  const allTasks = await prisma.task.findMany({
    where: {
      assigneeId: userId,
      parentId: null,
    },
    include: {
      column: {
        include: {
          board: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  // Stats calculations
  const incompleteTasks = allTasks.filter((t) => !t.completed);
  const overdueTasks = incompleteTasks.filter(
    (t) => t.dueDate && new Date(t.dueDate) < today
  );
  const dueThisWeekTasks = incompleteTasks.filter(
    (t) =>
      t.dueDate &&
      new Date(t.dueDate) >= today &&
      new Date(t.dueDate) <= endOfWeek
  );

  // Completed this week
  const completedThisWeek = await prisma.task.count({
    where: {
      assigneeId: userId,
      completed: true,
      parentId: null,
      updatedAt: {
        gte: startOfWeek,
        lte: endOfWeek,
      },
    },
  });

  // Task distribution by status (using column names as proxy for status)
  const statusDistribution = {
    todo: 0,
    inProgress: 0,
    done: 0,
  };

  allTasks.forEach((task) => {
    const colName = task.column.name.toLowerCase();
    if (task.completed || colName.includes("done") || colName.includes("complete")) {
      statusDistribution.done++;
    } else if (
      colName.includes("progress") ||
      colName.includes("doing") ||
      colName.includes("review")
    ) {
      statusDistribution.inProgress++;
    } else {
      statusDistribution.todo++;
    }
  });

  // Task distribution by priority
  const priorityDistribution = {
    low: 0,
    medium: 0,
    high: 0,
    urgent: 0,
  };

  incompleteTasks.forEach((task) => {
    const priority = task.priority as keyof typeof priorityDistribution;
    if (priorityDistribution[priority] !== undefined) {
      priorityDistribution[priority]++;
    }
  });

  // Activity over time - tasks completed per day (last 30 days)
  const completionActivity = await prisma.task.groupBy({
    by: ["updatedAt"],
    where: {
      assigneeId: userId,
      completed: true,
      parentId: null,
      updatedAt: {
        gte: thirtyDaysAgo,
      },
    },
    _count: true,
  });

  // Aggregate by date
  const completionByDate: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const date = format(subDays(today, i), "yyyy-MM-dd");
    completionByDate[date] = 0;
  }
  
  completionActivity.forEach((item) => {
    const date = format(new Date(item.updatedAt), "yyyy-MM-dd");
    if (completionByDate[date] !== undefined) {
      completionByDate[date] += item._count;
    }
  });

  // Get actual completion counts grouped by day
  const completionData = await prisma.$queryRaw<{ date: string; count: bigint }[]>`
    SELECT DATE("updatedAt") as date, COUNT(*) as count
    FROM "Task"
    WHERE "assigneeId" = ${userId}
    AND "completed" = true
    AND "parentId" IS NULL
    AND "updatedAt" >= ${thirtyDaysAgo}
    GROUP BY DATE("updatedAt")
    ORDER BY date ASC
  `;

  completionData.forEach((item) => {
    const dateStr = format(new Date(item.date), "yyyy-MM-dd");
    if (completionByDate[dateStr] !== undefined) {
      completionByDate[dateStr] = Number(item.count);
    }
  });

  // Overdue tasks list (detailed)
  const overdueTasksList = overdueTasks.map((t) => ({
    id: t.id,
    title: t.title,
    boardId: t.column.board.id,
    boardName: t.column.board.name,
    dueDate: t.dueDate,
    daysOverdue: Math.floor(
      (today.getTime() - new Date(t.dueDate!).getTime()) / (1000 * 60 * 60 * 24)
    ),
    priority: t.priority,
  })).sort((a, b) => b.daysOverdue - a.daysOverdue);

  // Upcoming tasks (next 7 days)
  const upcomingTasks = incompleteTasks
    .filter(
      (t) =>
        t.dueDate &&
        new Date(t.dueDate) >= today &&
        new Date(t.dueDate) <= sevenDaysFromNow
    )
    .map((t) => ({
      id: t.id,
      title: t.title,
      boardId: t.column.board.id,
      boardName: t.column.board.name,
      dueDate: t.dueDate,
      priority: t.priority,
    }))
    .sort(
      (a, b) =>
        new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()
    );

  // Recent activity (last 20 actions)
  const recentActivity = await prisma.activity.findMany({
    where: {
      userId,
    },
    include: {
      task: {
        include: {
          column: {
            include: {
              board: {
                select: { id: true, name: true },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const recentActivityList = recentActivity.map((a) => ({
    id: a.id,
    action: a.action,
    details: a.details,
    taskId: a.taskId,
    taskTitle: a.task.title,
    boardId: a.task.column.board.id,
    boardName: a.task.column.board.name,
    createdAt: a.createdAt,
  }));

  // Board overview - all boards user is member of
  const boardMemberships = await prisma.boardMember.findMany({
    where: { userId },
    include: {
      board: {
        include: {
          columns: {
            include: {
              tasks: {
                where: { parentId: null },
                select: {
                  id: true,
                  completed: true,
                  assigneeId: true,
                  updatedAt: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const boardOverview = boardMemberships.map((membership) => {
    const allBoardTasks = membership.board.columns.flatMap((c) => c.tasks);
    const myTasks = allBoardTasks.filter((t) => t.assigneeId === userId);
    const openTasks = myTasks.filter((t) => !t.completed).length;
    const completedTasks = myTasks.filter((t) => t.completed).length;
    const lastActivity = allBoardTasks
      .filter((t) => t.assigneeId === userId)
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )[0]?.updatedAt;

    return {
      id: membership.board.id,
      name: membership.board.name,
      role: membership.role,
      openTasks,
      completedTasks,
      totalTasks: myTasks.length,
      lastActivity,
    };
  });

  return NextResponse.json({
    stats: {
      tasksAssigned: incompleteTasks.length,
      overdue: overdueTasks.length,
      dueThisWeek: dueThisWeekTasks.length,
      completedThisWeek,
    },
    charts: {
      statusDistribution,
      priorityDistribution,
      completionByDate,
    },
    overdueTasks: overdueTasksList.slice(0, 10),
    upcomingTasks: upcomingTasks.slice(0, 15),
    recentActivity: recentActivityList,
    boardOverview,
  });
}
