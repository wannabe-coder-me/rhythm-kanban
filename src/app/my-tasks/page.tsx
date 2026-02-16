"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { format, isToday, isTomorrow, isPast, isThisWeek, startOfDay } from "date-fns";
import clsx from "clsx";
import type { Priority, User } from "@/types";

interface MyTask {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  dueDate: string | null;
  completed: boolean;
  columnId: string;
  columnName: string;
  boardId: string;
  boardName: string;
  assignee: User | null;
  subtaskCount: number;
  subtaskCompleted: number;
  attachmentCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

interface TaskSummary {
  total: number;
  incomplete: number;
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
}

type GroupBy = "dueDate" | "board";
type StatusFilter = "all" | "incomplete" | "completed";
type SortBy = "dueDate" | "priority" | "board" | "updatedAt";

const priorityOrder: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const priorityColors: Record<Priority, string> = {
  low: "bg-green-500",
  medium: "bg-blue-500",
  high: "bg-amber-500",
  urgent: "bg-red-500",
};

const priorityTextColors: Record<Priority, string> = {
  low: "text-green-400",
  medium: "text-blue-400",
  high: "text-amber-400",
  urgent: "text-red-400",
};

export default function MyTasksPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [summary, setSummary] = useState<TaskSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState<GroupBy>("dueDate");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("incomplete");
  const [sortBy, setSortBy] = useState<SortBy>("dueDate");
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchTasks();
    }
  }, [session, statusFilter]);

  const fetchTasks = async () => {
    try {
      const params = new URLSearchParams();
      params.set("status", statusFilter);
      params.set("groupBy", groupBy);

      const res = await fetch(`/api/my-tasks?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks);
        setSummary(data.summary);
      }
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleComplete = async (task: MyTask) => {
    setUpdatingTaskId(task.id);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !task.completed }),
      });
      if (res.ok) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id ? { ...t, completed: !t.completed } : t
          )
        );
        // Update summary
        if (summary) {
          setSummary({
            ...summary,
            incomplete: task.completed ? summary.incomplete + 1 : summary.incomplete - 1,
          });
        }
      }
    } catch (error) {
      console.error("Failed to update task:", error);
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const updatePriority = async (task: MyTask, priority: Priority) => {
    setUpdatingTaskId(task.id);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority }),
      });
      if (res.ok) {
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, priority } : t))
        );
      }
    } catch (error) {
      console.error("Failed to update priority:", error);
    } finally {
      setUpdatingTaskId(null);
    }
  };

  // Group tasks by due date
  const groupedByDueDate = useMemo(() => {
    const groups: Record<string, MyTask[]> = {
      overdue: [],
      today: [],
      tomorrow: [],
      thisWeek: [],
      later: [],
      noDate: [],
    };

    const today = startOfDay(new Date());

    tasks.forEach((task) => {
      if (!task.dueDate) {
        groups.noDate.push(task);
      } else {
        const dueDate = new Date(task.dueDate);
        if (isPast(dueDate) && !isToday(dueDate) && !task.completed) {
          groups.overdue.push(task);
        } else if (isToday(dueDate)) {
          groups.today.push(task);
        } else if (isTomorrow(dueDate)) {
          groups.tomorrow.push(task);
        } else if (isThisWeek(dueDate)) {
          groups.thisWeek.push(task);
        } else {
          groups.later.push(task);
        }
      }
    });

    // Sort within each group by priority
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => {
        if (sortBy === "priority") {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        if (sortBy === "updatedAt") {
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        }
        // Default: sort by due date within group
        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        return 0;
      });
    });

    return groups;
  }, [tasks, sortBy]);

  // Group tasks by board
  const groupedByBoard = useMemo(() => {
    const groups: Record<string, { boardName: string; tasks: MyTask[] }> = {};

    tasks.forEach((task) => {
      if (!groups[task.boardId]) {
        groups[task.boardId] = { boardName: task.boardName, tasks: [] };
      }
      groups[task.boardId].tasks.push(task);
    });

    // Sort tasks within each board
    Object.keys(groups).forEach((key) => {
      groups[key].tasks.sort((a, b) => {
        if (sortBy === "priority") {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        if (sortBy === "updatedAt") {
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        }
        // Default: sort by due date
        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return 0;
      });
    });

    return groups;
  }, [tasks, sortBy]);

  const formatDueDate = (dueDate: string | null) => {
    if (!dueDate) return null;
    const date = new Date(dueDate);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "MMM d");
  };

  const getDueDateColor = (dueDate: string | null, completed: boolean) => {
    if (!dueDate || completed) return "text-slate-500";
    const date = new Date(dueDate);
    if (isPast(date) && !isToday(date)) return "text-red-400";
    if (isToday(date)) return "text-amber-400";
    return "text-slate-400";
  };

  const renderTaskItem = (task: MyTask) => (
    <div
      key={task.id}
      className={clsx(
        "group flex items-start gap-3 p-3 bg-slate-800/50 hover:bg-slate-800 rounded-lg transition-colors",
        task.completed && "opacity-60"
      )}
    >
      {/* Checkbox */}
      <button
        onClick={() => toggleComplete(task)}
        disabled={updatingTaskId === task.id}
        className={clsx(
          "mt-0.5 w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors",
          task.completed
            ? "bg-green-500 border-green-500 text-white"
            : "border-slate-500 hover:border-indigo-400"
        )}
      >
        {task.completed && (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* Task Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link
            href={`/boards/${task.boardId}`}
            className={clsx(
              "font-medium hover:text-indigo-400 transition-colors truncate",
              task.completed ? "text-slate-400 line-through" : "text-white"
            )}
          >
            {task.title}
          </Link>
          
          {/* Subtask indicator */}
          {task.subtaskCount > 0 && (
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {task.subtaskCompleted}/{task.subtaskCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 mt-1 text-sm">
          {/* Board/Column */}
          <Link
            href={`/boards/${task.boardId}`}
            className="text-slate-500 hover:text-slate-400 flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
            </svg>
            {task.boardName} · {task.columnName}
          </Link>

          {/* Comments */}
          {task.commentCount > 0 && (
            <span className="text-slate-500 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              {task.commentCount}
            </span>
          )}

          {/* Attachments */}
          {task.attachmentCount > 0 && (
            <span className="text-slate-500 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              {task.attachmentCount}
            </span>
          )}
        </div>
      </div>

      {/* Right side - Priority & Due Date */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Priority dropdown */}
        <div className="relative group/priority">
          <button
            className={clsx(
              "px-2 py-0.5 rounded text-xs font-medium capitalize",
              priorityColors[task.priority],
              "text-white"
            )}
          >
            {task.priority}
          </button>
          <div className="absolute right-0 top-full mt-1 hidden group-hover/priority:flex flex-col bg-slate-700 rounded-lg shadow-xl border border-slate-600 overflow-hidden z-10">
            {(["low", "medium", "high", "urgent"] as Priority[]).map((p) => (
              <button
                key={p}
                onClick={() => updatePriority(task, p)}
                className={clsx(
                  "px-3 py-1.5 text-xs text-left hover:bg-slate-600 capitalize",
                  p === task.priority ? priorityTextColors[p] : "text-slate-300"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Due date */}
        {task.dueDate && (
          <span className={clsx("text-sm whitespace-nowrap", getDueDateColor(task.dueDate, task.completed))}>
            {isPast(new Date(task.dueDate)) && !isToday(new Date(task.dueDate)) && !task.completed && (
              <span className="mr-1">🔴</span>
            )}
            {formatDueDate(task.dueDate)}
          </span>
        )}
      </div>
    </div>
  );

  const renderDueDateGroup = (
    key: string,
    label: string,
    emoji: string,
    tasks: MyTask[],
    showCount = true
  ) => {
    if (tasks.length === 0) return null;
    return (
      <div key={key} className="mb-6">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-3">
          <span>{emoji}</span>
          {label}
          {showCount && (
            <span className="text-slate-500 font-normal">({tasks.length})</span>
          )}
        </h3>
        <div className="space-y-2">{tasks.map(renderTaskItem)}</div>
      </div>
    );
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-800/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-slate-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">My Tasks</h1>
                <p className="text-sm text-slate-400">
                  {summary?.incomplete || 0} tasks to complete
                  {summary?.overdue ? (
                    <span className="text-red-400 ml-2">
                      · {summary.overdue} overdue
                    </span>
                  ) : null}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {session.user?.role === "admin" && (
              <button
                onClick={() => router.push("/admin")}
                className="text-indigo-400 hover:text-indigo-300 text-sm font-medium"
              >
                Admin
              </button>
            )}
            <span className="text-slate-400 text-sm">{session.user?.name}</span>
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

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          {/* Status Filter */}
          <div className="flex bg-slate-800 rounded-lg p-1">
            {(["incomplete", "all", "completed"] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={clsx(
                  "px-3 py-1.5 text-sm font-medium rounded transition-colors capitalize",
                  statusFilter === s
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-white"
                )}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Group By */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Group by:</span>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupBy)}
              className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="dueDate">Due Date</option>
              <option value="board">Board</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="dueDate">Due Date</option>
              <option value="priority">Priority</option>
              <option value="updatedAt">Recently Updated</option>
            </select>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-slate-800 rounded-lg p-4">
              <div className="text-2xl font-bold text-white">{summary.total}</div>
              <div className="text-sm text-slate-400">Total Tasks</div>
            </div>
            <div className="bg-slate-800 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-400">{summary.overdue}</div>
              <div className="text-sm text-slate-400">Overdue</div>
            </div>
            <div className="bg-slate-800 rounded-lg p-4">
              <div className="text-2xl font-bold text-amber-400">{summary.dueToday}</div>
              <div className="text-sm text-slate-400">Due Today</div>
            </div>
            <div className="bg-slate-800 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-400">{summary.dueThisWeek}</div>
              <div className="text-sm text-slate-400">This Week</div>
            </div>
          </div>
        )}

        {/* Tasks List */}
        {tasks.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-300 mb-2">
              {statusFilter === "completed" ? "No completed tasks" : "No tasks assigned to you"}
            </h3>
            <p className="text-slate-500">
              {statusFilter === "completed"
                ? "Tasks you complete will appear here"
                : "Tasks assigned to you will appear here"}
            </p>
          </div>
        ) : groupBy === "dueDate" ? (
          <div>
            {renderDueDateGroup("overdue", "Overdue", "🔴", groupedByDueDate.overdue)}
            {renderDueDateGroup("today", "Today", "📅", groupedByDueDate.today)}
            {renderDueDateGroup("tomorrow", "Tomorrow", "📆", groupedByDueDate.tomorrow)}
            {renderDueDateGroup("thisWeek", "This Week", "🗓️", groupedByDueDate.thisWeek)}
            {renderDueDateGroup("later", "Later", "📋", groupedByDueDate.later)}
            {renderDueDateGroup("noDate", "No Due Date", "📝", groupedByDueDate.noDate)}
          </div>
        ) : (
          <div>
            {Object.entries(groupedByBoard).map(([boardId, { boardName, tasks }]) => (
              <div key={boardId} className="mb-6">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-3">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
                  </svg>
                  <Link href={`/boards/${boardId}`} className="hover:text-indigo-400 transition-colors">
                    {boardName}
                  </Link>
                  <span className="text-slate-500 font-normal">({tasks.length})</span>
                </h3>
                <div className="space-y-2">{tasks.map(renderTaskItem)}</div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
