"use client";

import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from "react";
import type { Task, Column } from "@/types";

interface KeyboardNavigationContextType {
  // Currently selected task (keyboard navigation)
  selectedTaskId: string | null;
  selectedTaskIndex: number;
  
  // Column navigation
  selectedColumnIndex: number;
  
  // Methods
  selectTask: (taskId: string | null) => void;
  selectNextTask: () => void;
  selectPreviousTask: () => void;
  selectNextColumn: () => void;
  selectPreviousColumn: () => void;
  clearSelection: () => void;
  
  // Get the currently selected task
  getSelectedTask: () => Task | null;
  
  // Set the data source
  setColumns: (columns: Column[]) => void;
}

const KeyboardNavigationContext = createContext<KeyboardNavigationContextType | null>(null);

export function KeyboardNavigationProvider({ children }: { children: ReactNode }) {
  const [columns, setColumnsState] = useState<Column[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedColumnIndex, setSelectedColumnIndex] = useState(0);

  // Get all tasks in a flat list (by column order)
  const allTasks = useMemo(() => {
    return columns.flatMap((col) => 
      (col.tasks || []).filter((t) => !t.parentId) // Only parent tasks
    );
  }, [columns]);

  // Get tasks grouped by column
  const tasksByColumn = useMemo(() => {
    return columns.map((col) => (col.tasks || []).filter((t) => !t.parentId));
  }, [columns]);

  // Get the index of the selected task within all tasks
  const selectedTaskIndex = useMemo(() => {
    if (!selectedTaskId) return -1;
    return allTasks.findIndex((t) => t.id === selectedTaskId);
  }, [allTasks, selectedTaskId]);

  const selectTask = useCallback((taskId: string | null) => {
    setSelectedTaskId(taskId);
    
    // Update column index based on task's column
    if (taskId) {
      const colIndex = columns.findIndex((col) => 
        col.tasks?.some((t) => t.id === taskId)
      );
      if (colIndex !== -1) {
        setSelectedColumnIndex(colIndex);
      }
    }
  }, [columns]);

  const selectNextTask = useCallback(() => {
    if (allTasks.length === 0) return;

    if (selectedTaskId === null) {
      // Select first task
      setSelectedTaskId(allTasks[0]?.id || null);
      setSelectedColumnIndex(0);
      return;
    }

    const currentIndex = allTasks.findIndex((t) => t.id === selectedTaskId);
    const nextIndex = Math.min(currentIndex + 1, allTasks.length - 1);
    const nextTask = allTasks[nextIndex];
    
    if (nextTask) {
      setSelectedTaskId(nextTask.id);
      
      // Update column index
      const colIndex = columns.findIndex((col) => 
        col.tasks?.some((t) => t.id === nextTask.id)
      );
      if (colIndex !== -1) {
        setSelectedColumnIndex(colIndex);
      }
    }
  }, [allTasks, columns, selectedTaskId]);

  const selectPreviousTask = useCallback(() => {
    if (allTasks.length === 0) return;

    if (selectedTaskId === null) {
      // Select last task
      setSelectedTaskId(allTasks[allTasks.length - 1]?.id || null);
      return;
    }

    const currentIndex = allTasks.findIndex((t) => t.id === selectedTaskId);
    const prevIndex = Math.max(currentIndex - 1, 0);
    const prevTask = allTasks[prevIndex];
    
    if (prevTask) {
      setSelectedTaskId(prevTask.id);
      
      // Update column index
      const colIndex = columns.findIndex((col) => 
        col.tasks?.some((t) => t.id === prevTask.id)
      );
      if (colIndex !== -1) {
        setSelectedColumnIndex(colIndex);
      }
    }
  }, [allTasks, columns, selectedTaskId]);

  const selectNextColumn = useCallback(() => {
    if (columns.length === 0) return;
    
    const nextColIndex = Math.min(selectedColumnIndex + 1, columns.length - 1);
    setSelectedColumnIndex(nextColIndex);
    
    // Select first task in new column
    const colTasks = tasksByColumn[nextColIndex];
    if (colTasks && colTasks.length > 0) {
      setSelectedTaskId(colTasks[0].id);
    }
  }, [columns.length, selectedColumnIndex, tasksByColumn]);

  const selectPreviousColumn = useCallback(() => {
    if (columns.length === 0) return;
    
    const prevColIndex = Math.max(selectedColumnIndex - 1, 0);
    setSelectedColumnIndex(prevColIndex);
    
    // Select first task in new column
    const colTasks = tasksByColumn[prevColIndex];
    if (colTasks && colTasks.length > 0) {
      setSelectedTaskId(colTasks[0].id);
    }
  }, [columns.length, selectedColumnIndex, tasksByColumn]);

  const clearSelection = useCallback(() => {
    setSelectedTaskId(null);
  }, []);

  const getSelectedTask = useCallback(() => {
    if (!selectedTaskId) return null;
    return allTasks.find((t) => t.id === selectedTaskId) || null;
  }, [allTasks, selectedTaskId]);

  const setColumns = useCallback((newColumns: Column[]) => {
    setColumnsState(newColumns);
  }, []);

  const value = useMemo(
    () => ({
      selectedTaskId,
      selectedTaskIndex,
      selectedColumnIndex,
      selectTask,
      selectNextTask,
      selectPreviousTask,
      selectNextColumn,
      selectPreviousColumn,
      clearSelection,
      getSelectedTask,
      setColumns,
    }),
    [
      selectedTaskId,
      selectedTaskIndex,
      selectedColumnIndex,
      selectTask,
      selectNextTask,
      selectPreviousTask,
      selectNextColumn,
      selectPreviousColumn,
      clearSelection,
      getSelectedTask,
      setColumns,
    ]
  );

  return (
    <KeyboardNavigationContext.Provider value={value}>
      {children}
    </KeyboardNavigationContext.Provider>
  );
}

export function useKeyboardNavigation() {
  const context = useContext(KeyboardNavigationContext);
  if (!context) {
    throw new Error("useKeyboardNavigation must be used within KeyboardNavigationProvider");
  }
  return context;
}
