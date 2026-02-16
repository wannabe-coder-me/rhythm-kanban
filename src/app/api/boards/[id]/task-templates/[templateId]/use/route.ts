import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { emitBoardEvent } from "@/lib/events";

// Helper function to process template variables
function processTemplateVariables(text: string, userName: string): string {
  const now = new Date();
  const weekNumber = getWeekNumber(now);
  
  return text
    .replace(/\{date\}/g, now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }))
    .replace(/\{user\}/g, userName)
    .replace(/\{week\}/g, `Week ${weekNumber}`)
    .replace(/\{year\}/g, now.getFullYear().toString())
    .replace(/\{month\}/g, now.toLocaleDateString("en-US", { month: "long" }));
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// POST /api/boards/[id]/task-templates/[templateId]/use - Create a task from template
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; templateId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: boardId, templateId } = await params;
  const { columnId, overrides } = await req.json();

  if (!columnId) {
    return NextResponse.json({ error: "Column ID is required" }, { status: 400 });
  }

  // Verify user is a member of this board
  const member = await prisma.boardMember.findFirst({
    where: { boardId, userId: session.user.id },
  });

  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get the template
  const template = await prisma.taskTemplate.findFirst({
    where: { id: templateId, boardId },
  });

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  // Verify column belongs to this board
  const column = await prisma.column.findFirst({
    where: { id: columnId, boardId },
  });

  if (!column) {
    return NextResponse.json({ error: "Column not found" }, { status: 404 });
  }

  // Get user name for template variables
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true },
  });
  const userName = user?.name || "User";

  // Process template variables
  const processedTitle = processTemplateVariables(
    overrides?.title || template.title,
    userName
  );
  const processedDescription = template.description
    ? processTemplateVariables(template.description, userName)
    : null;

  // Get max position in column
  const maxPosition = await prisma.task.aggregate({
    where: { columnId },
    _max: { position: true },
  });

  // Validate label IDs exist in this board
  const validLabelIds: string[] = [];
  if (template.labels.length > 0) {
    const labels = await prisma.label.findMany({
      where: { id: { in: template.labels }, boardId },
      select: { id: true },
    });
    validLabelIds.push(...labels.map((l) => l.id));
  }

  // Create the task
  const task = await prisma.task.create({
    data: {
      columnId,
      title: processedTitle,
      description: overrides?.description ?? processedDescription,
      priority: overrides?.priority || template.priority,
      assigneeId: overrides?.assigneeId || null,
      createdById: session.user.id,
      position: (maxPosition._max.position ?? -1) + 1,
      ...(validLabelIds.length > 0 && {
        labels: {
          connect: validLabelIds.map((id) => ({ id })),
        },
      }),
    },
    include: {
      assignee: true,
      createdBy: true,
      labels: true,
      subtasks: {
        select: { id: true, completed: true },
      },
    },
  });

  // Create subtasks if template has them
  if (template.subtasks.length > 0) {
    for (let i = 0; i < template.subtasks.length; i++) {
      const subtaskTitle = processTemplateVariables(template.subtasks[i], userName);
      await prisma.task.create({
        data: {
          columnId,
          parentId: task.id,
          title: subtaskTitle,
          priority: "medium",
          createdById: session.user.id,
          position: i,
          completed: false,
        },
      });
    }

    // Refresh task with subtasks
    const taskWithSubtasks = await prisma.task.findUnique({
      where: { id: task.id },
      include: {
        assignee: true,
        createdBy: true,
        labels: true,
        subtasks: {
          include: { assignee: true, labels: true },
          orderBy: { position: "asc" },
        },
      },
    });

    // Create activity
    await prisma.activity.create({
      data: {
        taskId: task.id,
        userId: session.user.id,
        action: "created from template",
        details: { templateName: template.name, title: task.title },
      },
    });

    // Emit real-time event
    emitBoardEvent(boardId, {
      type: "task:created",
      task: taskWithSubtasks,
      userId: session.user.id,
    });

    return NextResponse.json(taskWithSubtasks);
  }

  // Create activity
  await prisma.activity.create({
    data: {
      taskId: task.id,
      userId: session.user.id,
      action: "created from template",
      details: { templateName: template.name, title: task.title },
    },
  });

  // Emit real-time event
  emitBoardEvent(boardId, {
    type: "task:created",
    task,
    userId: session.user.id,
  });

  return NextResponse.json(task);
}
