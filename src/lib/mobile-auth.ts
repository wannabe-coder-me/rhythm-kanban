import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.NEXTAUTH_SECRET || "fallback-secret-change-me";
const DEBUG_AUTH = process.env.DEBUG_AUTH === "true";

interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: string;
}

function debugLog(...args: unknown[]) {
  if (DEBUG_AUTH) {
    console.log("[auth]", ...args);
  }
}

/**
 * Get authenticated user from either NextAuth session or mobile JWT token
 */
export async function getAuthUser(req: NextRequest): Promise<AuthUser | null> {
  // First try JWT token from Authorization header (mobile)
  const authHeader = req.headers.get("authorization");
  debugLog(req.method, req.nextUrl.pathname, "| bearer:", !!authHeader);
  
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, name: true, image: true, role: true },
      });
      if (user) {
        debugLog("jwt auth:", user.id);
        return user;
      }
    } catch {
      debugLog("jwt verify failed");
    }
  }

  // Fallback to NextAuth session (web)
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, email: true, name: true, image: true, role: true },
      });
      if (user) {
        debugLog("session auth:", user.id);
        return user;
      }
    }
  } catch {
    debugLog("session check failed");
  }

  debugLog("no auth");
  return null;
}
