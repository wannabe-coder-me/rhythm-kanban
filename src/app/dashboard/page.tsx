"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { format, formatDistanceToNow, isToday, isTomorrow, differenceInDays } from "date-fns";
import clsx from "clsx";
import { NotificationBell } from "@/components/NotificationBell";

interface DashboardStats {
  tasksAssigned: number;
  overdue: number;
  dueThisWeek: number;
  completedThisWeek: number;
}

interface ChartData {
  statusDistribution: {
    todo: number;
    inProgress: number;
    done: number;
  };
  priorityDistribution: {
    low: number;
    medium: number;
    high: number;
    urgent: number;
  };
  completionByDate: Record<string, number>;
}

interface OverdueTask {
  id: string;
  title: string;
  boardId: string;
  boardName: string;
  dueDate: string;
  daysOverdue: number;
  priority: string;
}

interface UpcomingTask {
  id: string;
  title: string;
  boardId: string;
  boardName: string;
  dueDate: string;
  priority: string;
}

interface ActivityItem {
  id: string;
  action: string;
  details: Record<string, unknown> | null;
  taskId: string;
  taskTitle: string;
  boardId: string;
  boardName: string;
  createdAt: string;
}

interface BoardInfo {
  id: string;
  name: string;
  role: string;
  openTasks: number;
  completedTasks: number;
  totalTasks: number;
  lastActivity: string | null;
}

interface DashboardData {
  stats: DashboardStats;
  charts: ChartData;
  overdueTasks: OverdueTask[];
  upcomingTasks: UpcomingTask[];
  recentActivity: ActivityItem[];
  boardOverview: BoardInfo[];
}

const priorityColors: Record<string, string> = {
  low: "bg-green-500",
  medium: "bg-blue-500",
  high: "bg-amber-500",
  urgent: "bg-red-500",
};

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchDashboard();
    }
  }, [session]);

  const fetchDashboard = async () => {
    try {
      const res = await fetch("/api/dashboard");
      if (res.ok) {
        const dashboardData = await res.json();
        setData(dashboardData);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatActivityAction = (action: string): string => {
    const actionMap: Record<string, string> = {
      created: "Created",
      updated: "Updated",
      completed: "Completed",
      moved: "Moved",
      commented: "Commented on",
      assigned: "Assigned",
      priority_changed: "Changed priority",
      due_date_changed: "Changed due date",
    };
    return actionMap[action] || action;
  };

  const formatDueDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    const diff = differenceInDays(date, new Date());
    if (diff > 0 && diff <= 7) return `In ${diff} days`;
    return format(date, "MMM d");
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-slate-900">
        <header className="border-b border-slate-700 bg-slate-800/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-6 w-32 bg-slate-700 rounded animate-pulse"></div>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-6 py-8">
          {/* Skeleton stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-slate-800 rounded-xl p-5 animate-pulse">
                <div className="h-8 w-16 bg-slate-700 rounded mb-2"></div>
                <div className="h-4 w-24 bg-slate-700 rounded"></div>
              </div>
            ))}
          </div>
          {/* Skeleton charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {[1, 2].map((i) => (
              <div key={i} className="bg-slate-800 rounded-xl p-6 animate-pulse">
                <div className="h-5 w-32 bg-slate-700 rounded mb-4"></div>
                <div className="h-48 bg-slate-700 rounded"></div>
              </div>
            ))}
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
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-slate-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Dashboard</h1>
                <p className="text-sm text-slate-400">Your personal work overview</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/life"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 hover:text-violet-200 transition-colors"
            >
              <span className="text-base">🧭</span>
              <span className="text-sm font-medium">Life System</span>
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

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        {data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-indigo-500/20 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{data.stats.tasksAssigned}</div>
                    <div className="text-sm text-slate-400">Tasks Assigned</div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800 rounded-xl p-5 border border-red-500/30">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-400">{data.stats.overdue}</div>
                    <div className="text-sm text-slate-400">Overdue</div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-amber-400">{data.stats.dueThisWeek}</div>
                    <div className="text-sm text-slate-400">Due This Week</div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800 rounded-xl p-5 border border-green-500/30">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-400">{data.stats.completedThisWeek}</div>
                    <div className="text-sm text-slate-400">Completed This Week</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Status Distribution */}
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-4">Task Status</h3>
                <div className="space-y-4">
                  {(() => {
                    const { todo, inProgress, done } = data.charts.statusDistribution;
                    const total = todo + inProgress + done;
                    if (total === 0) {
                      return <p className="text-slate-500 text-sm">No tasks yet</p>;
                    }
                    return (
                      <>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-slate-300">To Do</span>
                            <span className="text-slate-400">{todo}</span>
                          </div>
                          <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-slate-400 rounded-full transition-all"
                              style={{ width: `${(todo / total) * 100}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-slate-300">In Progress</span>
                            <span className="text-slate-400">{inProgress}</span>
                          </div>
                          <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full transition-all"
                              style={{ width: `${(inProgress / total) * 100}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-slate-300">Done</span>
                            <span className="text-slate-400">{done}</span>
                          </div>
                          <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full transition-all"
                              style={{ width: `${(done / total) * 100}%` }}
                            />
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Priority Distribution */}
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-4">By Priority</h3>
                <div className="space-y-4">
                  {(() => {
                    const { low, medium, high, urgent } = data.charts.priorityDistribution;
                    const total = low + medium + high + urgent;
                    if (total === 0) {
                      return <p className="text-slate-500 text-sm">No incomplete tasks</p>;
                    }
                    return (
                      <>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-green-400">Low</span>
                            <span className="text-slate-400">{low}</span>
                          </div>
                          <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full transition-all"
                              style={{ width: `${(low / total) * 100}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-blue-400">Medium</span>
                            <span className="text-slate-400">{medium}</span>
                          </div>
                          <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full transition-all"
                              style={{ width: `${(medium / total) * 100}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-amber-400">High</span>
                            <span className="text-slate-400">{high}</span>
                          </div>
                          <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full transition-all"
                              style={{ width: `${(high / total) * 100}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-red-400">Urgent</span>
                            <span className="text-slate-400">{urgent}</span>
                          </div>
                          <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-red-500 rounded-full transition-all"
                              style={{ width: `${(urgent / total) * 100}%` }}
                            />
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Completion Activity Chart */}
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-4">Completions (30 days)</h3>
                <div className="h-32 flex items-end gap-1">
                  {(() => {
                    const dates = Object.entries(data.charts.completionByDate);
                    const maxVal = Math.max(...dates.map(([, v]) => v), 1);
                    return dates.slice(-14).map(([date, count]) => (
                      <div
                        key={date}
                        className="flex-1 bg-indigo-500/30 hover:bg-indigo-500/50 rounded-t transition-colors group relative"
                        style={{ height: `${Math.max((count / maxVal) * 100, 4)}%` }}
                      >
                        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-700 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                          {format(new Date(date), "MMM d")}: {count}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
                <div className="flex justify-between text-xs text-slate-500 mt-2">
                  <span>14 days ago</span>
                  <span>Today</span>
                </div>
              </div>
            </div>

            {/* Lists Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Overdue Tasks */}
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="text-red-400">🔴</span> Overdue Tasks
                </h3>
                {data.overdueTasks.length === 0 ? (
                  <p className="text-slate-500 text-sm">No overdue tasks! 🎉</p>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {data.overdueTasks.map((task) => (
                      <Link
                        key={task.id}
                        href={`/boards/${task.boardId}`}
                        className="flex items-start gap-3 p-3 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors group"
                      >
                        <div className={clsx("w-1.5 h-12 rounded-full", priorityColors[task.priority])} />
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate group-hover:text-indigo-400 transition-colors">
                            {task.title}
                          </p>
                          <p className="text-sm text-slate-400">{task.boardName}</p>
                          <p className="text-xs text-red-400 mt-1">
                            {task.daysOverdue} day{task.daysOverdue !== 1 ? "s" : ""} overdue
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Upcoming Tasks */}
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="text-amber-400">📅</span> Due Soon
                </h3>
                {data.upcomingTasks.length === 0 ? (
                  <p className="text-slate-500 text-sm">No upcoming deadlines</p>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {data.upcomingTasks.map((task) => (
                      <Link
                        key={task.id}
                        href={`/boards/${task.boardId}`}
                        className="flex items-start gap-3 p-3 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors group"
                      >
                        <div className={clsx("w-1.5 h-12 rounded-full", priorityColors[task.priority])} />
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate group-hover:text-indigo-400 transition-colors">
                            {task.title}
                          </p>
                          <p className="text-sm text-slate-400">{task.boardName}</p>
                        </div>
                        <span
                          className={clsx(
                            "text-xs font-medium px-2 py-1 rounded",
                            isToday(new Date(task.dueDate))
                              ? "bg-amber-500/20 text-amber-400"
                              : isTomorrow(new Date(task.dueDate))
                              ? "bg-blue-500/20 text-blue-400"
                              : "bg-slate-600 text-slate-300"
                          )}
                        >
                          {formatDueDate(task.dueDate)}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Board Overview & Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Board Overview */}
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
                  </svg>
                  Your Boards
                </h3>
                {data.boardOverview.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-slate-500 text-sm mb-4">You&apos;re not a member of any boards yet</p>
                    <Link
                      href="/"
                      className="text-indigo-400 hover:text-indigo-300 text-sm font-medium"
                    >
                      Create or join a board →
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {data.boardOverview.map((board) => (
                      <Link
                        key={board.id}
                        href={`/boards/${board.id}`}
                        className="block p-4 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors group"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-white font-medium group-hover:text-indigo-400 transition-colors">
                              {board.name}
                            </p>
                            <p className="text-xs text-slate-500 capitalize">{board.role}</p>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-slate-400">{board.openTasks} open</span>
                              <span className="text-slate-600">·</span>
                              <span className="text-green-400">{board.completedTasks} done</span>
                            </div>
                            {board.lastActivity && (
                              <p className="text-xs text-slate-500 mt-1">
                                Active {formatDistanceToNow(new Date(board.lastActivity), { addSuffix: true })}
                              </p>
                            )}
                          </div>
                        </div>
                        {/* Progress bar */}
                        {board.totalTasks > 0 && (
                          <div className="mt-3 h-1.5 bg-slate-600 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full transition-all"
                              style={{
                                width: `${(board.completedTasks / board.totalTasks) * 100}%`,
                              }}
                            />
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Activity */}
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Recent Activity
                </h3>
                {data.recentActivity.length === 0 ? (
                  <p className="text-slate-500 text-sm">No recent activity</p>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {data.recentActivity.map((activity) => (
                      <Link
                        key={activity.id}
                        href={`/boards/${activity.boardId}`}
                        className="flex items-start gap-3 p-3 bg-slate-700/30 hover:bg-slate-700/50 rounded-lg transition-colors group"
                      >
                        <div
                          className={clsx(
                            "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                            activity.action === "completed"
                              ? "bg-green-500/20 text-green-400"
                              : activity.action === "created"
                              ? "bg-indigo-500/20 text-indigo-400"
                              : "bg-slate-600 text-slate-400"
                          )}
                        >
                          {activity.action === "completed" ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : activity.action === "created" ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-300">
                            <span className="text-white font-medium">
                              {formatActivityAction(activity.action)}
                            </span>{" "}
                            <span className="group-hover:text-indigo-400 transition-colors">
                              {activity.taskTitle}
                            </span>
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {activity.boardName} ·{" "}
                            {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
