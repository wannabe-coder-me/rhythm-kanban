"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
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
  rectIntersection,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { Board, Column as ColumnType, Task, User, Priority } from "@/types";
import { Column } from "@/components/Column";
import { TaskCard } from "@/components/TaskCard";
import { TaskDetailPanel } from "@/components/TaskDetailPanel";

type DragType = "task" | "column";

interface ActiveDrag {
  type: DragType;
  item: Task | ColumnType;
}

export default function BoardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const boardId = params.id as string;

  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<ColumnType[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState<Priority | "all">("all");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
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

  // Get all tasks (flat) and identify which are parent tasks
  const getAllTasks = useCallback(() => {
    return columns.flatMap((col) => col.tasks || []);
  }, [columns]);

  // Find which column a task belongs to
  const findColumnByTaskId = useCallback(
    (taskId: string): ColumnType | undefined => {
      return columns.find((col) =>
        col.tasks?.some((t) => t.id === taskId)
      );
    },
    [columns]
  );

  // Check if we're dragging a column
  const isColumnDrag = (id: string): boolean => {
    return columns.some((col) => col.id === id);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const activeId = active.id as string;

    // Check if dragging a column
    if (isColumnDrag(activeId)) {
      const column = columns.find((col) => col.id === activeId);
      if (column) {
        setActiveDrag({ type: "column", item: column });
      }
      return;
    }

    // Dragging a task
    const task = getAllTasks().find((t) => t.id === activeId);
    if (task) {
      setActiveDrag({ type: "task", item: task });
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || !activeDrag || activeDrag.type !== "task") return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Don't do anything if it's a column being dragged
    if (isColumnDrag(activeId)) return;

    const activeColumn = findColumnByTaskId(activeId);
    const overColumn = columns.find((col) => col.id === overId) || findColumnByTaskId(overId);

    if (!activeColumn || !overColumn) return;

    // Moving between columns
    if (activeColumn.id !== overColumn.id) {
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
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const dragData = activeDrag;
    setActiveDrag(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Handle column reordering
    if (dragData?.type === "column") {
      if (activeId !== overId) {
        const oldIndex = columns.findIndex((col) => col.id === activeId);
        const newIndex = columns.findIndex((col) => col.id === overId);

        if (oldIndex !== -1 && newIndex !== -1) {
          const newColumns = arrayMove(columns, oldIndex, newIndex);
          setColumns(newColumns);

          // Save column order to API
          try {
            await fetch(`/api/boards/${boardId}/columns/reorder`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                columnIds: newColumns.map((col) => col.id),
              }),
            });
          } catch (error) {
            console.error("Failed to reorder columns:", error);
            fetchBoard();
          }
        }
      }
      return;
    }

    // Handle task dragging
    const activeColumn = findColumnByTaskId(activeId);
    const overColumn = columns.find((col) => col.id === overId) || findColumnByTaskId(overId);

    if (!activeColumn || !overColumn) return;

    // Reorder within same column
    if (activeColumn.id === overColumn.id && activeId !== overId) {
      const tasks = [...(activeColumn.tasks || [])];
      const oldIndex = tasks.findIndex((t) => t.id === activeId);
      const newIndex = tasks.findIndex((t) => t.id === overId);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedTasks = arrayMove(tasks, oldIndex, newIndex);
        setColumns((prev) =>
          prev.map((col) => {
            if (col.id === activeColumn.id) {
              return { ...col, tasks: reorderedTasks };
            }
            return col;
          })
        );
      }
    }

    // Get final position
    const finalColumn = columns.find((col) => col.id === overId) || findColumnByTaskId(activeId);
    const targetColumnId = finalColumn?.id || overColumn.id;
    const targetTasks = finalColumn?.tasks || [];
    const newPosition = targetTasks.findIndex((t) => t.id === activeId);
    const finalPosition = newPosition >= 0 ? newPosition : targetTasks.length;

    // Save to API
    try {
      await fetch(`/api/tasks/${activeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          columnId: targetColumnId,
          position: finalPosition,
        }),
      });
    } catch (error) {
      console.error("Failed to update task position:", error);
      fetchBoard();
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

  const handleToggleSubtask = async (subtaskId: string, completed: boolean) => {
    try {
      const res = await fetch(`/api/tasks/${subtaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });
      if (res.ok) {
        // Refresh the board to get updated subtask data
        fetchBoard();
      }
    } catch (error) {
      console.error("Failed to toggle subtask:", error);
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

  // Filter tasks - only show parent tasks (not subtasks)
  const filteredColumns = useMemo(() => {
    return columns.map((col) => ({
      ...col,
      tasks:
        col.tasks?.filter((task) => {
          // Filter out subtasks - they'll be shown under their parent
          if (task.parentId) return false;
          
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
  }, [columns, searchQuery, filterPriority, filterAssignee]);

  // Column IDs for sortable context
  const columnIds = useMemo(() => columns.map((col) => col.id), [columns]);

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
          collisionDetection={rectIntersection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={columnIds}
            strategy={horizontalListSortingStrategy}
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
                  onToggleSubtask={handleToggleSubtask}
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
          </SortableContext>

          <DragOverlay>
            {activeDrag?.type === "task" ? (
              <div className="opacity-90 rotate-3">
                <TaskCard task={activeDrag.item as Task} onClick={() => {}} />
              </div>
            ) : activeDrag?.type === "column" ? (
              <div className="opacity-90 rotate-1">
                <div className="w-72 bg-slate-800/80 rounded-lg p-3 shadow-2xl border border-slate-600">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: (activeDrag.item as ColumnType).color }}
                    />
                    <h3 className="font-medium text-slate-200">
                      {(activeDrag.item as ColumnType).name}
                    </h3>
                  </div>
                </div>
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
