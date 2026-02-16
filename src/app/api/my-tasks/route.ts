import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "all"; // all, incomplete, completed
  const dueDateFrom = searchParams.get("dueDateFrom");
  const dueDateTo = searchParams.get("dueDateTo");
  const groupBy = searchParams.get("groupBy") || "dueDate"; // dueDate or board

  // Build where clause
  const where: Record<string, unknown> = {
    assigneeId: session.user.id,
    parentId: null, // Exclude subtasks
  };

  if (status === "incomplete") {
    where.completed = false;
  } else if (status === "completed") {
    where.completed = true;
  }

  if (dueDateFrom || dueDateTo) {
    where.dueDate = {};
    if (dueDateFrom) {
      (where.dueDate as Record<string, Date>).gte = new Date(dueDateFrom);
    }
    if (dueDateTo) {
      (where.dueDate as Record<string, Date>).lte = new Date(dueDateTo);
    }
  }

  // Fetch all tasks assigned to the user
  const tasks = await prisma.task.findMany({
    where,
    include: {
      column: {
        include: {
          board: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      assignee: true,
      subtasks: {
        select: {
          id: true,
          completed: true,
        },
      },
      _count: {
        select: {
          attachments: true,
          comments: true,
        },
      },
    },
    orderBy: [
      { dueDate: { sort: "asc", nulls: "last" } },
      { priority: "desc" },
      { updatedAt: "desc" },
    ],
  });

  // Transform tasks with board/column info
  const enrichedTasks = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    priority: task.priority,
    dueDate: task.dueDate,
    completed: task.completed,
    columnId: task.columnId,
    columnName: task.column.name,
    boardId: task.column.board.id,
    boardName: task.column.board.name,
    assignee: task.assignee,
    subtaskCount: task.subtasks.length,
    subtaskCompleted: task.subtasks.filter((s) => s.completed).length,
    attachmentCount: task._count.attachments,
    commentCount: task._count.comments,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  }));

  // Get counts for summary
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const endOfWeek = new Date(today);
  endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));

  const summary = {
    total: enrichedTasks.length,
    incomplete: enrichedTasks.filter((t) => !t.completed).length,
    overdue: enrichedTasks.filter(
      (t) => !t.completed && t.dueDate && new Date(t.dueDate) < today
    ).length,
    dueToday: enrichedTasks.filter(
      (t) =>
        !t.completed &&
        t.dueDate &&
        new Date(t.dueDate) >= today &&
        new Date(t.dueDate) < tomorrow
    ).length,
    dueThisWeek: enrichedTasks.filter(
      (t) =>
        !t.completed &&
        t.dueDate &&
        new Date(t.dueDate) >= today &&
        new Date(t.dueDate) <= endOfWeek
    ).length,
  };

  return NextResponse.json({
    tasks: enrichedTasks,
    summary,
    groupBy,
  });
}
