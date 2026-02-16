import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";

// Types for activity data
export interface ActivityData {
  id: string;
  action: string;
  details: Record<string, unknown> | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  task: {
    id: string;
    title: string;
    completed: boolean;
  };
  board: {
    id: string;
    name: string;
  };
  column: {
    id: string;
    name: string;
  };
}

// Store active connections for activity stream
type SendFunction = (data: string) => void;
const activitySubscribers = new Map<string, Set<SendFunction>>();

/**
 * Subscribe to activity events for specific board IDs
 */
export function subscribeToActivity(
  boardIds: string[],
  send: SendFunction
): () => void {
  boardIds.forEach((boardId) => {
    if (!activitySubscribers.has(boardId)) {
      activitySubscribers.set(boardId, new Set());
    }
    activitySubscribers.get(boardId)!.add(send);
  });

  // Return unsubscribe function
  return () => {
    boardIds.forEach((boardId) => {
      const subscribers = activitySubscribers.get(boardId);
      if (subscribers) {
        subscribers.delete(send);
        if (subscribers.size === 0) {
          activitySubscribers.delete(boardId);
        }
      }
    });
  };
}

/**
 * Emit an activity to all subscribers of the given board
 */
export function emitActivityEvent(boardId: string, activity: ActivityData): void {
  const subscribers = activitySubscribers.get(boardId);
  if (!subscribers) return;

  const data = JSON.stringify(activity);
  subscribers.forEach((send) => {
    try {
      send(data);
    } catch (e) {
      console.error("Error sending activity:", e);
    }
  });
}

/**
 * Create an activity record and emit it to subscribers
 */
export async function createAndEmitActivity(
  taskId: string,
  userId: string,
  action: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    // Create the activity record with full includes
    const activity = await prisma.activity.create({
      data: {
        taskId,
        userId,
        action,
        details: details ? (details as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
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
    });

    // Transform and emit
    const activityData: ActivityData = {
      id: activity.id,
      action: activity.action,
      details: activity.details as Record<string, unknown> | null,
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
    };

    emitActivityEvent(activity.task.column.board.id, activityData);
  } catch (error) {
    console.error("Failed to create/emit activity:", error);
    // Don't throw - activity logging shouldn't break the main operation
  }
}
