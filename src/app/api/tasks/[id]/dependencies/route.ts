import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { emitBoardEvent } from "@/lib/events";

// GET /api/tasks/[id]/dependencies - List dependencies for a task
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify user has access to the task
  const task = await prisma.task.findFirst({
    where: {
      id,
      column: {
        board: { members: { some: { userId: session.user.id } } },
      },
    },
    include: {
      blockedBy: {
        include: {
          blockedBy: {
            select: {
              id: true,
              title: true,
              completed: true,
              columnId: true,
              column: { select: { name: true } },
            },
          },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      },
      blocking: {
        include: {
          task: {
            select: {
              id: true,
              title: true,
              completed: true,
              columnId: true,
              column: { select: { name: true } },
            },
          },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json({
    blockedBy: task.blockedBy,
    blocking: task.blocking,
  });
}

// POST /api/tasks/[id]/dependencies - Add a dependency
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: taskId } = await params;
  const { blockedById } = await req.json();

  if (!blockedById) {
    return NextResponse.json(
      { error: "blockedById is required" },
      { status: 400 }
    );
  }

  // Can't depend on itself
  if (taskId === blockedById) {
    return NextResponse.json(
      { error: "A task cannot depend on itself" },
      { status: 400 }
    );
  }

  // Verify user has access to both tasks and they're on the same board
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      column: {
        board: { members: { some: { userId: session.user.id } } },
      },
    },
    include: {
      column: { include: { board: { select: { id: true } } } },
    },
  });

  const blockerTask = await prisma.task.findFirst({
    where: {
      id: blockedById,
      column: {
        board: { members: { some: { userId: session.user.id } } },
      },
    },
    include: {
      column: { include: { board: { select: { id: true } } } },
    },
  });

  if (!task || !blockerTask) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // Verify both tasks are on the same board
  if (task.column.board.id !== blockerTask.column.board.id) {
    return NextResponse.json(
      { error: "Tasks must be on the same board" },
      { status: 400 }
    );
  }

  // Check for reverse dependency (circular)
  const reverseExists = await prisma.taskDependency.findUnique({
    where: {
      taskId_blockedById: {
        taskId: blockedById,
        blockedById: taskId,
      },
    },
  });

  if (reverseExists) {
    return NextResponse.json(
      { error: "Circular dependency: the blocker task already depends on this task" },
      { status: 400 }
    );
  }

  // Check for indirect circular dependencies (A→B→C, can't add C→A)
  const hasIndirectCircular = await checkCircularDependency(blockedById, taskId);
  if (hasIndirectCircular) {
    return NextResponse.json(
      { error: "Circular dependency: this would create a dependency cycle" },
      { status: 400 }
    );
  }

  // Check if dependency already exists
  const existing = await prisma.taskDependency.findUnique({
    where: {
      taskId_blockedById: { taskId, blockedById },
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "Dependency already exists" },
      { status: 400 }
    );
  }

  // Create the dependency
  const dependency = await prisma.taskDependency.create({
    data: {
      taskId,
      blockedById,
      createdById: session.user.id,
    },
    include: {
      blockedBy: {
        select: {
          id: true,
          title: true,
          completed: true,
          columnId: true,
          column: { select: { name: true } },
        },
      },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  // Create activity log
  await prisma.activity.create({
    data: {
      taskId,
      userId: session.user.id,
      action: "added dependency",
      details: {
        blockedByTaskId: blockedById,
        blockedByTaskTitle: blockerTask.title,
      },
    },
  });

  // Emit real-time event
  emitBoardEvent(task.column.board.id, {
    type: "task:updated",
    task: { id: taskId },
    userId: session.user.id,
  });

  return NextResponse.json(dependency);
}

// DELETE /api/tasks/[id]/dependencies - Remove a dependency
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: taskId } = await params;
  const { searchParams } = new URL(req.url);
  const blockedById = searchParams.get("blockedById");

  if (!blockedById) {
    return NextResponse.json(
      { error: "blockedById query parameter is required" },
      { status: 400 }
    );
  }

  // Verify user has access to the task
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      column: {
        board: { members: { some: { userId: session.user.id } } },
      },
    },
    include: {
      column: { include: { board: { select: { id: true } } } },
    },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // Find and delete the dependency
  const dependency = await prisma.taskDependency.findUnique({
    where: {
      taskId_blockedById: { taskId, blockedById },
    },
    include: {
      blockedBy: { select: { title: true } },
    },
  });

  if (!dependency) {
    return NextResponse.json({ error: "Dependency not found" }, { status: 404 });
  }

  await prisma.taskDependency.delete({
    where: { id: dependency.id },
  });

  // Create activity log
  await prisma.activity.create({
    data: {
      taskId,
      userId: session.user.id,
      action: "removed dependency",
      details: {
        blockedByTaskId: blockedById,
        blockedByTaskTitle: dependency.blockedBy.title,
      },
    },
  });

  // Emit real-time event
  emitBoardEvent(task.column.board.id, {
    type: "task:updated",
    task: { id: taskId },
    userId: session.user.id,
  });

  return NextResponse.json({ success: true });
}

// Helper: Check for indirect circular dependencies using BFS
async function checkCircularDependency(
  startTaskId: string,
  targetTaskId: string
): Promise<boolean> {
  const visited = new Set<string>();
  const queue = [startTaskId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    // Get all tasks that this task depends on (is blocked by)
    const dependencies = await prisma.taskDependency.findMany({
      where: { taskId: currentId },
      select: { blockedById: true },
    });

    for (const dep of dependencies) {
      if (dep.blockedById === targetTaskId) {
        return true; // Found circular dependency
      }
      if (!visited.has(dep.blockedById)) {
        queue.push(dep.blockedById);
      }
    }
  }

  return false;
}
