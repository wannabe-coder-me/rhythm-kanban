"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback, useMemo, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Board, Column, Task, User, Priority } from "@/types";
import { format } from "date-fns";
import clsx from "clsx";
import { FilterBar } from "@/components/FilterBar";
import { useFilters } from "@/hooks/useFilters";

type SortField = "title" | "status" | "assignee" | "dueDate" | "priority";
type SortOrder = "asc" | "desc";

const priorityOrder: Record<Priority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const priorityColors: Record<Priority, string> = {
  low: "bg-green-500/20 text-green-400",
  medium: "bg-blue-500/20 text-blue-400",
  high: "bg-amber-500/20 text-amber-400",
  urgent: "bg-red-500/20 text-red-400",
};

function TableViewContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const boardId = params.id as string;

  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterColumn, setFilterColumn] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("title");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{
    taskId: string;
    field: string;
  } | null>(null);

  // Use the shared filter system
  const {
    filters,
    updateFilters,
    clearFilters,
    activeFilterCount,
    hasActiveFilters,
    filterTasks,
  } = useFilters();

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

  useEffect(() => {
    if (session) {
      fetchBoard();
      fetchUsers();
    }
  }, [session, fetchBoard, fetchUsers]);

  // Collect all unique labels from tasks (Label objects have id, name, color)
  const allLabels = useMemo(() => {
    const labelMap = new Map<string, { id: string; name: string }>();
    columns.forEach((col) => {
      col.tasks?.forEach((task) => {
        task.labels?.forEach((label) => {
          if (typeof label === 'string') {
            labelMap.set(label, { id: label, name: label });
          } else {
            labelMap.set(label.id, { id: label.id, name: label.name });
          }
        });
      });
    });
    return Array.from(labelMap.values()).sort((a, b) => a.name.localeCompare(b.name));
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

  // Filter tasks using the shared filter hook, then apply column filter
  const filteredTasks = useMemo(() => {
    const filtered = filterTasks(allTasks);
    // Apply column filter on top
    if (filterColumn === "all") return filtered;
    return filtered.filter((task) => task.columnId === filterColumn);
  }, [allTasks, filterTasks, filterColumn]);

  // Sort tasks
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    let comparison = 0;

    switch (sortField) {
      case "title":
        comparison = a.title.localeCompare(b.title);
        break;
      case "status":
        comparison = (a.column?.position ?? 0) - (b.column?.position ?? 0);
        break;
      case "assignee":
        comparison = (a.assignee?.name || "").localeCompare(b.assignee?.name || "");
        break;
      case "dueDate":
        const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        comparison = dateA - dateB;
        break;
      case "priority":
        comparison =
          priorityOrder[b.priority as Priority] - priorityOrder[a.priority as Priority];
        break;
    }

    return sortOrder === "asc" ? comparison : -comparison;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const toggleSelectAll = () => {
    if (selectedTasks.size === sortedTasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(sortedTasks.map((t) => t.id)));
    }
  };

  const toggleSelect = (taskId: string) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId);
    } else {
      newSelected.add(taskId);
    }
    setSelectedTasks(newSelected);
  };

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        fetchBoard();
      }
    } catch (error) {
      console.error("Failed to update task:", error);
    }
    setEditingCell(null);
  };

  const bulkAction = async (action: "move" | "assign" | "delete", value?: string) => {
    if (selectedTasks.size === 0) return;

    if (action === "delete") {
      if (!confirm(`Delete ${selectedTasks.size} tasks?`)) return;
      for (const taskId of selectedTasks) {
        await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      }
    } else {
      const updates: Partial<Task> = {};
      if (action === "move" && value) updates.columnId = value;
      if (action === "assign") updates.assigneeId = value || null;

      for (const taskId of selectedTasks) {
        await fetch(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
      }
    }

    setSelectedTasks(new Set());
    fetchBoard();
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <svg
      className={clsx(
        "w-4 h-4 transition-colors",
        sortField === field ? "text-indigo-400" : "text-slate-600"
      )}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      {sortField === field && sortOrder === "desc" ? (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      )}
    </svg>
  );

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!session || !board) return null;

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-800/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/boards/${boardId}`} className="text-slate-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">{board.name}</h1>
              <p className="text-sm text-slate-400">Table View</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* View Switcher */}
            <div className="hidden sm:flex items-center bg-slate-700 rounded-lg p-0.5">
              <Link
                href={`/boards/${boardId}`}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-white rounded-md transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
                Kanban
              </Link>
              <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-slate-600 rounded-md">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                Table
              </div>
              <Link
                href={`/boards/${boardId}/calendar`}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-white rounded-md transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Calendar
              </Link>
              <Link
                href={`/boards/${boardId}/timeline`}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-white rounded-md transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Timeline
              </Link>
            </div>
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

        {/* Filters & Bulk Actions */}
        <div className="px-6 pb-3 flex items-center gap-4 flex-wrap">
          <FilterBar
            filters={filters}
            onFilterChange={updateFilters}
            onClearFilters={clearFilters}
            activeFilterCount={activeFilterCount}
            users={users}
            allLabels={allLabels}
          />
          
          {/* Column/Status filter - specific to table view */}
          <select
            value={filterColumn}
            onChange={(e) => setFilterColumn(e.target.value)}
            className={clsx(
              "bg-slate-700 border rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500",
              filterColumn !== "all" ? "border-indigo-500" : "border-slate-600"
            )}
          >
            <option value="all">All Status</option>
            {columns.map((col) => (
              <option key={col.id} value={col.id}>
                {col.name}
              </option>
            ))}
          </select>

          {selectedTasks.size > 0 && (
            <>
              <div className="h-6 border-l border-slate-600" />
              <span className="text-sm text-slate-400">
                {selectedTasks.size} selected
              </span>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    bulkAction("move", e.target.value);
                    e.target.value = "";
                  }
                }}
                className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                defaultValue=""
              >
                <option value="">Move to...</option>
                {columns.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.name}
                  </option>
                ))}
              </select>
              <select
                onChange={(e) => {
                  bulkAction("assign", e.target.value || undefined);
                  e.target.value = "";
                }}
                className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                defaultValue=""
              >
                <option value="">Assign to...</option>
                <option value="">Unassigned</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.email}
                  </option>
                ))}
              </select>
              <button
                onClick={() => bulkAction("delete")}
                className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm rounded-lg transition-colors"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </header>

      {/* Table */}
      <div className="overflow-x-auto px-6 py-4">
        <table className="w-full border-collapse">
          <thead className="bg-slate-800 border-b border-slate-600">
            <tr>
              <th className="w-6 px-1 py-1.5 text-left">
                <input
                  type="checkbox"
                  checked={selectedTasks.size === sortedTasks.length && sortedTasks.length > 0}
                  onChange={toggleSelectAll}
                  className="w-[11px] h-[11px] rounded-sm border-slate-600 bg-slate-700 text-indigo-500 focus:ring-0"
                />
              </th>
              <th
                className="px-3 py-1.5 text-left text-xs font-medium text-slate-300 cursor-pointer hover:text-white"
                onClick={() => handleSort("title")}
              >
                <div className="flex items-center gap-1">
                  Title
                  <SortIcon field="title" />
                </div>
              </th>
              <th
                className="px-3 py-1.5 text-left text-xs font-medium text-slate-300 cursor-pointer hover:text-white"
                onClick={() => handleSort("status")}
              >
                <div className="flex items-center gap-1">
                  Status
                  <SortIcon field="status" />
                </div>
              </th>
              <th
                className="px-3 py-1.5 text-left text-xs font-medium text-slate-300 cursor-pointer hover:text-white"
                onClick={() => handleSort("assignee")}
              >
                <div className="flex items-center gap-1">
                  Assignee
                  <SortIcon field="assignee" />
                </div>
              </th>
              <th
                className="px-3 py-1.5 text-left text-xs font-medium text-slate-300 cursor-pointer hover:text-white"
                onClick={() => handleSort("dueDate")}
              >
                <div className="flex items-center gap-1">
                  Due Date
                  <SortIcon field="dueDate" />
                </div>
              </th>
              <th
                className="px-3 py-1.5 text-left text-xs font-medium text-slate-300 cursor-pointer hover:text-white"
                onClick={() => handleSort("priority")}
              >
                <div className="flex items-center gap-1">
                  Priority
                  <SortIcon field="priority" />
                </div>
              </th>
              <th className="px-3 py-1.5 text-left text-xs font-medium text-slate-300">
                Subtasks
              </th>
              <th className="px-3 py-1.5 text-left text-xs font-medium text-slate-300">
                Labels
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {sortedTasks.map((task) => (
              <tr
                key={task.id}
                className={clsx(
                  "hover:bg-slate-800/50 transition-colors",
                  selectedTasks.has(task.id) && "bg-indigo-500/10"
                )}
              >
                <td className="px-1 py-1">
                  <input
                    type="checkbox"
                    checked={selectedTasks.has(task.id)}
                    onChange={() => toggleSelect(task.id)}
                    className="w-[11px] h-[11px] rounded-sm border-slate-600 bg-slate-700 text-indigo-500 focus:ring-0"
                  />
                </td>
                <td className="px-3 py-1">
                  {editingCell?.taskId === task.id && editingCell?.field === "title" ? (
                    <input
                      type="text"
                      defaultValue={task.title}
                      autoFocus
                      onBlur={(e) => updateTask(task.id, { title: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          updateTask(task.id, { title: e.currentTarget.value });
                        }
                        if (e.key === "Escape") {
                          setEditingCell(null);
                        }
                      }}
                      className="w-full bg-slate-700 border border-indigo-500 rounded px-1.5 py-0.5 text-sm text-white focus:outline-none"
                    />
                  ) : (
                    <span
                      onClick={() => setEditingCell({ taskId: task.id, field: "title" })}
                      className="text-sm text-white cursor-pointer hover:text-indigo-400"
                    >
                      {task.title}
                    </span>
                  )}
                </td>
                <td className="px-3 py-1">
                  <select
                    value={task.columnId}
                    onChange={(e) => updateTask(task.id, { columnId: e.target.value })}
                    className="bg-transparent border-none text-xs text-slate-300 focus:outline-none cursor-pointer hover:text-white"
                  >
                    {columns.map((col) => (
                      <option key={col.id} value={col.id} className="bg-slate-700">
                        {col.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-1">
                  <select
                    value={task.assigneeId || ""}
                    onChange={(e) =>
                      updateTask(task.id, { assigneeId: e.target.value || null })
                    }
                    className="bg-transparent border-none text-xs text-slate-300 focus:outline-none cursor-pointer hover:text-white"
                  >
                    <option value="" className="bg-slate-700">
                      Unassigned
                    </option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id} className="bg-slate-700">
                        {user.name || user.email}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-1">
                  <input
                    type="date"
                    value={task.dueDate ? format(new Date(task.dueDate), "yyyy-MM-dd") : ""}
                    onChange={(e) =>
                      updateTask(task.id, {
                        dueDate: e.target.value ? new Date(e.target.value) : null,
                      })
                    }
                    className="bg-transparent border-none text-xs text-slate-300 focus:outline-none cursor-pointer hover:text-white [color-scheme:dark]"
                  />
                </td>
                <td className="px-3 py-1">
                  <select
                    value={task.priority}
                    onChange={(e) => updateTask(task.id, { priority: e.target.value as Priority })}
                    className={clsx(
                      "px-1.5 py-0.5 rounded text-[10px] font-medium capitalize cursor-pointer border-none focus:outline-none",
                      priorityColors[task.priority as Priority]
                    )}
                  >
                    <option value="low" className="bg-slate-700 text-white">
                      Low
                    </option>
                    <option value="medium" className="bg-slate-700 text-white">
                      Medium
                    </option>
                    <option value="high" className="bg-slate-700 text-white">
                      High
                    </option>
                    <option value="urgent" className="bg-slate-700 text-white">
                      Urgent
                    </option>
                  </select>
                </td>
                <td className="px-3 py-1">
                  {task.subtasks && task.subtasks.length > 0 ? (
                    <div className="flex items-center gap-1">
                      <span className={clsx(
                        "text-xs",
                        task.subtasks.filter((s: { completed: boolean }) => s.completed).length === task.subtasks.length 
                          ? "text-green-400" 
                          : "text-slate-400"
                      )}>
                        ☑ {task.subtasks.filter((s: { completed: boolean }) => s.completed).length}/{task.subtasks.length}
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-600 text-xs">—</span>
                  )}
                </td>
                <td className="px-3 py-1">
                  <div className="flex flex-wrap gap-0.5">
                    {task.labels?.map((label) => {
                      const labelName = typeof label === 'string' ? label : label.name;
                      const labelId = typeof label === 'string' ? label : label.id;
                      const labelColor = typeof label === 'string' ? '#6366f1' : label.color;
                      return (
                        <span
                          key={labelId}
                          className="px-1.5 py-px text-[10px] rounded"
                          style={{
                            backgroundColor: `${labelColor}30`,
                            color: labelColor,
                          }}
                        >
                          {labelName}
                        </span>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {sortedTasks.length === 0 && (
          <div className="text-center py-16 text-slate-500">
            {hasActiveFilters ? (
              <div className="space-y-2">
                <p>No tasks match your filters</p>
                <button
                  onClick={clearFilters}
                  className="text-indigo-400 hover:text-indigo-300 text-sm font-medium"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              "No tasks found"
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Wrapper with Suspense for useSearchParams
export default function TableViewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-900">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      }
    >
      <TableViewContent />
    </Suspense>
  );
}
