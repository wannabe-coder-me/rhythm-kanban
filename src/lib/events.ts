// Use generic types to avoid strict prisma type matching
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTask = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyColumn = any;

// Board event types
export type BoardEvent =
  | { type: "task:created"; task: AnyTask; userId: string }
  | { type: "task:updated"; task: AnyTask; userId: string }
  | { type: "task:deleted"; taskId: string; userId: string }
  | { type: "task:moved"; taskId: string; columnId: string; position: number; userId: string }
  | { type: "column:created"; column: AnyColumn; userId: string }
  | { type: "column:updated"; column: AnyColumn; userId: string }
  | { type: "column:deleted"; columnId: string; userId: string }
  | { type: "column:reordered"; columnIds: string[]; userId: string }
  | { type: "user:joined"; userId: string; userName: string }
  | { type: "user:left"; userId: string };

export type BoardEventHandler = (event: BoardEvent) => void;

interface BoardSubscription {
  handler: BoardEventHandler;
  userId: string;
  userName: string;
}

// In-memory pub/sub for board events
// Maps boardId -> Set of subscribers
const boardSubscribers = new Map<string, Set<BoardSubscription>>();

// Track connected users per board
export function getConnectedUsers(boardId: string): Array<{ userId: string; userName: string }> {
  const subscribers = boardSubscribers.get(boardId);
  if (!subscribers) return [];
  
  const userMap = new Map<string, string>();
  subscribers.forEach((sub) => {
    if (!userMap.has(sub.userId)) {
      userMap.set(sub.userId, sub.userName);
    }
  });
  
  return Array.from(userMap.entries()).map(([userId, userName]) => ({ userId, userName }));
}

export function subscribe(
  boardId: string,
  handler: BoardEventHandler,
  userId: string,
  userName: string
): () => void {
  if (!boardSubscribers.has(boardId)) {
    boardSubscribers.set(boardId, new Set());
  }

  const subscription: BoardSubscription = { handler, userId, userName };
  boardSubscribers.get(boardId)!.add(subscription);

  // Check if this is the first connection for this user
  const subscribers = boardSubscribers.get(boardId)!;
  const userConnections = Array.from(subscribers).filter((s) => s.userId === userId);
  
  if (userConnections.length === 1) {
    // First connection - notify others
    emitBoardEvent(boardId, {
      type: "user:joined",
      userId,
      userName,
    });
  }

  // Return unsubscribe function
  return () => {
    const subs = boardSubscribers.get(boardId);
    if (subs) {
      subs.delete(subscription);
      
      // Check if user has no more connections
      const remainingUserConnections = Array.from(subs).filter((s) => s.userId === userId);
      if (remainingUserConnections.length === 0) {
        // Last connection - notify others
        emitBoardEvent(boardId, {
          type: "user:left",
          userId,
        });
      }
      
      if (subs.size === 0) {
        boardSubscribers.delete(boardId);
      }
    }
  };
}

export function emitBoardEvent(boardId: string, event: BoardEvent): void {
  const subscribers = boardSubscribers.get(boardId);
  if (!subscribers) return;

  subscribers.forEach((subscription) => {
    try {
      subscription.handler(event);
    } catch (error) {
      console.error("Error in board event handler:", error);
    }
  });
}

// Helper to extract boardId from a task's column
export async function getBoardIdFromTaskId(
  prisma: { task: { findUnique: (args: { where: { id: string }; select: { column: { select: { boardId: boolean } } } }) => Promise<{ column: { boardId: string } } | null> } },
  taskId: string
): Promise<string | null> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { column: { select: { boardId: true } } },
  });
  return task?.column.boardId ?? null;
}

export async function getBoardIdFromColumnId(
  prisma: { column: { findUnique: (args: { where: { id: string }; select: { boardId: boolean } }) => Promise<{ boardId: string } | null> } },
  columnId: string
): Promise<string | null> {
  const column = await prisma.column.findUnique({
    where: { id: columnId },
    select: { boardId: true },
  });
  return column?.boardId ?? null;
}
