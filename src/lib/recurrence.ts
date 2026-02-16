import { addDays, addWeeks, addMonths, addYears, setDate, getDay, startOfDay, isBefore, isAfter, differenceInDays, getDate, setDay, getWeekOfMonth } from "date-fns";
import type { RecurrenceRule, Task } from "@/types";

/**
 * Parse recurrence rule from JSON string
 */
export function parseRecurrenceRule(ruleStr: string | null): RecurrenceRule | null {
  if (!ruleStr) return null;
  try {
    return JSON.parse(ruleStr) as RecurrenceRule;
  } catch {
    return null;
  }
}

/**
 * Stringify recurrence rule to JSON
 */
export function stringifyRecurrenceRule(rule: RecurrenceRule): string {
  return JSON.stringify(rule);
}

/**
 * Get a human-readable description of the recurrence rule
 */
export function describeRecurrence(rule: RecurrenceRule | null): string {
  if (!rule) return "";

  const { frequency, interval, daysOfWeek, dayOfMonth, weekOfMonth, endType, endDate, endCount } = rule;

  let desc = "";
  
  // Frequency part
  if (interval === 1) {
    switch (frequency) {
      case "daily": desc = "Daily"; break;
      case "weekly": desc = "Weekly"; break;
      case "monthly": desc = "Monthly"; break;
      case "yearly": desc = "Yearly"; break;
    }
  } else {
    switch (frequency) {
      case "daily": desc = `Every ${interval} days`; break;
      case "weekly": desc = `Every ${interval} weeks`; break;
      case "monthly": desc = `Every ${interval} months`; break;
      case "yearly": desc = `Every ${interval} years`; break;
    }
  }

  // Weekly days
  if (frequency === "weekly" && daysOfWeek && daysOfWeek.length > 0) {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const days = daysOfWeek.sort().map(d => dayNames[d]);
    desc += ` on ${days.join(", ")}`;
  }

  // Monthly specifics
  if (frequency === "monthly") {
    if (dayOfMonth) {
      const suffix = getOrdinalSuffix(dayOfMonth);
      desc += ` on the ${dayOfMonth}${suffix}`;
    } else if (weekOfMonth && daysOfWeek && daysOfWeek.length > 0) {
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const weekNames = ["first", "second", "third", "fourth", "last"];
      desc += ` on the ${weekNames[weekOfMonth - 1]} ${dayNames[daysOfWeek[0]]}`;
    }
  }

  // End condition
  if (endType === "date" && endDate) {
    desc += ` until ${new Date(endDate).toLocaleDateString()}`;
  } else if (endType === "count" && endCount) {
    desc += `, ${endCount} times`;
  }

  return desc;
}

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

/**
 * Get the next occurrence date based on the recurrence rule
 */
export function getNextOccurrence(
  rule: RecurrenceRule,
  currentDueDate: Date | null,
  lastRecurrence: Date | null
): Date | null {
  const baseDate = lastRecurrence || currentDueDate || new Date();
  const startOfBase = startOfDay(new Date(baseDate));
  const today = startOfDay(new Date());

  let nextDate: Date;

  switch (rule.frequency) {
    case "daily":
      nextDate = addDays(startOfBase, rule.interval);
      break;

    case "weekly":
      if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
        // Find next matching day of week
        nextDate = findNextWeeklyOccurrence(startOfBase, rule.interval, rule.daysOfWeek);
      } else {
        nextDate = addWeeks(startOfBase, rule.interval);
      }
      break;

    case "monthly":
      if (rule.dayOfMonth) {
        // Specific day of month (e.g., 15th)
        nextDate = addMonths(startOfBase, rule.interval);
        nextDate = setDate(nextDate, Math.min(rule.dayOfMonth, getDaysInMonth(nextDate)));
      } else if (rule.weekOfMonth && rule.daysOfWeek && rule.daysOfWeek.length > 0) {
        // Specific week/day (e.g., 2nd Tuesday)
        nextDate = addMonths(startOfBase, rule.interval);
        nextDate = getNthWeekdayOfMonth(nextDate, rule.weekOfMonth, rule.daysOfWeek[0]);
      } else {
        nextDate = addMonths(startOfBase, rule.interval);
      }
      break;

    case "yearly":
      nextDate = addYears(startOfBase, rule.interval);
      break;

    default:
      return null;
  }

  // If next date is still in the past, keep advancing
  while (isBefore(nextDate, today)) {
    const tempRule = { ...rule };
    const tempResult = getNextOccurrence(tempRule, nextDate, null);
    if (!tempResult) break;
    nextDate = tempResult;
  }

  // Check end conditions
  if (rule.endType === "date" && rule.endDate) {
    const endDate = startOfDay(new Date(rule.endDate));
    if (isAfter(nextDate, endDate)) {
      return null;
    }
  }

  return nextDate;
}

/**
 * Find the next occurrence for weekly recurrence with specific days
 */
function findNextWeeklyOccurrence(baseDate: Date, interval: number, daysOfWeek: number[]): Date {
  const baseDayOfWeek = getDay(baseDate);
  const sortedDays = [...daysOfWeek].sort((a, b) => a - b);
  
  // Try to find a later day in the same week
  for (const day of sortedDays) {
    if (day > baseDayOfWeek) {
      return setDay(baseDate, day);
    }
  }
  
  // Move to next interval week and use first day
  const nextWeek = addWeeks(baseDate, interval);
  return setDay(nextWeek, sortedDays[0], { weekStartsOn: 0 });
}

/**
 * Get the nth weekday of a month (e.g., 2nd Tuesday)
 */
function getNthWeekdayOfMonth(date: Date, weekOfMonth: number, dayOfWeek: number): Date {
  const month = date.getMonth();
  const year = date.getFullYear();
  
  // Start from the first day of the month
  let current = new Date(year, month, 1);
  
  // Find first occurrence of the target day
  while (getDay(current) !== dayOfWeek) {
    current = addDays(current, 1);
  }
  
  // Add weeks to get to the nth occurrence
  if (weekOfMonth <= 4) {
    current = addWeeks(current, weekOfMonth - 1);
  } else {
    // "5" means "last" - find last occurrence
    let lastOccurrence = current;
    while (current.getMonth() === month) {
      lastOccurrence = current;
      current = addWeeks(current, 1);
    }
    current = lastOccurrence;
  }
  
  // Make sure we're still in the same month
  if (current.getMonth() !== month) {
    return addWeeks(current, -1);
  }
  
  return current;
}

function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/**
 * Check if it's time to create a new instance of a recurring task
 */
export function shouldCreateInstance(task: Task): boolean {
  if (!task.isRecurring || !task.recurrenceRule) return false;
  
  const rule = parseRecurrenceRule(task.recurrenceRule);
  if (!rule) return false;

  // Check if we've reached the count limit
  if (rule.endType === "count" && rule.endCount) {
    // Count would need to be tracked - for now we create instances
    // The API will need to check the count of existing instances
  }

  // Check if past end date
  if (rule.endType === "date" && rule.endDate) {
    if (isAfter(new Date(), new Date(rule.endDate))) {
      return false;
    }
  }

  const nextOccurrence = getNextOccurrence(rule, task.dueDate, task.lastRecurrence);
  if (!nextOccurrence) return false;

  // Create instance if the next occurrence is today or in the past
  const today = startOfDay(new Date());
  return !isAfter(nextOccurrence, today);
}

/**
 * Create a default recurrence rule
 */
export function createDefaultRule(frequency: RecurrenceRule["frequency"] = "daily"): RecurrenceRule {
  const rule: RecurrenceRule = {
    frequency,
    interval: 1,
    endType: "never",
  };

  if (frequency === "weekly") {
    // Default to current day of week
    rule.daysOfWeek = [getDay(new Date())];
  }

  if (frequency === "monthly") {
    // Default to current day of month
    rule.dayOfMonth = getDate(new Date());
  }

  return rule;
}
