"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { NotificationBell } from "@/components/NotificationBell";
import { ActivityFeed } from "@/components/ActivityFeed";

interface Board {
  id: string;
  name: string;
}

interface User {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

const actionTypes = [
  { value: "", label: "All Actions" },
  { value: "created", label: "Created" },
  { value: "completed", label: "Completed" },
  { value: "moved", label: "Moved" },
  { value: "commented", label: "Commented" },
  { value: "assigned", label: "Assigned" },
  { value: "added label", label: "Label Added" },
  { value: "added attachment", label: "Attachment Added" },
];

const dateRanges = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "all", label: "All Time" },
];

function ActivityPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Filter state from URL params
  const [boardId, setBoardId] = useState(searchParams.get("boardId") || "");
  const [userId, setUserId] = useState(searchParams.get("userId") || "");
  const [action, setAction] = useState(searchParams.get("action") || "");
  const [dateRange, setDateRange] = useState(searchParams.get("dateRange") || "week");

  // Data for filter options
  const [boards, setBoards] = useState<Board[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [newActivityCount, setNewActivityCount] = useState(0);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Fetch boards and users for filter dropdowns
  useEffect(() => {
    if (session) {
      Promise.all([
        fetch("/api/boards").then((r) => r.json()),
        fetch("/api/users").then((r) => r.json()),
      ])
        .then(([boardsData, usersData]) => {
          setBoards(boardsData);
          setUsers(usersData);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [session]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (boardId) params.set("boardId", boardId);
    if (userId) params.set("userId", userId);
    if (action) params.set("action", action);
    if (dateRange && dateRange !== "week") params.set("dateRange", dateRange);

    const newUrl = params.toString() ? `/activity?${params.toString()}` : "/activity";
    window.history.replaceState(null, "", newUrl);
  }, [boardId, userId, action, dateRange]);

  const clearFilters = () => {
    setBoardId("");
    setUserId("");
    setAction("");
    setDateRange("week");
  };

  const hasActiveFilters = boardId || userId || action || dateRange !== "week";

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-slate-900">
        <header className="border-b border-slate-700 bg-slate-800/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="h-6 w-32 bg-slate-700 rounded animate-pulse"></div>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-6 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-slate-800 rounded-lg"></div>
            <div className="h-64 bg-slate-800 rounded-lg"></div>
          </div>
        </main>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-800/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-slate-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  Team Activity
                  {newActivityCount > 0 && (
                    <span className="text-xs bg-indigo-500 text-white px-2 py-0.5 rounded-full">
                      {newActivityCount} new
                    </span>
                  )}
                </h1>
                <p className="text-sm text-slate-400">See what your team is working on</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="text-sm font-medium">Dashboard</span>
            </Link>
            <Link
              href="/my-tasks"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <span className="text-sm font-medium">My Tasks</span>
            </Link>
            <NotificationBell />
            {session.user?.role === "admin" && (
              <button
                onClick={() => router.push("/admin")}
                className="text-indigo-400 hover:text-indigo-300 text-sm font-medium"
              >
                Admin
              </button>
            )}
            <span className="text-slate-400 text-sm hidden md:inline">{session.user?.name}</span>
            {session.user?.image && (
              <Image
                src={session.user.image}
                alt={session.user.name || "User"}
                width={32}
                height={32}
                className="rounded-full"
              />
            )}
            <button
              onClick={() => signOut()}
              className="text-slate-400 hover:text-white text-sm"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Filters */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            {/* Board filter */}
            <div className="flex-1 min-w-[200px]">
              <select
                value={boardId}
                onChange={(e) => setBoardId(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Boards</option>
                {boards.map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.name}
                  </option>
                ))}
              </select>
            </div>

            {/* User filter */}
            <div className="flex-1 min-w-[200px]">
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Users</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.email}
                  </option>
                ))}
              </select>
            </div>

            {/* Action type filter */}
            <div className="flex-1 min-w-[180px]">
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {actionTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date range filter */}
            <div className="flex items-center gap-1 bg-slate-700 rounded-lg p-0.5">
              {dateRanges.map((range) => (
                <button
                  key={range.value}
                  onClick={() => setDateRange(range.value)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    dateRange === range.value
                      ? "bg-indigo-600 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>

            {/* Clear filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-slate-400 hover:text-white text-sm transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
          <ActivityFeed
            boardId={boardId || undefined}
            userId={userId || undefined}
            action={action || undefined}
            dateRange={dateRange}
            limit={50}
            onNewActivity={setNewActivityCount}
          />
        </div>
      </main>
    </div>
  );
}

// Wrapper with Suspense for useSearchParams
export default function ActivityPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-900">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      }
    >
      <ActivityPageContent />
    </Suspense>
  );
}
