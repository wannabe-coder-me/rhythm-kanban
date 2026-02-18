"use client";

import { memo } from "react";
import { clsx } from "clsx";

interface PresenceIndicatorProps {
  users: Array<{ userId: string; userName: string }>;
  currentUserId?: string;
  maxVisible?: number;
}

// Generate a consistent color from a string
function stringToColor(str: string): string {
  const colors = [
    "bg-rose-500",
    "bg-pink-500",
    "bg-fuchsia-500",
    "bg-purple-500",
    "bg-violet-500",
    "bg-indigo-500",
    "bg-blue-500",
    "bg-sky-500",
    "bg-cyan-500",
    "bg-teal-500",
    "bg-emerald-500",
    "bg-green-500",
    "bg-lime-500",
    "bg-yellow-500",
    "bg-amber-500",
    "bg-orange-500",
  ];
  
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// Custom comparison to prevent re-renders when users array has same content
function arePropsEqual(
  prev: PresenceIndicatorProps,
  next: PresenceIndicatorProps
): boolean {
  if (prev.currentUserId !== next.currentUserId) return false;
  if (prev.maxVisible !== next.maxVisible) return false;
  if (prev.users.length !== next.users.length) return false;
  
  // Compare user IDs only (names don't change often)
  const prevIds = prev.users.map(u => u.userId).sort().join(',');
  const nextIds = next.users.map(u => u.userId).sort().join(',');
  return prevIds === nextIds;
}

export const PresenceIndicator = memo(function PresenceIndicator({
  users,
  currentUserId,
  maxVisible = 5,
}: PresenceIndicatorProps) {
  // Filter out current user and dedupe
  const otherUsers = users.filter((u) => u.userId !== currentUserId);
  const visibleUsers = otherUsers.slice(0, maxVisible);
  const hiddenCount = Math.max(0, otherUsers.length - maxVisible);

  if (otherUsers.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {visibleUsers.map((user, index) => (
          <div
            key={user.userId}
            className={clsx(
              "w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium ring-2 ring-slate-800",
              stringToColor(user.userId)
            )}
            style={{ zIndex: maxVisible - index }}
            title={user.userName}
          >
            {getInitials(user.userName)}
          </div>
        ))}
        {hiddenCount > 0 && (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-600 text-white text-xs font-medium ring-2 ring-slate-800"
            title={`${hiddenCount} more user${hiddenCount > 1 ? "s" : ""}`}
          >
            +{hiddenCount}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1">
        <span className="inline-flex rounded-full h-2 w-2 bg-green-500"></span>
        <span className="text-xs text-slate-400">
          {otherUsers.length} online
        </span>
      </div>
    </div>
  );
}, arePropsEqual);
