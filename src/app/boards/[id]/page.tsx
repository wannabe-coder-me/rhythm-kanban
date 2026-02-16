"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  DragOverlay,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import type { Board, Column as ColumnType, Task, User, Priority } from "@/types";
import { Column } from "@/components/Column";
import { TaskCard } from "@/components/TaskCard";
import { TaskDetailPanel } from "@/components/TaskDetailPanel";

export default function BoardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const boardId = params.id as string;

  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<ColumnType[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState<Priority | "all">("all");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

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

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = columns
      .flatMap((col) => col.tasks || [])
      .find((t) => t.id === active.id);
    if (task) setActiveTask(task);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeColumn = columns.find((col) =>
      col.tasks?.some((t) => t.id === activeId)
    );
    const overColumn =
      columns.find((col) => col.id === overId) ||
      columns.find((col) => col.tasks?.some((t) => t.id === overId));

    if (!activeColumn || !overColumn || activeColumn.id === overColumn.id) return;

    setColumns((prev) => {
      const activeTask = activeColumn.tasks?.find((t) => t.id === activeId);
      if (!activeTask) return prev;

      return prev.map((col) => {
        if (col.id === activeColumn.id) {
          return {
            ...col,
            tasks: col.tasks?.filter((t) => t.id !== activeId) || [],
          };
        }
        if (col.id === overColumn.id) {
          const overTaskIndex = col.tasks?.findIndex((t) => t.id === overId) ?? -1;
          const newTasks = [...(col.tasks || [])];
          const insertIndex = overTaskIndex >= 0 ? overTaskIndex : newTasks.length;
          newTasks.splice(insertIndex, 0, { ...activeTask, columnId: col.id });
          return { ...col, tasks: newTasks };
        }
        return col;
      });
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeColumn = columns.find((col) =>
      col.tasks?.some((t) => t.id === activeId)
    );
    const overColumn =
      columns.find((col) => col.id === overId) ||
      columns.find((col) => col.tasks?.some((t) => t.id === overId));

    if (!activeColumn || !overColumn) return;

    if (activeColumn.id === overColumn.id) {
      // Reorder within same column
      const oldIndex = activeColumn.tasks?.findIndex((t) => t.id === activeId) ?? -1;
      const newIndex = activeColumn.tasks?.findIndex((t) => t.id === overId) ?? -1;

      if (oldIndex !== newIndex && oldIndex >= 0 && newIndex >= 0) {
        setColumns((prev) =>
          prev.map((col) => {
            if (col.id === activeColumn.id && col.tasks) {
              return {
                ...col,
                tasks: arrayMove(col.tasks, oldIndex, newIndex),
              };
            }
            return col;
          })
        );
      }
    }

    // Save position to API
    const newPosition =
      overColumn.tasks?.findIndex((t) => t.id === activeId) ?? 0;
    try {
      await fetch(`/api/tasks/${activeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          columnId: overColumn.id,
          position: newPosition,
        }),
      });
    } catch (error) {
      console.error("Failed to update task position:", error);
      fetchBoard(); // Rollback on error
    }
  };

  const handleAddTask = async (columnId: string, title: string) => {
    try {
      const res = await fetch(`/api/columns/${columnId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (res.ok) {
        const task = await res.json();
        setColumns((prev) =>
          prev.map((col) => {
            if (col.id === columnId) {
              return { ...col, tasks: [...(col.tasks || []), task] };
            }
            return col;
          })
        );
      }
    } catch (error) {
      console.error("Failed to create task:", error);
    }
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const updatedTask = await res.json();
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

  const handleAddColumn = async () => {
    if (!newColumnName.trim()) return;
    try {
      const res = await fetch(`/api/boards/${boardId}/columns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newColumnName }),
      });
      if (res.ok) {
        const column = await res.json();
        setColumns([...columns, { ...column, tasks: [] }]);
        setNewColumnName("");
        setShowAddColumn(false);
      }
    } catch (error) {
      console.error("Failed to create column:", error);
    }
  };

  const handleDeleteColumn = async (columnId: string) => {
    if (!confirm("Delete this column and all its tasks?")) return;
    try {
      const res = await fetch(`/api/columns/${columnId}`, { method: "DELETE" });
      if (res.ok) {
        setColumns(columns.filter((col) => col.id !== columnId));
      }
    } catch (error) {
      console.error("Failed to delete column:", error);
    }
  };

  // Filter tasks
  const filteredColumns = columns.map((col) => ({
    ...col,
    tasks:
      col.tasks?.filter((task) => {
        if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }
        if (filterPriority !== "all" && task.priority !== filterPriority) {
          return false;
        }
        if (filterAssignee !== "all" && task.assigneeId !== filterAssignee) {
          return false;
        }
        return true;
      }) || [],
  }));

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
            <Link href="/" className="text-slate-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">{board.name}</h1>
              {board.description && (
                <p className="text-sm text-slate-400">{board.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href={`/boards/${boardId}/table`}
              className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Table View
            </Link>
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

        {/* Filters */}
        <div className="px-6 pb-3 flex items-center gap-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks..."
            className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
          />
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value as Priority | "all")}
            className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Assignees</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name || user.email}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Board */}
      <div className="flex-1 overflow-x-auto p-6">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 h-full">
            {filteredColumns.map((column) => (
              <Column
                key={column.id}
                column={column}
                tasks={column.tasks || []}
                onTaskClick={(task) => setSelectedTask(task)}
                onAddTask={handleAddTask}
                onDeleteColumn={() => handleDeleteColumn(column.id)}
              />
            ))}

            {/* Add Column */}
            {showAddColumn ? (
              <div className="flex-shrink-0 w-72 bg-slate-800/50 rounded-lg p-3">
                <input
                  type="text"
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddColumn();
                    if (e.key === "Escape") {
                      setShowAddColumn(false);
                      setNewColumnName("");
                    }
                  }}
                  placeholder="Column name..."
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddColumn}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-sm py-1.5 rounded transition-colors"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowAddColumn(false);
                      setNewColumnName("");
                    }}
                    className="px-3 text-slate-400 hover:text-white text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddColumn(true)}
                className="flex-shrink-0 w-72 h-12 border-2 border-dashed border-slate-700 hover:border-slate-600 rounded-lg flex items-center justify-center gap-2 text-slate-500 hover:text-slate-400 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Column
              </button>
            )}
          </div>

          <DragOverlay>
            {activeTask ? (
              <div className="opacity-90 rotate-3">
                <TaskCard task={activeTask} onClick={() => {}} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Task Detail Panel */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          columns={columns}
          users={users}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleUpdateTask}
          onDelete={handleDeleteTask}
        />
      )}
    </div>
  );
}
