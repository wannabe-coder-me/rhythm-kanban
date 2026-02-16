export interface TemplateColumn {
  name: string;
  color: string;
}

export interface TemplateLabel {
  name: string;
  color: string;
}

export interface BoardTemplate {
  id: string;
  name: string;
  description: string;
  columns: TemplateColumn[];
  labels: TemplateLabel[];
}

export const boardTemplates: BoardTemplate[] = [
  {
    id: "blank",
    name: "Blank Board",
    description: "Start from scratch",
    columns: [
      { name: "To Do", color: "#6366f1" },
      { name: "In Progress", color: "#f59e0b" },
      { name: "Done", color: "#22c55e" },
    ],
    labels: [],
  },
  {
    id: "sprint",
    name: "Sprint Board",
    description: "Agile sprint planning",
    columns: [
      { name: "Backlog", color: "#6b7280" },
      { name: "To Do", color: "#6366f1" },
      { name: "In Progress", color: "#f59e0b" },
      { name: "Review", color: "#8b5cf6" },
      { name: "Done", color: "#22c55e" },
    ],
    labels: [
      { name: "Bug", color: "#ef4444" },
      { name: "Feature", color: "#3b82f6" },
      { name: "Tech Debt", color: "#f97316" },
      { name: "Documentation", color: "#6b7280" },
    ],
  },
  {
    id: "roadmap",
    name: "Product Roadmap",
    description: "Plan product features",
    columns: [
      { name: "Ideas", color: "#8b5cf6" },
      { name: "Planned", color: "#6366f1" },
      { name: "In Development", color: "#f59e0b" },
      { name: "Shipped", color: "#22c55e" },
    ],
    labels: [
      { name: "P0 - Critical", color: "#ef4444" },
      { name: "P1 - High", color: "#f97316" },
      { name: "P2 - Medium", color: "#eab308" },
      { name: "P3 - Low", color: "#22c55e" },
    ],
  },
  {
    id: "sales-pipeline",
    name: "Sales Pipeline",
    description: "Track sales opportunities",
    columns: [
      { name: "Lead", color: "#6b7280" },
      { name: "Contacted", color: "#6366f1" },
      { name: "Proposal", color: "#f59e0b" },
      { name: "Negotiation", color: "#8b5cf6" },
      { name: "Won", color: "#22c55e" },
      { name: "Lost", color: "#ef4444" },
    ],
    labels: [
      { name: "Hot", color: "#ef4444" },
      { name: "Warm", color: "#f97316" },
      { name: "Cold", color: "#3b82f6" },
    ],
  },
  {
    id: "content-calendar",
    name: "Content Calendar",
    description: "Plan and track content",
    columns: [
      { name: "Ideas", color: "#8b5cf6" },
      { name: "Writing", color: "#6366f1" },
      { name: "Review", color: "#f59e0b" },
      { name: "Scheduled", color: "#22c55e" },
      { name: "Published", color: "#10b981" },
    ],
    labels: [
      { name: "Blog", color: "#3b82f6" },
      { name: "Social", color: "#ec4899" },
      { name: "Video", color: "#ef4444" },
      { name: "Newsletter", color: "#f97316" },
    ],
  },
];

export function getTemplateById(id: string): BoardTemplate | undefined {
  return boardTemplates.find((t) => t.id === id);
}
