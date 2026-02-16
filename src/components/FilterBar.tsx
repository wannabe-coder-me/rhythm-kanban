"use client";

import { useState, useRef, useEffect } from "react";
import type { User, Priority } from "@/types";
import type { FilterState, DueDateFilter, DependencyFilter } from "@/hooks/useFilters";
import clsx from "clsx";

interface LabelOption {
  id: string;
  name: string;
}

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (filters: Partial<FilterState>) => void;
  onClearFilters: () => void;
  activeFilterCount: number;
  users: User[];
  allLabels: LabelOption[];
}

const priorityOptions: { value: Priority; label: string; color: string }[] = [
  { value: "low", label: "Low", color: "bg-green-500" },
  { value: "medium", label: "Medium", color: "bg-blue-500" },
  { value: "high", label: "High", color: "bg-amber-500" },
  { value: "urgent", label: "Urgent", color: "bg-red-500" },
];

const dueDateOptions: { value: DueDateFilter; label: string }[] = [
  { value: "all", label: "All Dates" },
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "no_date", label: "No Date" },
];

const dependencyOptions: { value: DependencyFilter; label: string }[] = [
  { value: "all", label: "All Tasks" },
  { value: "blocked", label: "🔒 Blocked" },
  { value: "unblocked", label: "✓ Unblocked" },
];

export function FilterBar({
  filters,
  onFilterChange,
  onClearFilters,
  activeFilterCount,
  users,
  allLabels,
}: FilterBarProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Search Input */}
      <div className="relative flex-grow max-w-xs">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          value={filters.search}
          onChange={(e) => onFilterChange({ search: e.target.value })}
          placeholder="Search tasks..."
          data-filter-search
          className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {filters.search && (
          <button
            onClick={() => onFilterChange({ search: "" })}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Assignee Multi-Select */}
      <MultiSelect
        label="Assignee"
        options={users.map((u) => ({ value: u.id, label: u.name || u.email }))}
        selected={filters.assigneeIds}
        onChange={(assigneeIds) => onFilterChange({ assigneeIds })}
      />

      {/* Priority Multi-Select */}
      <MultiSelect
        label="Priority"
        options={priorityOptions.map((p) => ({ 
          value: p.value, 
          label: p.label,
          dot: p.color
        }))}
        selected={filters.priorities}
        onChange={(priorities) => onFilterChange({ priorities: priorities as Priority[] })}
      />

      {/* Due Date Filter */}
      <select
        value={filters.dueDateFilter}
        onChange={(e) => onFilterChange({ dueDateFilter: e.target.value as DueDateFilter })}
        className={clsx(
          "bg-slate-700 border rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500",
          filters.dueDateFilter !== "all" ? "border-indigo-500" : "border-slate-600"
        )}
      >
        {dueDateOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Labels Multi-Select (only show if there are labels) */}
      {allLabels.length > 0 && (
        <MultiSelect
          label="Labels"
          options={allLabels.map((l) => ({ value: l.id, label: l.name }))}
          selected={filters.labelIds}
          onChange={(labelIds) => onFilterChange({ labelIds })}
        />
      )}

      {/* Clear Filters */}
      {activeFilterCount > 0 && (
        <button
          onClick={onClearFilters}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-400 hover:text-white border border-slate-600 hover:border-slate-500 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Clear ({activeFilterCount})
        </button>
      )}
    </div>
  );
}

interface MultiSelectOption {
  value: string;
  label: string;
  dot?: string;
}

interface MultiSelectProps {
  label: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
}

function MultiSelect({ label, options, selected, onChange }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const toggleValue = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const displayLabel = selected.length === 0 
    ? label 
    : selected.length === 1 
      ? options.find(o => o.value === selected[0])?.label || label
      : `${label} (${selected.length})`;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={clsx(
          "flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border transition-colors",
          selected.length > 0
            ? "bg-indigo-500/20 border-indigo-500 text-indigo-300"
            : "bg-slate-700 border-slate-600 text-white hover:border-slate-500"
        )}
      >
        {displayLabel}
        <svg
          className={clsx("w-4 h-4 transition-transform", open && "rotate-180")}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="max-h-64 overflow-y-auto">
            {options.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-2 px-3 py-2 hover:bg-slate-700 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(option.value)}
                  onChange={() => toggleValue(option.value)}
                  className="rounded border-slate-600 bg-slate-700 text-indigo-500 focus:ring-indigo-500"
                />
                {option.dot && (
                  <span className={clsx("w-2 h-2 rounded-full", option.dot)} />
                )}
                <span className="text-sm text-white truncate">{option.label}</span>
              </label>
            ))}
          </div>
          {selected.length > 0 && (
            <div className="border-t border-slate-600 p-2">
              <button
                onClick={() => onChange([])}
                className="w-full text-xs text-slate-400 hover:text-white py-1"
              >
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
