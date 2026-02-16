"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback, useMemo, Suspense, useRef } from "react";
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
import type { Board, Column as ColumnType, Task, User, Priority, Label } from "@/types";
import { Column } from "@/components/Column";
import { TaskCard } from "@/components/TaskCard";
import { TaskDetailPanel } from "@/components/TaskDetailPanel";
import { NotificationBell } from "@/components/NotificationBell";
import { FilterBar } from "@/components/FilterBar";
import { useFilters } from "@/hooks/useFilters";
import { useBoardEvents, BoardEvent } from "@/hooks/useBoardEvents";
import { ToastContainer, useToasts } from "@/components/Toast";
import { PresenceIndicator } from "@/components/PresenceIndicator";
import { LabelManager } from "@/components/LabelManager";
import { BoardSettings } from "@/components/BoardSettings";
import { InviteModal } from "@/components/InviteModal";
import { KeyboardShortcutsModal, KeyboardShortcutsButton } from "@/components/KeyboardShortcutsModal";
import { useKeyboardShortcuts, ShortcutHandler } from "@/hooks/useKeyboardShortcuts";

type DragType = "task" | "column";

interface ActiveDrag {
  type: DragType;
  item: Task | ColumnType;
}

function BoardPageContent() {
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
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [recentlyChangedTasks, setRecentlyChangedTasks] = useState<Set<string>>(new Set());
  const [showLabelManager, setShowLabelManager] = useState(false);
  const [showBoardSettings, setShowBoardSettings] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [availableLabels, setAvailableLabels] = useState<Label[]>([]);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const { toasts, addToast, dismissToast } = useToasts();
  
  // Refs for focusing elements
  const filterInputRef = useRef<HTMLInputElement>(null);

  // Use the new filter system
  const {
    filters,
    updateFilters,
    clearFilters,
    activeFilterCount,
    hasActiveFilters,
    filterTasks,
  } = useFilters();

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

  // Handle real-time events from other users
  const handleBoardEvent = useCallback((event: BoardEvent) => {
    // Skip events from ourselves
    if ("userId" in event && event.userId === session?.user?.id) {
      return;
    }

    switch (event.type) {
      case "task:created": {
        const newTask = event.task;
        setColumns((prev) =>
          prev.map((col) => {
            if (col.id === newTask.columnId) {
              // Don't add if already exists
              if (col.tasks?.some((t) => t.id === newTask.id)) return col;
              return { ...col, tasks: [...(col.tasks || []), newTask] };
            }
            return col;
          })
        );
        // Highlight the new task
        setRecentlyChangedTasks((prev) => new Set(prev).add(newTask.id));
        setTimeout(() => {
          setRecentlyChangedTasks((prev) => {
            const next = new Set(prev);
            next.delete(newTask.id);
            return next;
          });
        }, 3000);
        addToast(`New task created: "${newTask.title}"`, "info");
        break;
      }

      case "task:updated": {
        const updatedTask = event.task;
        setColumns((prev) =>
          prev.map((col) => ({
            ...col,
            tasks: col.tasks?.map((t) =>
              t.id === updatedTask.id ? updatedTask : t
            ) || [],
          }))
        );
        // Update selected task if it's the same one
        setSelectedTask((prev) =>
          prev?.id === updatedTask.id ? updatedTask : prev
        );
        // Highlight the updated task
        setRecentlyChangedTasks((prev) => new Set(prev).add(updatedTask.id));
        setTimeout(() => {
          setRecentlyChangedTasks((prev) => {
            const next = new Set(prev);
            next.delete(updatedTask.id);
            return next;
          });
        }, 3000);
        break;
      }

      case "task:deleted":
        setColumns((prev) =>
          prev.map((col) => ({
            ...col,
            tasks: col.tasks?.filter((t) => t.id !== event.taskId) || [],
          }))
        );
        // Close detail panel if viewing deleted task
        setSelectedTask((prev) =>
          prev?.id === event.taskId ? null : prev
        );
        addToast("A task was deleted", "warning");
        break;

      case "task:moved":
        // For moves, just refresh to ensure consistency
        fetchBoard();
        break;

      case "column:created": {
        const newColumn = event.column;
        setColumns((prev) => {
          if (prev.some((c) => c.id === newColumn.id)) return prev;
          return [...prev, { ...newColumn, tasks: newColumn.tasks || [] }];
        });
        addToast(`New column created: "${newColumn.name}"`, "info");
        break;
      }

      case "column:updated": {
        const updatedColumn = event.column;
        setColumns((prev) =>
          prev.map((col) =>
            col.id === updatedColumn.id
              ? { ...col, ...updatedColumn, tasks: col.tasks }
              : col
          )
        );
        break;
      }

      case "column:deleted":
        setColumns((prev) =>
          prev.filter((col) => col.id !== event.columnId)
        );
        addToast("A column was deleted", "warning");
        break;

      case "column:reordered":
        // Reorder local columns to match
        setColumns((prev) => {
          const columnMap = new Map(prev.map((c) => [c.id, c]));
          const reordered = event.columnIds
            .map((id) => columnMap.get(id))
            .filter((c): c is ColumnType => c !== undefined);
          return reordered.length === prev.length ? reordered : prev;
        });
        break;

      case "user:joined":
        if (event.userId !== session?.user?.id) {
          addToast(`${event.userName} joined the board`, "info", 3000);
        }
        break;

      case "user:left":
        // Handled by the hook's connectedUsers state
        break;
    }
  }, [session?.user?.id, addToast, fetchBoard]);

  // Subscribe to real-time board events
  const { isConnected, connectedUsers } = useBoardEvents(boardId, {
    onEvent: handleBoardEvent,
    enabled: !!session && !!boardId,
  });

  // Get all tasks (flat) and identify which are parent tasks
  const getAllTasks = useCallback(() => {
    return columns.flatMap((col) => col.tasks || []);
  }, [columns]);

  // All board tasks with column info (for dependency picker)
  const allBoardTasks = useMemo(() => {
    return columns.flatMap((col) =>
      (col.tasks || [])
        .filter((t) => !t.parentId) // Only parent tasks
        .map((t) => ({ ...t, column: col }))
    );
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

  const handleUpdateTask = async (taskId: string, updates: Partial<Task> & { labelIds?: string[] }) => {
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

  // Filter tasks - only show parent tasks (not subtasks)
  const filteredColumns = useMemo(() => {
    return columns.map((col) => {
      // First filter out subtasks, then apply user filters
      const parentTasks = col.tasks?.filter((task) => !task.parentId) || [];
      const filtered = filterTasks(parentTasks);
      return { ...col, tasks: filtered };
    });
  }, [columns, filterTasks]);

  // Check if any tasks match after filtering
  const totalFilteredTasks = useMemo(() => {
    return filteredColumns.reduce((sum, col) => sum + (col.tasks?.length || 0), 0);
  }, [filteredColumns]);

  const totalTasks = useMemo(() => {
    return columns.reduce(
      (sum, col) => sum + (col.tasks?.filter((t) => !t.parentId).length || 0),
      0
    );
  }, [columns]);

  // Column IDs for sortable context
  const columnIds = useMemo(() => columns.map((col) => col.id), [columns]);

  // Get all navigable tasks (flat list of parent tasks)
  const allNavigableTasks = useMemo(() => {
    return filteredColumns.flatMap((col) => col.tasks || []);
  }, [filteredColumns]);

  // Keyboard navigation helpers
  const selectNextTask = useCallback(() => {
    if (allNavigableTasks.length === 0) return;
    
    if (!selectedTaskId) {
      // Select first task
      const firstTask = allNavigableTasks[0];
      if (firstTask) {
        setSelectedTaskId(firstTask.id);
        addToast(`Selected: ${firstTask.title}`, "info", 1500);
      }
      return;
    }
    
    const currentIndex = allNavigableTasks.findIndex((t) => t.id === selectedTaskId);
    const nextIndex = Math.min(currentIndex + 1, allNavigableTasks.length - 1);
    const nextTask = allNavigableTasks[nextIndex];
    if (nextTask && nextTask.id !== selectedTaskId) {
      setSelectedTaskId(nextTask.id);
    }
  }, [allNavigableTasks, selectedTaskId, addToast]);

  const selectPreviousTask = useCallback(() => {
    if (allNavigableTasks.length === 0) return;
    
    if (!selectedTaskId) {
      // Select last task
      const lastTask = allNavigableTasks[allNavigableTasks.length - 1];
      if (lastTask) {
        setSelectedTaskId(lastTask.id);
        addToast(`Selected: ${lastTask.title}`, "info", 1500);
      }
      return;
    }
    
    const currentIndex = allNavigableTasks.findIndex((t) => t.id === selectedTaskId);
    const prevIndex = Math.max(currentIndex - 1, 0);
    const prevTask = allNavigableTasks[prevIndex];
    if (prevTask && prevTask.id !== selectedTaskId) {
      setSelectedTaskId(prevTask.id);
    }
  }, [allNavigableTasks, selectedTaskId, addToast]);

  const openSelectedTask = useCallback(() => {
    if (!selectedTaskId) return;
    const task = allNavigableTasks.find((t) => t.id === selectedTaskId);
    if (task) {
      setSelectedTask(task);
    }
  }, [selectedTaskId, allNavigableTasks]);

  const toggleSelectedTaskComplete = useCallback(async () => {
    const task = selectedTask || allNavigableTasks.find((t) => t.id === selectedTaskId);
    if (!task) return;
    
    await handleUpdateTask(task.id, { completed: !task.completed });
    addToast(task.completed ? "Task marked incomplete" : "Task marked complete", "success", 2000);
  }, [selectedTask, selectedTaskId, allNavigableTasks, handleUpdateTask, addToast]);

  const cyclePriority = useCallback(async () => {
    const task = selectedTask || allNavigableTasks.find((t) => t.id === selectedTaskId);
    if (!task) return;
    
    const priorities: Priority[] = ["low", "medium", "high", "urgent"];
    const currentIndex = priorities.indexOf(task.priority as Priority);
    const nextIndex = (currentIndex + 1) % priorities.length;
    const newPriority = priorities[nextIndex];
    
    await handleUpdateTask(task.id, { priority: newPriority });
    addToast(`Priority: ${newPriority}`, "info", 2000);
  }, [selectedTask, selectedTaskId, allNavigableTasks, handleUpdateTask, addToast]);

  const deleteSelectedTask = useCallback(async () => {
    const task = selectedTask || allNavigableTasks.find((t) => t.id === selectedTaskId);
    if (!task) return;
    
    await handleDeleteTask(task.id);
    setSelectedTaskId(null);
  }, [selectedTask, selectedTaskId, allNavigableTasks, handleDeleteTask]);

  // Define all keyboard shortcuts
  const shortcuts: ShortcutHandler[] = useMemo(() => [
    // Global shortcuts
    {
      key: "?",
      description: "Show keyboard shortcuts",
      category: "global",
      handler: () => setShowKeyboardShortcuts((prev) => !prev),
    },
    {
      key: "g h",
      description: "Go to home (board list)",
      category: "global",
      handler: () => router.push("/"),
    },
    {
      key: "g m",
      description: "Go to my tasks",
      category: "global",
      handler: () => router.push("/my-tasks"),
    },
    {
      key: "g n",
      description: "Go to notifications",
      category: "global",
      handler: () => router.push("/notifications"),
    },
    
    // Board view shortcuts
    {
      key: "n",
      description: "New task (quick add)",
      category: "board",
      handler: () => {
        // Find first column and trigger add task
        const firstCol = filteredColumns[0];
        if (firstCol) {
          // Click the add task button in first column
          const addButton = document.querySelector(`[data-column-id="${firstCol.id}"] [data-add-task]`);
          if (addButton) {
            (addButton as HTMLButtonElement).click();
          } else {
            addToast("Focus a column to add a task", "info", 2000);
          }
        }
      },
    },
    {
      key: "c",
      description: "New column",
      category: "board",
      handler: () => setShowAddColumn(true),
    },
    {
      key: "f",
      description: "Focus search/filter",
      category: "board",
      handler: () => {
        const searchInput = document.querySelector('[data-filter-search]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      },
    },
    {
      key: "escape",
      description: "Close any open panel/modal",
      category: "board",
      handler: () => {
        if (showKeyboardShortcuts) {
          setShowKeyboardShortcuts(false);
        } else if (selectedTask) {
          setSelectedTask(null);
        } else if (showLabelManager) {
          setShowLabelManager(false);
        } else if (showBoardSettings) {
          setShowBoardSettings(false);
        } else if (showInviteModal) {
          setShowInviteModal(false);
        } else if (showAddColumn) {
          setShowAddColumn(false);
        } else {
          setSelectedTaskId(null);
        }
      },
    },
    
    // Task navigation
    {
      key: "j",
      description: "Next task",
      category: "navigation",
      handler: selectNextTask,
    },
    {
      key: "arrowdown",
      description: "Next task",
      category: "navigation",
      handler: selectNextTask,
    },
    {
      key: "k",
      description: "Previous task",
      category: "navigation",
      handler: selectPreviousTask,
    },
    {
      key: "arrowup",
      description: "Previous task",
      category: "navigation",
      handler: selectPreviousTask,
    },
    {
      key: "enter",
      description: "Open selected task",
      category: "navigation",
      handler: openSelectedTask,
    },
    
    // Task actions
    {
      key: "e",
      description: "Edit task (focus title)",
      category: "task",
      handler: () => {
        if (!selectedTask && selectedTaskId) {
          openSelectedTask();
        }
        // Focus the title input after a small delay
        setTimeout(() => {
          const titleInput = document.querySelector('[data-task-title-input]') as HTMLInputElement;
          if (titleInput) {
            titleInput.focus();
            titleInput.select();
          }
        }, 100);
      },
    },
    {
      key: "d",
      description: "Mark done / toggle complete",
      category: "task",
      handler: toggleSelectedTaskComplete,
    },
    {
      key: "p",
      description: "Cycle priority",
      category: "task",
      handler: cyclePriority,
    },
    {
      key: "delete",
      description: "Delete task",
      category: "task",
      handler: deleteSelectedTask,
    },
    {
      key: "backspace",
      description: "Delete task",
      category: "task",
      handler: deleteSelectedTask,
    },
  ], [
    router,
    filteredColumns,
    addToast,
    selectedTask,
    showKeyboardShortcuts,
    showLabelManager,
    showBoardSettings,
    showInviteModal,
    showAddColumn,
    selectNextTask,
    selectPreviousTask,
    openSelectedTask,
    toggleSelectedTaskComplete,
    cyclePriority,
    deleteSelectedTask,
    selectedTaskId,
  ]);

  // Register keyboard shortcuts
  useKeyboardShortcuts({
    shortcuts,
    enabled: !loading && !!board,
  });

  // Scroll selected task into view
  useEffect(() => {
    if (selectedTaskId) {
      const taskElement = document.querySelector(`[data-task-id="${selectedTaskId}"]`);
      if (taskElement) {
        taskElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [selectedTaskId]);

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
            {/* Settings button - show for owner/admin */}
            {board.members?.some(m => 
              m.userId === session?.user?.id && 
              (m.role === 'admin' || board.ownerId === session?.user?.id)
            ) && (
              <>
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
                  title="Invite Members"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Invite
                </button>
                <button
                  onClick={() => setShowBoardSettings(true)}
                  className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
                  title="Board Settings"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Settings
                </button>
              </>
            )}
            <button
              onClick={() => setShowLabelManager(true)}
              className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
              </svg>
              Labels
            </button>
            <Link
              href="/my-tasks"
              className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              My Tasks
            </Link>
            {/* View Switcher */}
            <div className="hidden sm:flex items-center bg-slate-700 rounded-lg p-0.5">
              <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-slate-600 rounded-md">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
                Kanban
              </div>
              <Link
                href={`/boards/${boardId}/table`}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-white rounded-md transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                Table
              </Link>
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
            {/* Real-time presence indicator */}
            <PresenceIndicator
              users={connectedUsers}
              currentUserId={session?.user?.id}
            />
            {/* Connection status indicator */}
            {!isConnected && (
              <div className="flex items-center gap-1 text-amber-400 text-xs">
                <svg className="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Reconnecting...
              </div>
            )}
            <KeyboardShortcutsButton onClick={() => setShowKeyboardShortcuts(true)} />
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
      {hasActiveFilters && totalFilteredTasks === 0 && totalTasks > 0 && (
        <div className="mx-6 mt-4 p-4 bg-slate-800/50 border border-slate-700 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <span className="text-slate-300">
              No tasks match your filters. {totalTasks} task{totalTasks !== 1 ? 's' : ''} hidden.
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
                  boardId={boardId}
                  onTaskClick={(task) => {
                    setSelectedTask(task);
                    setSelectedTaskId(task.id);
                  }}
                  onAddTask={handleAddTask}
                  onTaskCreatedFromTemplate={(task) => {
                    setColumns((prev) =>
                      prev.map((col) => {
                        if (col.id === task.columnId) {
                          const exists = col.tasks?.some((t) => t.id === task.id);
                          if (exists) return col;
                          return { ...col, tasks: [...(col.tasks || []), task] };
                        }
                        return col;
                      })
                    );
                    addToast(`Created: ${task.title}`, "success");
                  }}
                  onDeleteColumn={() => handleDeleteColumn(column.id)}
                  onToggleSubtask={handleToggleSubtask}
                  selectedTaskId={selectedTaskId}
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
          boardId={boardId}
          availableLabels={availableLabels}
          allBoardTasks={allBoardTasks}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleUpdateTask}
          onDelete={handleDeleteTask}
          onLabelsChange={() => {
            fetchLabels();
            fetchBoard();
          }}
        />
      )}

      {/* Label Manager Modal */}
      <LabelManager
        boardId={boardId}
        isOpen={showLabelManager}
        onClose={() => setShowLabelManager(false)}
        onLabelsChange={() => {
          fetchLabels();
          fetchBoard();
        }}
      />

      {/* Board Settings Modal */}
      {board && session?.user?.id && (
        <BoardSettings
          board={board}
          currentUserId={session.user.id}
          isOpen={showBoardSettings}
          onClose={() => setShowBoardSettings(false)}
          onBoardUpdate={(updated) => {
            setBoard({ ...board, ...updated });
            fetchBoard();
          }}
          onBoardDelete={() => {
            router.push("/");
          }}
        />
      )}

      {/* Invite Modal */}
      <InviteModal
        boardId={boardId}
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
      />

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={showKeyboardShortcuts}
        onClose={() => setShowKeyboardShortcuts(false)}
        shortcuts={shortcuts}
      />

      {/* Toast notifications for real-time updates */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

// Wrapper with Suspense for useSearchParams
export default function BoardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-900">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      }
    >
      <BoardPageContent />
    </Suspense>
  );
}
