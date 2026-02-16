import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAndEmitActivity } from "@/lib/activity";
import { writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
import { v4 as uuid } from "uuid";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_TYPES = [
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  // PDFs
  "application/pdf",
  // Documents
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  // Spreadsheets
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  // Presentations
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

// GET - List attachments for a task
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: taskId } = await params;

  // Verify user has access to this task
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      column: {
        board: { members: { some: { userId: session.user.id } } },
      },
    },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const attachments = await prisma.attachment.findMany({
    where: { taskId },
    include: { uploadedBy: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(attachments);
}

// POST - Upload a new attachment
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: taskId } = await params;

  // Verify user has access to this task
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      column: {
        board: { members: { some: { userId: session.user.id } } },
      },
    },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File too large. Maximum size is 10MB." },
      { status: 400 }
    );
  }

  // Validate file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "File type not allowed" },
      { status: 400 }
    );
  }

  try {
    // Create upload directory for this task
    const uploadDir = join(process.cwd(), "public", "uploads", taskId);
    await mkdir(uploadDir, { recursive: true });

    // Generate unique filename
    const fileId = uuid();
    const safeFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const storedFilename = `${fileId}-${safeFilename}`;
    const filePath = join(uploadDir, storedFilename);

    // Write file to disk
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Save to database
    const attachment = await prisma.attachment.create({
      data: {
        taskId,
        filename: file.name,
        url: `/uploads/${taskId}/${storedFilename}`,
        mimeType: file.type,
        size: file.size,
        uploadedById: session.user.id,
      },
      include: { uploadedBy: true },
    });

    // Log activity and emit to subscribers
    await createAndEmitActivity(taskId, session.user.id, "added attachment", { filename: file.name });

    return NextResponse.json(attachment);
  } catch (error) {
    console.error("Failed to upload file:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}

// DELETE - Remove an attachment
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
  const attachmentId = searchParams.get("attachmentId");

  if (!attachmentId) {
    return NextResponse.json(
      { error: "Attachment ID required" },
      { status: 400 }
    );
  }

  // Verify user has access to this task
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      column: {
        board: { members: { some: { userId: session.user.id } } },
      },
    },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const attachment = await prisma.attachment.findFirst({
    where: { id: attachmentId, taskId },
  });

  if (!attachment) {
    return NextResponse.json(
      { error: "Attachment not found" },
      { status: 404 }
    );
  }

  try {
    // Delete file from disk
    const filePath = join(process.cwd(), "public", attachment.url);
    try {
      await unlink(filePath);
    } catch {
      // File may already be deleted, continue anyway
    }

    // Delete from database
    await prisma.attachment.delete({ where: { id: attachmentId } });

    // Log activity
    await prisma.activity.create({
      data: {
        taskId,
        userId: session.user.id,
        action: "removed attachment",
        details: { filename: attachment.filename },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete attachment:", error);
    return NextResponse.json(
      { error: "Failed to delete attachment" },
      { status: 500 }
    );
  }
}
