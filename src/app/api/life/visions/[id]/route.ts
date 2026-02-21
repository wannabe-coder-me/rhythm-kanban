import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/life/visions/[id] - Update a vision
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;
  const body = await request.json();

  // Verify ownership
  const existing = await prisma.vision.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Vision not found" }, { status: 404 });
  }

  const { title, description, imageUrl, horizon, order, archived } = body;

  const vision = await prisma.vision.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(imageUrl !== undefined && { imageUrl }),
      ...(horizon !== undefined && { horizon }),
      ...(order !== undefined && { order }),
      ...(archived !== undefined && { archived }),
    },
  });

  return NextResponse.json(vision);
}

// DELETE /api/life/visions/[id] - Delete a vision
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  // Verify ownership
  const existing = await prisma.vision.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Vision not found" }, { status: 404 });
  }

  await prisma.vision.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
