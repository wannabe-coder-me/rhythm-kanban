"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import Image from "next/image";
import Link from "next/link";
import clsx from "clsx";

interface ActivityUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface ActivityTask {
  id: string;
  title: string;
  completed: boolean;
}

interface ActivityBoard {
  id: string;
  name: string;
}

interface ActivityColumn {
  id: string;
  name: string;
}

interface Activity {
  id: string;
  action: string;
  details: Record<string, unknown> | null;
  createdAt: string;
  user: ActivityUser;
  task: ActivityTask;
  board: ActivityBoard;
  column: ActivityColumn;
}

interface ActivityFeedProps {
  boardId?: string;
  userId?: string;
  action?: string;
  dateRange?: string;
  limit?: number;
  compact?: boolean;
  showFilters?: boolean;
  onNewActivity?: (count: number) => void;
}

const actionIcons: Record<string, { icon: JSX.Element; color: string }> = {
  created: {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    ),
    color: "bg-indigo-500/20 text-indigo-400",
  },
  completed: {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    color: "bg-green-500/20 text-green-400",
  },
  moved: {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
    color: "bg-blue-500/20 text-blue-400",
  },
  commented: {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    color: "bg-purple-500/20 text-purple-400",
  },
  assigned: {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    color: "bg-amber-500/20 text-amber-400",
  },
  "added label": {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
    color: "bg-pink-500/20 text-pink-400",
  },
  "removed label": {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
    color: "bg-slate-500/20 text-slate-400",
  },
  "added subtask": {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    color: "bg-cyan-500/20 text-cyan-400",
  },
  "added attachment": {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
      </svg>
    ),
    color: "bg-emerald-500/20 text-emerald-400",
  },
  updated: {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    color: "bg-slate-500/20 text-slate-400",
  },
};

function getActionIcon(action: string) {
  return (
    actionIcons[action] || {
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: "bg-slate-500/20 text-slate-400",
    }
  );
}

function formatActivityMessage(activity: Activity): JSX.Element {
  const userName = activity.user.name || activity.user.email.split("@")[0];
  const taskTitle = activity.task.title;
  const boardName = activity.board.name;
  const details = activity.details as Record<string, string> | null;

  switch (activity.action) {
    case "created":
      return (
        <span>
          <span className="font-medium text-white">{userName}</span>{" "}
          created task{" "}
          <span className="font-medium text-indigo-400">&apos;{taskTitle}&apos;</span>{" "}
          in {boardName}
        </span>
      );
    case "completed":
      return (
        <span>
          <span className="font-medium text-white">{userName}</span>{" "}
          completed{" "}
          <span className="font-medium text-green-400">&apos;{taskTitle}&apos;</span>
        </span>
      );
    case "moved":
      return (
        <span>
          <span className="font-medium text-white">{userName}</span>{" "}
          moved{" "}
          <span className="font-medium text-indigo-400">&apos;{taskTitle}&apos;</span>{" "}
          {details?.from && details?.to && (
            <>
              from <span className="text-slate-300">{details.from}</span> to{" "}
              <span className="text-slate-300">{details.to}</span>
            </>
          )}
        </span>
      );
    case "commented":
      return (
        <span>
          <span className="font-medium text-white">{userName}</span>{" "}
          commented on{" "}
          <span className="font-medium text-indigo-400">&apos;{taskTitle}&apos;</span>
        </span>
      );
    case "assigned":
      return (
        <span>
          <span className="font-medium text-white">{userName}</span>{" "}
          assigned{" "}
          <span className="font-medium text-indigo-400">&apos;{taskTitle}&apos;</span>{" "}
          {details?.assignee && (
            <>
              to <span className="text-amber-400">{details.assignee}</span>
            </>
          )}
        </span>
      );
    case "added label":
      return (
        <span>
          <span className="font-medium text-white">{userName}</span>{" "}
          added label{" "}
          {details?.label && (
            <span className="text-pink-400">&apos;{details.label}&apos;</span>
          )}{" "}
          to <span className="font-medium text-indigo-400">&apos;{taskTitle}&apos;</span>
        </span>
      );
    case "removed label":
      return (
        <span>
          <span className="font-medium text-white">{userName}</span>{" "}
          removed label from{" "}
          <span className="font-medium text-indigo-400">&apos;{taskTitle}&apos;</span>
        </span>
      );
    case "added subtask":
      return (
        <span>
          <span className="font-medium text-white">{userName}</span>{" "}
          added subtask{" "}
          {details?.subtaskTitle && (
            <span className="text-cyan-400">&apos;{details.subtaskTitle}&apos;</span>
          )}{" "}
          to <span className="font-medium text-indigo-400">&apos;{taskTitle}&apos;</span>
        </span>
      );
    case "added attachment":
      return (
        <span>
          <span className="font-medium text-white">{userName}</span>{" "}
          attached a file to{" "}
          <span className="font-medium text-indigo-400">&apos;{taskTitle}&apos;</span>
        </span>
      );
    case "priority_changed":
      return (
        <span>
          <span className="font-medium text-white">{userName}</span>{" "}
          changed priority of{" "}
          <span className="font-medium text-indigo-400">&apos;{taskTitle}&apos;</span>
          {details?.priority && (
            <>
              {" "}to <span className="text-amber-400">{details.priority}</span>
            </>
          )}
        </span>
      );
    case "due_date_changed":
      return (
        <span>
          <span className="font-medium text-white">{userName}</span>{" "}
          updated due date on{" "}
          <span className="font-medium text-indigo-400">&apos;{taskTitle}&apos;</span>
        </span>
      );
    default:
      return (
        <span>
          <span className="font-medium text-white">{userName}</span>{" "}
          {activity.action}{" "}
          <span className="font-medium text-indigo-400">&apos;{taskTitle}&apos;</span>
        </span>
      );
  }
}

export function ActivityFeed({
  boardId,
  userId,
  action,
  dateRange = "week",
  limit = 50,
  compact = false,
  showFilters = false,
  onNewActivity,
}: ActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [newActivityCount, setNewActivityCount] = useState(0);
  const lastActivityId = useRef<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch activities
  const fetchActivities = useCallback(
    async (append = false) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const params = new URLSearchParams();
        if (boardId) params.set("boardId", boardId);
        if (userId) params.set("userId", userId);
        if (action) params.set("action", action);
        params.set("dateRange", dateRange);
        params.set("limit", String(limit));
        params.set("offset", String(append ? offset + limit : 0));

        const res = await fetch(`/api/activity?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (append) {
            setActivities((prev) => [...prev, ...data.activities]);
          } else {
            setActivities(data.activities);
            if (data.activities.length > 0) {
              lastActivityId.current = data.activities[0].id;
            }
          }
          setHasMore(data.hasMore);
          setOffset(data.offset + data.activities.length);
        }
      } catch (error) {
        console.error("Failed to fetch activities:", error);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [boardId, userId, action, dateRange, limit, offset]
  );

  // Initial fetch
  useEffect(() => {
    fetchActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, userId, action, dateRange]);

  // SSE for real-time updates
  useEffect(() => {
    if (compact) return; // Don't use SSE for compact mode (board widget)

    const eventSource = new EventSource("/api/activity/stream");
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "connected") return;

        // Check if this is a new activity for our filters
        if (boardId && data.board?.id !== boardId) return;
        if (userId && data.user?.id !== userId) return;
        if (action && data.action !== action) return;

        // Increment new activity counter
        setNewActivityCount((prev) => {
          const newCount = prev + 1;
          onNewActivity?.(newCount);
          return newCount;
        });
      } catch (e) {
        // Ignore parse errors (heartbeats, etc.)
      }
    };

    eventSource.onerror = () => {
      // Will auto-reconnect
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [boardId, userId, action, compact, onNewActivity]);

  // Load new activities
  const loadNewActivities = useCallback(() => {
    setNewActivityCount(0);
    fetchActivities();
  }, [fetchActivities]);

  // Load more (infinite scroll)
  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchActivities(true);
    }
  }, [loadingMore, hasMore, fetchActivities]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-start gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-slate-700" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 bg-slate-700 rounded" />
              <div className="h-3 w-1/2 bg-slate-700 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8">
        <svg
          className="w-12 h-12 mx-auto text-slate-600 mb-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="text-slate-500">No activity yet</p>
        <p className="text-sm text-slate-600 mt-1">
          Activity will appear here as tasks are created and updated
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* New activities banner */}
      {newActivityCount > 0 && (
        <button
          onClick={loadNewActivities}
          className="w-full py-2 px-4 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 rounded-lg text-indigo-400 text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {newActivityCount} new {newActivityCount === 1 ? "activity" : "activities"}
        </button>
      )}

      {/* Activity list */}
      <div className={clsx("space-y-1", compact && "max-h-80 overflow-y-auto")}>
        {activities.map((activity) => {
          const { icon, color } = getActionIcon(activity.action);
          
          return (
            <Link
              key={activity.id}
              href={`/boards/${activity.board.id}?task=${activity.task.id}`}
              className={clsx(
                "flex items-start gap-3 p-3 rounded-lg transition-colors group",
                compact
                  ? "bg-transparent hover:bg-slate-700/30"
                  : "bg-slate-800/30 hover:bg-slate-800/50"
              )}
            >
              {/* User avatar or action icon */}
              {compact ? (
                <div className={clsx("w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0", color)}>
                  {icon}
                </div>
              ) : activity.user.image ? (
                <Image
                  src={activity.user.image}
                  alt={activity.user.name || "User"}
                  width={32}
                  height={32}
                  className="rounded-full flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-medium text-indigo-400">
                    {(activity.user.name || activity.user.email)[0].toUpperCase()}
                  </span>
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className={clsx("text-slate-300 leading-relaxed", compact && "text-sm")}>
                  {formatActivityMessage(activity)}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {!compact && (
                    <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded">
                      {activity.board.name}
                    </span>
                  )}
                  <span className="text-xs text-slate-500">
                    {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </div>

              {!compact && (
                <div className={clsx("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0", color)}>
                  {icon}
                </div>
              )}
            </Link>
          );
        })}
      </div>

      {/* Load more */}
      {hasMore && !compact && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="w-full py-3 text-sm text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-2"
        >
          {loadingMore ? (
            <>
              <div className="w-4 h-4 border-2 border-slate-600 border-t-slate-300 rounded-full animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              Load more
            </>
          )}
        </button>
      )}

      {/* View all link for compact mode */}
      {compact && activities.length >= limit && (
        <Link
          href="/activity"
          className="block w-full py-2 text-center text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          View all activity →
        </Link>
      )}
    </div>
  );
}

// Compact widget for board sidebar
export function BoardActivityWidget({ boardId }: { boardId: string }) {
  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <h3 className="text-sm font-medium text-white flex items-center gap-2">
          <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Recent Activity
        </h3>
        <Link
          href={`/activity?boardId=${boardId}`}
          className="text-xs text-slate-400 hover:text-white transition-colors"
        >
          View all
        </Link>
      </div>
      <div className="p-2">
        <ActivityFeed boardId={boardId} limit={20} compact dateRange="week" />
      </div>
    </div>
  );
}
