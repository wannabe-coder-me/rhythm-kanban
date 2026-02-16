"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback, useMemo, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Board, Column, Task, User, Label } from "@/types";
import { Calendar, CalendarListView } from "@/components/Calendar";
import { TaskDetailPanel } from "@/components/TaskDetailPanel";
import { FilterBar } from "@/components/FilterBar";
import { useFilters } from "@/hooks/useFilters";
import { NotificationBell } from "@/components/NotificationBell";

function CalendarViewContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const boardId = params.id as string;

  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [availableLabels, setAvailableLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddDate, setQuickAddDate] = useState<Date | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  // Use the shared filter system
  const {
    filters,
    updateFilters,
    clearFilters,
    activeFilterCount,
    hasActiveFilters,
    filterTasks,
  } = useFilters();

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const fetchBoard = useCallback(async () => {
    try {
      const res = await fetch(`/api/boards/${boardId}`);
      if (res.ok) {
        const data = await res.json();
        setBoard(data);
        setColumns(data.columns || []);
      } else {
        router.push("/");
      }
    } catch (error) {
      console.error("Failed to fetch board:", error);
    } finally {
      setLoading(false);
    }
  }, [boardId, router]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`/api/users?boardId=${boardId}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  }, [boardId]);

  const fetchLabels = useCallback(async () => {
    try {
      const res = await fetch(`/api/boards/${boardId}/labels`);
      if (res.ok) {
        const data = await res.json();
        setAvailableLabels(data);
      }
    } catch (error) {
      console.error("Failed to fetch labels:", error);
    }
  }, [boardId]);

  useEffect(() => {
    if (session) {
      fetchBoard();
      fetchUsers();
      fetchLabels();
    }
  }, [session, fetchBoard, fetchUsers, fetchLabels]);

  // Collect all unique labels from tasks
  const allLabels = useMemo(() => {
    const labelMap = new Map<string, { id: string; name: string }>();
    columns.forEach((col) => {
      col.tasks?.forEach((task) => {
        task.labels?.forEach((label) => {
          if (typeof label === "string") {
            labelMap.set(label, { id: label, name: label });
          } else {
            labelMap.set(label.id, { id: label.id, name: label.name });
          }
        });
      });
    });
    return Array.from(labelMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [columns]);

  // Get all tasks flattened (excluding subtasks)
  const allTasks = useMemo(() => {
    return columns.flatMap((col) =>
      (col.tasks || [])
        .filter((task) => !task.parentId)
        .map((task) => ({
          ...task,
          column: col,
        }))
    );
  }, [columns]);

  // Filter tasks using the shared filter hook
  const filteredTasks = useMemo(() => {
    return filterTasks(allTasks);
  }, [allTasks, filterTasks]);

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
  };

  const handleDateClick = (date: Date) => {
    setQuickAddDate(date);
    setShowQuickAdd(true);
    setQuickAddTitle("");
  };

  const handleTaskMove = async (taskId: string, newDueDate: Date) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueDate: newDueDate }),
      });
      if (res.ok) {
        fetchBoard();
      }
    } catch (error) {
      console.error("Failed to move task:", error);
    }
  };

  const handleQuickAdd = async () => {
    if (!quickAddTitle.trim() || !quickAddDate || columns.length === 0) return;

    // Use the first column as default
    const defaultColumnId = columns[0].id;

    try {
      const res = await fetch(`/api/columns/${defaultColumnId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: quickAddTitle,
          dueDate: quickAddDate,
        }),
      });
      if (res.ok) {
        setShowQuickAdd(false);
        setQuickAddTitle("");
        setQuickAddDate(null);
        fetchBoard();
      }
    } catch (error) {
      console.error("Failed to create task:", error);
    }
  };

  const handleUpdateTask = async (
    taskId: string,
    updates: Partial<Task> & { labelIds?: string[] }
  ) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const updatedTask = await res.json();
        // Update local state
        setColumns((prev) =>
          prev.map((col) => {
            if (updates.columnId && col.id === updates.columnId) {
              const filtered = col.tasks?.filter((t) => t.id !== taskId) || [];
              return { ...col, tasks: [...filtered, updatedTask] };
            }
            if (col.tasks?.some((t) => t.id === taskId)) {
              if (updates.columnId && updates.columnId !== col.id) {
                return { ...col, tasks: col.tasks.filter((t) => t.id !== taskId) };
              }
              return {
                ...col,
                tasks: col.tasks.map((t) => (t.id === taskId ? updatedTask : t)),
              };
            }
            return col;
          })
        );
        if (selectedTask?.id === taskId) {
          setSelectedTask(updatedTask);
        }
      }
    } catch (error) {
      console.error("Failed to update task:", error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Delete this task?")) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (res.ok) {
        setColumns((prev) =>
          prev.map((col) => ({
            ...col,
            tasks: col.tasks?.filter((t) => t.id !== taskId) || [],
          }))
        );
        setSelectedTask(null);
      }
    } catch (error) {
      console.error("Failed to delete task:", error);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!session || !board) return null;

  return (
    <div className="h-screen flex flex-col bg-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-800/50 backdrop-blur-sm shrink-0">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/boards/${boardId}`}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">{board.name}</h1>
              <p className="text-sm text-slate-400">Calendar View</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* View Switcher */}
            <div className="hidden sm:flex items-center bg-slate-700 rounded-lg p-0.5">
              <Link
                href={`/boards/${boardId}`}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-white rounded-md transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                  />
                </svg>
                Kanban
              </Link>
              <Link
                href={`/boards/${boardId}/table`}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-white rounded-md transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 10h16M4 14h16M4 18h16"
                  />
                </svg>
                Table
              </Link>
              <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-slate-600 rounded-md">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                Calendar
              </div>
            </div>

            <NotificationBell />
            {session.user?.image && (
              <Image
                src={session.user.image}
                alt={session.user.name || "User"}
                width={32}
                height={32}
                className="rounded-full"
              />
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="px-6 pb-3">
          <FilterBar
            filters={filters}
            onFilterChange={updateFilters}
            onClearFilters={clearFilters}
            activeFilterCount={activeFilterCount}
            users={users}
            allLabels={allLabels}
          />
        </div>
      </header>

      {/* No results message */}
      {hasActiveFilters && filteredTasks.length === 0 && allTasks.length > 0 && (
        <div className="mx-6 mt-4 p-4 bg-slate-800/50 border border-slate-700 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg
              className="w-5 h-5 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
            <span className="text-slate-300">
              No tasks match your filters. {allTasks.length} task
              {allTasks.length !== 1 ? "s" : ""} hidden.
            </span>
          </div>
          <button
            onClick={clearFilters}
            className="text-indigo-400 hover:text-indigo-300 text-sm font-medium"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Calendar */}
      <div className="flex-1 overflow-hidden p-6">
        {isMobile ? (
          <CalendarListView
            tasks={filteredTasks}
            onTaskClick={handleTaskClick}
            onDateClick={handleDateClick}
          />
        ) : (
          <Calendar
            tasks={filteredTasks}
            onTaskClick={handleTaskClick}
            onDateClick={handleDateClick}
            onTaskMove={handleTaskMove}
          />
        )}
      </div>

      {/* Quick Add Modal */}
      {showQuickAdd && quickAddDate && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setShowQuickAdd(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-800 rounded-lg p-6 z-50 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-4">
              Add Task for{" "}
              {quickAddDate.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </h3>
            <input
              type="text"
              value={quickAddTitle}
              onChange={(e) => setQuickAddTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleQuickAdd();
                if (e.key === "Escape") setShowQuickAdd(false);
              }}
              placeholder="Task title..."
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowQuickAdd(false)}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleQuickAdd}
                disabled={!quickAddTitle.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                Add Task
              </button>
            </div>
          </div>
        </>
      )}

      {/* Task Detail Panel */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          columns={columns}
          users={users}
          boardId={boardId}
          availableLabels={availableLabels}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleUpdateTask}
          onDelete={handleDeleteTask}
          onLabelsChange={() => {
            fetchLabels();
            fetchBoard();
          }}
        />
      )}
    </div>
  );
}

// Wrapper with Suspense
export default function CalendarViewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-900">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      }
    >
      <CalendarViewContent />
    </Suspense>
  );
}
