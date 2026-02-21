import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// DELETE /api/life/identities/[id] - Delete an identity
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  // Verify ownership
  const existing = await prisma.identity.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Identity not found" }, { status: 404 });
  }

  // Delete identity (cascades to habits, completions, and proofs)
  await prisma.identity.delete({ where: { id } });

  return NextResponse.json({ success: true });
}

// PATCH /api/life/identities/[id] - Update an identity
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
  const { statement, active, order } = body;

  // Verify ownership
  const existing = await prisma.identity.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Identity not found" }, { status: 404 });
  }

  const identity = await prisma.identity.update({
    where: { id },
    data: {
      ...(statement !== undefined && { statement }),
      ...(active !== undefined && { active }),
      ...(order !== undefined && { order }),
    },
  });

  return NextResponse.json(identity);
}
