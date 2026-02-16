import { prisma } from "./prisma";

export type NotificationType = "assigned" | "mentioned" | "comment" | "due_soon";

export const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  assigned: "👤",
  mentioned: "@",
  comment: "💬",
  due_soon: "⏰",
};

/**
 * Create a notification for a user
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  link?: string
) {
  // Don't create notification for the user who triggered the action
  // (handled by caller)
  
  return prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      link,
    },
  });
}

/**
 * Parse @mentions from text and return user IDs
 */
export async function parseMentions(
  text: string,
  boardId: string
): Promise<string[]> {
  // Match @username patterns (alphanumeric, dots, underscores, hyphens)
  const mentionPattern = /@([\w.-]+)/g;
  const matches = text.match(mentionPattern);
  
  if (!matches) return [];
  
  const usernames = matches.map((m) => m.slice(1).toLowerCase());
  
  // Find users by name or email who are board members
  const users = await prisma.user.findMany({
    where: {
      AND: [
        {
          OR: [
            { name: { in: usernames, mode: "insensitive" } },
            { email: { in: usernames.map((u) => `${u}@%`), mode: "insensitive" } },
          ],
        },
        {
          boardMembers: {
            some: { boardId },
          },
        },
      ],
    },
    select: { id: true },
  });
  
  return users.map((u) => u.id);
}

/**
 * Notify assignee when assigned to a task
 */
export async function notifyAssigned(
  assigneeId: string,
  taskTitle: string,
  taskId: string,
  boardId: string,
  assignedByName: string
) {
  await createNotification(
    assigneeId,
    "assigned",
    "You were assigned a task",
    `${assignedByName} assigned you to "${taskTitle}"`,
    `/boards/${boardId}?task=${taskId}`
  );
}

/**
 * Notify when someone comments on your task
 */
export async function notifyComment(
  recipientId: string,
  taskTitle: string,
  taskId: string,
  boardId: string,
  commenterName: string,
  isCreator: boolean
) {
  const message = isCreator
    ? `${commenterName} commented on your task "${taskTitle}"`
    : `${commenterName} commented on "${taskTitle}" (you're assigned)`;

  await createNotification(
    recipientId,
    "comment",
    "New comment on task",
    message,
    `/boards/${boardId}?task=${taskId}`
  );
}

/**
 * Notify when mentioned in a comment
 */
export async function notifyMentioned(
  mentionedUserId: string,
  taskTitle: string,
  taskId: string,
  boardId: string,
  mentionerName: string
) {
  await createNotification(
    mentionedUserId,
    "mentioned",
    "You were mentioned",
    `${mentionerName} mentioned you in "${taskTitle}"`,
    `/boards/${boardId}?task=${taskId}`
  );
}

/**
 * Notify when task is due soon
 */
export async function notifyDueSoon(
  userId: string,
  taskTitle: string,
  taskId: string,
  boardId: string,
  dueDate: Date
) {
  const timeLeft = formatTimeLeft(dueDate);
  
  await createNotification(
    userId,
    "due_soon",
    "Task due soon",
    `"${taskTitle}" is due ${timeLeft}`,
    `/boards/${boardId}?task=${taskId}`
  );
}

function formatTimeLeft(date: Date): string {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  
  if (hours <= 0) return "now";
  if (hours < 24) return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  
  const days = Math.floor(hours / 24);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}
