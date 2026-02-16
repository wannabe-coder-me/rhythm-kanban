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

export interface Board {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
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
  assignee?: User | null;
  createdBy?: User;
  comments?: Comment[];
  column?: Column;
  subtasks?: Task[];
  parent?: Task;
  attachments?: Attachment[];
  _count?: { attachments?: number };
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
