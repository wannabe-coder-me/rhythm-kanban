// Store active connections for activity stream
const activitySubscribers = new Map<string, Set<(data: string) => void>>();

export function emitActivity(boardIds: string[], activity: object) {
  const data = JSON.stringify(activity);
  boardIds.forEach((boardId) => {
    const subscribers = activitySubscribers.get(boardId);
    if (subscribers) {
      subscribers.forEach((send) => {
        try {
          send(data);
        } catch (e) {
          console.error("Error sending activity:", e);
        }
      });
    }
  });
}

export function subscribeToBoard(boardId: string, send: (data: string) => void) {
  if (!activitySubscribers.has(boardId)) {
    activitySubscribers.set(boardId, new Set());
  }
  activitySubscribers.get(boardId)!.add(send);
}

export function unsubscribeFromBoard(boardId: string, send: (data: string) => void) {
  const subscribers = activitySubscribers.get(boardId);
  if (subscribers) {
    subscribers.delete(send);
    if (subscribers.size === 0) {
      activitySubscribers.delete(boardId);
    }
  }
}
