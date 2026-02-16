import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.NEXTAUTH_SECRET || "fallback-secret-change-me";

interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: string;
}

/**
 * Get authenticated user from either NextAuth session or mobile JWT token
 */
export async function getAuthUser(req: NextRequest): Promise<AuthUser | null> {
  // First try JWT token from Authorization header (mobile)
  const authHeader = req.headers.get("authorization");
  console.log("[getAuthUser] Auth header present:", !!authHeader);
  
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    console.log("[getAuthUser] Token length:", token.length);
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
      console.log("[getAuthUser] JWT decoded, userId:", decoded.userId);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, name: true, image: true, role: true },
      });
      console.log("[getAuthUser] User found:", !!user);
      if (user) return user;
    } catch (err) {
      console.log("[getAuthUser] JWT verify failed:", err);
    }
  }

  // Fallback to NextAuth session (web)
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      console.log("[getAuthUser] Session user:", session.user.id);
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, email: true, name: true, image: true, role: true },
      });
      return user;
    }
  } catch (err) {
    console.log("[getAuthUser] Session check failed:", err);
  }

  console.log("[getAuthUser] No auth found");
  return null;
}
