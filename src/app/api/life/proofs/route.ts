import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/life/proofs - Create an identity proof
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { identityId, content, date } = body;

  if (!identityId || !content) {
    return NextResponse.json(
      { error: "Identity ID and content are required" },
      { status: 400 }
    );
  }

  // Verify identity belongs to user
  const identity = await prisma.identity.findFirst({
    where: { id: identityId, userId: session.user.id },
  });

  if (!identity) {
    return NextResponse.json({ error: "Identity not found" }, { status: 404 });
  }

  const proof = await prisma.identityProof.create({
    data: {
      identityId,
      content,
      date: date ? new Date(date) : new Date(),
    },
  });

  return NextResponse.json(proof, { status: 201 });
}
