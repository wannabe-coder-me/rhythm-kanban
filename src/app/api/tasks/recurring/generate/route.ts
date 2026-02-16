import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseRecurrenceRule, getNextOccurrence } from "@/lib/recurrence";
import { startOfDay, isAfter, isBefore, addDays } from "date-fns";

/**
 * POST /api/tasks/recurring/generate
 * Generate instances for recurring tasks that are due
 * Called on board load or via scheduled job
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { boardId } = body;

  try {
    // Find recurring tasks that need instances generated
    const whereClause: {
      isRecurring: boolean;
      parentRecurringId: null;
      column?: { board: { members: { some: { userId: string } } }; boardId?: string };
    } = {
      isRecurring: true,
      parentRecurringId: null, // Only template tasks, not instances
    };

    if (boardId) {
      whereClause.column = {
        boardId,
        board: { members: { some: { userId: session.user.id } } },
      };
    } else {
      whereClause.column = {
        board: { members: { some: { userId: session.user.id } } },
      };
    }

    const recurringTasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        column: true,
        labels: true,
        _count: { select: { recurringInstances: true } },
      },
    });

    const today = startOfDay(new Date());
    const created: { taskId: string; instanceId: string; dueDate: Date }[] = [];

    for (const task of recurringTasks) {
      const rule = parseRecurrenceRule(task.recurrenceRule);
      if (!rule) continue;

      // Check end conditions
      if (rule.endType === "count" && rule.endCount) {
        const instanceCount = task._count.recurringInstances;
        if (instanceCount >= rule.endCount) continue;
      }

      if (rule.endType === "date" && rule.endDate) {
        if (isAfter(today, new Date(rule.endDate))) continue;
      }

      // Calculate next occurrence
      const nextOccurrence = getNextOccurrence(rule, task.dueDate, task.lastRecurrence);
      if (!nextOccurrence) continue;

      // Only create if next occurrence is within the next 7 days
      const lookAhead = addDays(today, 7);
      if (isAfter(nextOccurrence, lookAhead)) continue;

      // Check if instance for this date already exists
      const existingInstance = await prisma.task.findFirst({
        where: {
          parentRecurringId: task.id,
          dueDate: nextOccurrence,
        },
      });

      if (existingInstance) continue;

      // Create new instance
      const instance = await prisma.task.create({
        data: {
          columnId: task.columnId,
          title: task.title,
          description: task.description,
          position: 0, // Will be repositioned
          priority: task.priority,
          dueDate: nextOccurrence,
          completed: false,
          assigneeId: task.assigneeId,
          createdById: task.createdById,
          parentRecurringId: task.id,
          isRecurring: false, // Instance is not a recurring template
          labels: {
            connect: task.labels.map(l => ({ id: l.id })),
          },
        },
      });

      // Update template's lastRecurrence
      await prisma.task.update({
        where: { id: task.id },
        data: { lastRecurrence: nextOccurrence },
      });

      // Reposition: put at top of column
      await prisma.task.updateMany({
        where: {
          columnId: task.columnId,
          id: { not: instance.id },
        },
        data: {
          position: { increment: 1 },
        },
      });

      created.push({
        taskId: task.id,
        instanceId: instance.id,
        dueDate: nextOccurrence,
      });
    }

    return NextResponse.json({
      success: true,
      generated: created.length,
      instances: created,
    });
  } catch (error) {
    console.error("Error generating recurring instances:", error);
    return NextResponse.json(
      { error: "Failed to generate instances" },
      { status: 500 }
    );
  }
}
