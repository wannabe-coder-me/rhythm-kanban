"use client";

import { useState, useEffect } from "react";
import type { RecurrenceRule, RecurrenceFrequency } from "@/types";
import { parseRecurrenceRule, stringifyRecurrenceRule, describeRecurrence, getNextOccurrence, createDefaultRule } from "@/lib/recurrence";
import { format, getDay, getDate } from "date-fns";
import clsx from "clsx";

interface RecurrenceSettingsProps {
  isRecurring: boolean;
  recurrenceRule: string | null;
  dueDate: Date | null;
  lastRecurrence: Date | null;
  onChange: (isRecurring: boolean, rule: string | null) => void;
}

const frequencies: { value: RecurrenceFrequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];
const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const weekNames = ["First", "Second", "Third", "Fourth", "Last"];

export function RecurrenceSettings({
  isRecurring,
  recurrenceRule,
  dueDate,
  lastRecurrence,
  onChange,
}: RecurrenceSettingsProps) {
  const [enabled, setEnabled] = useState(isRecurring);
  const [rule, setRule] = useState<RecurrenceRule>(() => {
    const parsed = parseRecurrenceRule(recurrenceRule);
    return parsed || createDefaultRule();
  });
  const [expanded, setExpanded] = useState(false);

  // Sync with props
  useEffect(() => {
    setEnabled(isRecurring);
    if (recurrenceRule) {
      const parsed = parseRecurrenceRule(recurrenceRule);
      if (parsed) setRule(parsed);
    }
  }, [isRecurring, recurrenceRule]);

  const handleToggle = () => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    if (newEnabled) {
      // Initialize rule based on due date
      const newRule = createDefaultRule();
      if (dueDate) {
        newRule.daysOfWeek = [getDay(new Date(dueDate))];
        newRule.dayOfMonth = getDate(new Date(dueDate));
      }
      setRule(newRule);
      onChange(true, stringifyRecurrenceRule(newRule));
    } else {
      onChange(false, null);
    }
  };

  const updateRule = (updates: Partial<RecurrenceRule>) => {
    const newRule = { ...rule, ...updates };
    setRule(newRule);
    onChange(true, stringifyRecurrenceRule(newRule));
  };

  const handleFrequencyChange = (frequency: RecurrenceFrequency) => {
    const newRule: RecurrenceRule = {
      ...rule,
      frequency,
      interval: 1,
    };
    
    // Set sensible defaults for the new frequency
    if (frequency === "weekly") {
      newRule.daysOfWeek = dueDate ? [getDay(new Date(dueDate))] : [getDay(new Date())];
      delete newRule.dayOfMonth;
      delete newRule.weekOfMonth;
    } else if (frequency === "monthly") {
      newRule.dayOfMonth = dueDate ? getDate(new Date(dueDate)) : getDate(new Date());
      delete newRule.daysOfWeek;
      delete newRule.weekOfMonth;
    } else {
      delete newRule.daysOfWeek;
      delete newRule.dayOfMonth;
      delete newRule.weekOfMonth;
    }
    
    setRule(newRule);
    onChange(true, stringifyRecurrenceRule(newRule));
  };

  const toggleDayOfWeek = (day: number) => {
    const current = rule.daysOfWeek || [];
    const newDays = current.includes(day)
      ? current.filter(d => d !== day)
      : [...current, day].sort();
    
    // Must have at least one day selected
    if (newDays.length === 0) return;
    
    updateRule({ daysOfWeek: newDays });
  };

  const nextOccurrence = enabled && rule
    ? getNextOccurrence(rule, dueDate, lastRecurrence)
    : null;

  return (
    <div className="space-y-3">
      {/* Toggle */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer">
          <button
            type="button"
            onClick={handleToggle}
            className={clsx(
              "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
              enabled ? "bg-indigo-600" : "bg-slate-600"
            )}
          >
            <span
              className={clsx(
                "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
                enabled ? "translate-x-5" : "translate-x-1"
              )}
            />
          </button>
          <span className="text-sm text-white flex items-center gap-1.5">
            <span>🔄</span> Repeat
          </span>
        </label>
        
        {enabled && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-indigo-400 hover:text-indigo-300"
          >
            {expanded ? "Less options" : "More options"}
          </button>
        )}
      </div>

      {enabled && (
        <div className="space-y-3 pl-2 border-l-2 border-slate-700">
          {/* Frequency & Interval */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Every</span>
            <input
              type="number"
              min="1"
              max="99"
              value={rule.interval}
              onChange={(e) => updateRule({ interval: Math.max(1, parseInt(e.target.value) || 1) })}
              className="w-14 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <select
              value={rule.frequency}
              onChange={(e) => handleFrequencyChange(e.target.value as RecurrenceFrequency)}
              className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {frequencies.map(f => (
                <option key={f.value} value={f.value}>
                  {rule.interval === 1 ? f.label.replace(/ly$/, "").toLowerCase() : f.label.toLowerCase().replace(/ly$/, "s")}
                </option>
              ))}
            </select>
          </div>

          {/* Weekly: Day selection */}
          {rule.frequency === "weekly" && (
            <div className="flex items-center gap-1">
              <span className="text-sm text-slate-400 mr-1">On</span>
              {dayLabels.map((label, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleDayOfWeek(idx)}
                  title={dayNames[idx]}
                  className={clsx(
                    "w-7 h-7 rounded-full text-xs font-medium transition-colors",
                    rule.daysOfWeek?.includes(idx)
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Monthly options */}
          {rule.frequency === "monthly" && expanded && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="monthlyByDate"
                  checked={!!rule.dayOfMonth && !rule.weekOfMonth}
                  onChange={() => {
                    updateRule({
                      dayOfMonth: dueDate ? getDate(new Date(dueDate)) : getDate(new Date()),
                      weekOfMonth: undefined,
                      daysOfWeek: undefined,
                    });
                  }}
                  className="text-indigo-600"
                />
                <label htmlFor="monthlyByDate" className="text-sm text-slate-300 flex items-center gap-2">
                  On day
                  <select
                    value={rule.dayOfMonth || 1}
                    onChange={(e) => updateRule({ dayOfMonth: parseInt(e.target.value), weekOfMonth: undefined })}
                    disabled={!!rule.weekOfMonth}
                    className="bg-slate-700 border border-slate-600 rounded px-2 py-0.5 text-sm text-white focus:outline-none"
                  >
                    {Array.from({ length: 31 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>{i + 1}</option>
                    ))}
                  </select>
                </label>
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="monthlyByWeek"
                  checked={!!rule.weekOfMonth}
                  onChange={() => {
                    const dow = dueDate ? getDay(new Date(dueDate)) : getDay(new Date());
                    updateRule({
                      weekOfMonth: 1,
                      daysOfWeek: [dow],
                      dayOfMonth: undefined,
                    });
                  }}
                  className="text-indigo-600"
                />
                <label htmlFor="monthlyByWeek" className="text-sm text-slate-300 flex items-center gap-2">
                  On the
                  <select
                    value={rule.weekOfMonth || 1}
                    onChange={(e) => updateRule({ weekOfMonth: parseInt(e.target.value) })}
                    disabled={!rule.weekOfMonth}
                    className="bg-slate-700 border border-slate-600 rounded px-2 py-0.5 text-sm text-white focus:outline-none"
                  >
                    {weekNames.map((name, i) => (
                      <option key={i} value={i + 1}>{name}</option>
                    ))}
                  </select>
                  <select
                    value={rule.daysOfWeek?.[0] ?? 0}
                    onChange={(e) => updateRule({ daysOfWeek: [parseInt(e.target.value)] })}
                    disabled={!rule.weekOfMonth}
                    className="bg-slate-700 border border-slate-600 rounded px-2 py-0.5 text-sm text-white focus:outline-none"
                  >
                    {dayNames.map((name, i) => (
                      <option key={i} value={i}>{name}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          )}

          {/* End options */}
          {expanded && (
            <div className="space-y-2">
              <span className="text-sm text-slate-400">Ends</span>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={rule.endType === "never"}
                    onChange={() => updateRule({ endType: "never", endDate: undefined, endCount: undefined })}
                    className="text-indigo-600"
                  />
                  <span className="text-sm text-slate-300">Never</span>
                </label>
                
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={rule.endType === "date"}
                    onChange={() => updateRule({ endType: "date" })}
                    className="text-indigo-600"
                  />
                  <span className="text-sm text-slate-300">On date</span>
                  {rule.endType === "date" && (
                    <input
                      type="date"
                      value={rule.endDate ? format(new Date(rule.endDate), "yyyy-MM-dd") : ""}
                      onChange={(e) => updateRule({ endDate: e.target.value })}
                      className="bg-slate-700 border border-slate-600 rounded px-2 py-0.5 text-sm text-white focus:outline-none"
                    />
                  )}
                </label>
                
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={rule.endType === "count"}
                    onChange={() => updateRule({ endType: "count", endCount: 10 })}
                    className="text-indigo-600"
                  />
                  <span className="text-sm text-slate-300">After</span>
                  {rule.endType === "count" && (
                    <>
                      <input
                        type="number"
                        min="1"
                        max="999"
                        value={rule.endCount || 10}
                        onChange={(e) => updateRule({ endCount: Math.max(1, parseInt(e.target.value) || 1) })}
                        className="w-16 bg-slate-700 border border-slate-600 rounded px-2 py-0.5 text-sm text-white text-center focus:outline-none"
                      />
                      <span className="text-sm text-slate-300">occurrences</span>
                    </>
                  )}
                </label>
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="text-xs text-slate-400 pt-1 border-t border-slate-700">
            <span className="font-medium text-indigo-400">📅 {describeRecurrence(rule)}</span>
            {nextOccurrence && (
              <span className="block mt-1">
                Next: {format(nextOccurrence, "EEE, MMM d, yyyy")}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
