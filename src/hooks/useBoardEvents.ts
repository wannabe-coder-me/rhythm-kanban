"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { Task, Column } from "@/types";

// Board event types (matching server)
export type BoardEvent =
  | { type: "task:created"; task: Task; userId: string }
  | { type: "task:updated"; task: Task; userId: string }
  | { type: "task:deleted"; taskId: string; userId: string }
  | { type: "task:moved"; taskId: string; columnId: string; position: number; userId: string }
  | { type: "column:created"; column: Column; userId: string }
  | { type: "column:updated"; column: Column; userId: string }
  | { type: "column:deleted"; columnId: string; userId: string }
  | { type: "column:reordered"; columnIds: string[]; userId: string }
  | { type: "user:joined"; userId: string; userName: string }
  | { type: "user:left"; userId: string }
  | { type: "init"; connectedUsers: Array<{ userId: string; userName: string }> };

interface UseBoardEventsOptions {
  onEvent: (event: BoardEvent) => void;
  enabled?: boolean;
}

export function useBoardEvents(
  boardId: string,
  { onEvent, enabled = true }: UseBoardEventsOptions
) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<Array<{ userId: string; userName: string }>>([]);

  const connect = useCallback(() => {
    if (!enabled || !boardId) return;

    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const eventSource = new EventSource(`/api/boards/${boardId}/events`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (e) => {
      try {
        const event: BoardEvent = JSON.parse(e.data);
        
        // Handle init event for connected users
        if (event.type === "init") {
          setConnectedUsers(event.connectedUsers);
        } else if (event.type === "user:joined") {
          setConnectedUsers((prev) => {
            if (prev.some((u) => u.userId === event.userId)) return prev;
            return [...prev, { userId: event.userId, userName: event.userName }];
          });
        } else if (event.type === "user:left") {
          setConnectedUsers((prev) => prev.filter((u) => u.userId !== event.userId));
        }
        
        onEvent(event);
      } catch (error) {
        console.error("Failed to parse SSE event:", error);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      eventSource.close();

      // Reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };
  }, [boardId, enabled, onEvent]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return { isConnected, connectedUsers };
}
