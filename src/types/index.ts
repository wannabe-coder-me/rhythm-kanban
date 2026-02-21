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
  customFields?: CustomField[];
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
  startDate: Date | null;
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
  customFieldValues?: CustomFieldValue[];
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

export interface TaskTemplate {
  id: string;
  boardId: string;
  name: string;
  title: string;
  description: string | null;
  priority: Priority;
  labels: string[];
  subtasks: string[];
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: User;
}

export type FieldType = 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'url';

export interface CustomField {
  id: string;
  boardId: string;
  name: string;
  type: FieldType;
  options: string | null;  // JSON array for select type
  required: boolean;
  position: number;
  createdAt: Date;
}

export interface CustomFieldValue {
  id: string;
  taskId: string;
  customFieldId: string;
  value: string | null;
  createdAt: Date;
  updatedAt: Date;
  customField?: CustomField;
}

// ============================================
// LIFE SYSTEM TYPES
// ============================================

export type Pillar = "HEALTH" | "WEALTH" | "RELATIONSHIPS" | "CAREER" | "SPIRITUAL" | "CONTRIBUTION";

export type TimeHorizon = "ONE_YEAR" | "THREE_YEAR" | "FIVE_YEAR" | "SOMEDAY";

export const PILLAR_CONFIG: Record<Pillar, { label: string; emoji: string; color: string }> = {
  HEALTH: { label: "Health", emoji: "🏃", color: "#22c55e" },
  WEALTH: { label: "Wealth", emoji: "💰", color: "#f59e0b" },
  RELATIONSHIPS: { label: "Relationships", emoji: "❤️", color: "#f43f5e" },
  CAREER: { label: "Career", emoji: "🎯", color: "#3b82f6" },
  SPIRITUAL: { label: "Spiritual", emoji: "🧘", color: "#a855f7" },
  CONTRIBUTION: { label: "Contribution", emoji: "🤝", color: "#14b8a6" },
};

export const HORIZON_CONFIG: Record<TimeHorizon, { label: string; years: number }> = {
  ONE_YEAR: { label: "1 Year", years: 1 },
  THREE_YEAR: { label: "3 Years", years: 3 },
  FIVE_YEAR: { label: "5 Years", years: 5 },
  SOMEDAY: { label: "Someday", years: 99 },
};

export interface Vision {
  id: string;
  userId: string;
  pillar: Pillar;
  title: string;
  description: string | null;
  imageUrl: string | null;
  horizon: TimeHorizon;
  order: number;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NorthStar {
  id: string;
  userId: string;
  pillar: Pillar;
  title: string;
  description: string | null;
  targetDate: Date | null;
  progress: number;
  active: boolean;
  achieved: boolean;
  achievedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  milestones?: Milestone[];
  completedActions?: number;
  totalActions?: number;
}

export interface Milestone {
  id: string;
  northStarId: string;
  title: string;
  targetDate: Date | null;
  completed: boolean;
  completedAt: Date | null;
  order: number;
  createdAt: Date;
}

export interface RitualEntry {
  id: string;
  userId: string;
  date: Date;
  type: "morning" | "evening";
  gratitude1: string | null;
  gratitude2: string | null;
  gratitude3: string | null;
  gratitude4: string | null;
  gratitude5: string | null;
  proud1: string | null;
  proud2: string | null;
  proud3: string | null;
  proud4: string | null;
  proud5: string | null;
  identity: string | null;
  wins: string | null;
  reflection: string | null;
  northStarReviewed: boolean;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Identity {
  id: string;
  userId: string;
  pillar: Pillar;
  statement: string;
  active: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  habits?: Habit[];
  proofs?: IdentityProof[];
}

export interface Habit {
  id: string;
  identityId: string;
  title: string;
  frequency: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  completions?: HabitCompletion[];
  streak?: number;
  completedToday?: boolean;
}

export interface HabitCompletion {
  id: string;
  habitId: string;
  date: Date;
  completed: boolean;
  note: string | null;
  createdAt: Date;
}

export interface IdentityProof {
  id: string;
  identityId: string;
  content: string;
  date: Date;
  createdAt: Date;
}

export interface LifeScore {
  id: string;
  userId: string;
  weekStart: Date;
  healthScore: number | null;
  wealthScore: number | null;
  relationScore: number | null;
  careerScore: number | null;
  spiritualScore: number | null;
  contributionScore: number | null;
  overallScore: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WeeklyReview {
  id: string;
  userId: string;
  weekStart: Date;
  wins: string | null;
  insights: string | null;
  adjustments: string | null;
  nextFocus: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LifeSettings {
  id: string;
  userId: string;
  morningRitualTime: string | null;
  eveningRitualTime: string | null;
  weeklyReviewDay: number;
  timezone: string;
  onboardingCompleted: boolean;
  onboardingStep: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface LifeDashboard {
  northStars: NorthStar[];
  rituals: {
    morning: { completed: boolean; data: RitualEntry | null };
    evening: { completed: boolean; data: RitualEntry | null };
  };
  todaysActions: Task[];
  habits: (Habit & { identityStatement: string; pillar: Pillar })[];
  lifeScore: LifeScore | null;
  settings: LifeSettings | null;
  onboardingComplete: boolean;
}
