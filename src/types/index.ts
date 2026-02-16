export type Priority = "low" | "medium" | "high" | "urgent";

export interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

export interface Label {
  id: string;
  boardId: string;
  name: string;
  color: string;
  createdAt: Date;
}

export type BoardVisibility = "private" | "team" | "public";

export interface Board {
  id: string;
  name: string;
  description: string | null;
  visibility: BoardVisibility;
  ownerId: string | null;
  createdAt: Date;
  updatedAt: Date;
  owner?: User | null;
  columns?: Column[];
  members?: BoardMember[];
  labels?: Label[];
}

export interface BoardMember {
  id: string;
  boardId: string;
  userId: string;
  role: string;
  user?: User;
}

export interface Column {
  id: string;
  boardId: string;
  name: string;
  position: number;
  color: string;
  tasks?: Task[];
}

export type RecurrenceFrequency = "daily" | "weekly" | "monthly" | "yearly";

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number;           // Every N days/weeks/months/years
  daysOfWeek?: number[];      // 0-6 (Sun-Sat) for weekly
  dayOfMonth?: number;        // 1-31 for monthly by date
  weekOfMonth?: number;       // 1-5 for monthly by week (e.g., "2nd Tuesday")
  endType: "never" | "date" | "count";
  endDate?: string;           // ISO date string
  endCount?: number;          // Number of occurrences
}

export interface Task {
  id: string;
  columnId: string;
  title: string;
  description: string | null;
  position: number;
  priority: Priority;
  dueDate: Date | null;
  labels: Label[];
  completed: boolean;
  assigneeId: string | null;
  createdById: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Recurring task fields
  isRecurring: boolean;
  recurrenceRule: string | null;  // JSON string of RecurrenceRule
  recurrenceEnd: Date | null;
  lastRecurrence: Date | null;
  parentRecurringId: string | null;
  // Relations
  assignee?: User | null;
  createdBy?: User;
  comments?: Comment[];
  column?: Column;
  subtasks?: Task[];
  parent?: Task;
  attachments?: Attachment[];
  parentRecurring?: Task;
  recurringInstances?: Task[];
  blockedBy?: TaskDependency[];
  blocking?: TaskDependency[];
  _count?: { attachments?: number; recurringInstances?: number; blockedBy?: number };
}

export interface Comment {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: Date;
  user?: User;
}

export interface Activity {
  id: string;
  taskId: string;
  userId: string;
  action: string;
  details: Record<string, unknown> | null;
  createdAt: Date;
  user?: User;
}

export interface Attachment {
  id: string;
  taskId: string;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
  uploadedById: string;
  createdAt: Date;
  uploadedBy?: User;
}

export interface BoardInvite {
  id: string;
  boardId: string;
  email: string;
  role: string;
  token: string;
  invitedById: string;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  acceptedAt?: Date | null;
  board?: Board;
  invitedBy?: User;
}

export interface TaskDependency {
  id: string;
  taskId: string;
  blockedById: string;
  createdAt: Date;
  createdById: string;
  task?: Task;
  blockedBy?: Task;
  createdBy?: User;
}
