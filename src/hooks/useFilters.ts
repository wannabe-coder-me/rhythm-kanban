"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo, useEffect, useState } from "react";
import type { Priority, Task, Label } from "@/types";
import { isToday, isThisWeek, isPast, startOfDay } from "date-fns";

export type DueDateFilter = "all" | "overdue" | "today" | "this_week" | "no_date";
export type DependencyFilter = "all" | "blocked" | "unblocked";

export interface FilterState {
  search: string;
  assigneeIds: string[];
  priorities: Priority[];
  dueDateFilter: DueDateFilter;
  labelIds: string[];
  dependencyFilter: DependencyFilter;
}

const DEFAULT_FILTERS: FilterState = {
  search: "",
  assigneeIds: [],
  priorities: [],
  dueDateFilter: "all",
  labelIds: [],
  dependencyFilter: "all",
};

export function useFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // Debounced search state
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Parse filters from URL
  const filters = useMemo((): FilterState => {
    const search = searchParams.get("q") || "";
    const assigneeIds = searchParams.get("assignees")?.split(",").filter(Boolean) || [];
    const priorities = (searchParams.get("priorities")?.split(",").filter(Boolean) || []) as Priority[];
    const dueDateFilter = (searchParams.get("due") || "all") as DueDateFilter;
    const labelIds = searchParams.get("labels")?.split(",").filter(Boolean) || [];
    const dependencyFilter = (searchParams.get("deps") || "all") as DependencyFilter;
    
    return { search, assigneeIds, priorities, dueDateFilter, labelIds, dependencyFilter };
  }, [searchParams]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(filters.search);
    }, 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  // Update URL with new filters
  const updateFilters = useCallback((newFilters: Partial<FilterState>) => {
    const params = new URLSearchParams(searchParams.toString());
    
    const updatedFilters = { ...filters, ...newFilters };
    
    // Set or remove each param
    if (updatedFilters.search) {
      params.set("q", updatedFilters.search);
    } else {
      params.delete("q");
    }
    
    if (updatedFilters.assigneeIds.length > 0) {
      params.set("assignees", updatedFilters.assigneeIds.join(","));
    } else {
      params.delete("assignees");
    }
    
    if (updatedFilters.priorities.length > 0) {
      params.set("priorities", updatedFilters.priorities.join(","));
    } else {
      params.delete("priorities");
    }
    
    if (updatedFilters.dueDateFilter !== "all") {
      params.set("due", updatedFilters.dueDateFilter);
    } else {
      params.delete("due");
    }
    
    if (updatedFilters.labelIds.length > 0) {
      params.set("labels", updatedFilters.labelIds.join(","));
    } else {
      params.delete("labels");
    }
    
    if (updatedFilters.dependencyFilter !== "all") {
      params.set("deps", updatedFilters.dependencyFilter);
    } else {
      params.delete("deps");
    }
    
    const queryString = params.toString();
    router.replace(`${pathname}${queryString ? `?${queryString}` : ""}`, { scroll: false });
  }, [filters, pathname, router, searchParams]);

  const clearFilters = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.assigneeIds.length > 0) count++;
    if (filters.priorities.length > 0) count++;
    if (filters.dueDateFilter !== "all") count++;
    if (filters.labelIds.length > 0) count++;
    if (filters.dependencyFilter !== "all") count++;
    return count;
  }, [filters]);

  const hasActiveFilters = activeFilterCount > 0;

  // Filter function for tasks
  const filterTasks = useCallback((tasks: Task[]): Task[] => {
    return tasks.filter((task) => {
      // Search filter (use debounced)
      if (debouncedSearch) {
        const searchLower = debouncedSearch.toLowerCase();
        const titleMatch = task.title.toLowerCase().includes(searchLower);
        const descMatch = task.description?.toLowerCase().includes(searchLower) || false;
        if (!titleMatch && !descMatch) return false;
      }

      // Assignee filter
      if (filters.assigneeIds.length > 0) {
        if (!task.assigneeId || !filters.assigneeIds.includes(task.assigneeId)) {
          return false;
        }
      }

      // Priority filter
      if (filters.priorities.length > 0) {
        if (!filters.priorities.includes(task.priority)) {
          return false;
        }
      }

      // Due date filter
      if (filters.dueDateFilter !== "all") {
        switch (filters.dueDateFilter) {
          case "overdue":
            if (!task.dueDate || !isPast(startOfDay(new Date(task.dueDate)))) {
              return false;
            }
            break;
          case "today":
            if (!task.dueDate || !isToday(new Date(task.dueDate))) {
              return false;
            }
            break;
          case "this_week":
            if (!task.dueDate || !isThisWeek(new Date(task.dueDate))) {
              return false;
            }
            break;
          case "no_date":
            if (task.dueDate) {
              return false;
            }
            break;
        }
      }

      // Label filter - labels can be Label objects or strings
      if (filters.labelIds.length > 0) {
        if (!task.labels || task.labels.length === 0) return false;
        const taskLabelIds = task.labels.map((l: Label | string) => 
          typeof l === 'string' ? l : l.id
        );
        if (!filters.labelIds.some(labelId => taskLabelIds.includes(labelId))) {
          return false;
        }
      }

      // Dependency filter
      if (filters.dependencyFilter !== "all") {
        const hasIncompleteBlockers = task.blockedBy?.some(
          (d) => d.blockedBy && !d.blockedBy.completed
        ) || false;
        
        if (filters.dependencyFilter === "blocked" && !hasIncompleteBlockers) {
          return false;
        }
        if (filters.dependencyFilter === "unblocked" && hasIncompleteBlockers) {
          return false;
        }
      }

      return true;
    });
  }, [debouncedSearch, filters]);

  return {
    filters,
    updateFilters,
    clearFilters,
    activeFilterCount,
    hasActiveFilters,
    filterTasks,
    debouncedSearch,
  };
}
