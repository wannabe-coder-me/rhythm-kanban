import { NextAuthOptions, getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import jwt from "jsonwebtoken";
import { prisma } from "./prisma";

const JWT_SECRET = process.env.NEXTAUTH_SECRET || "fallback-secret-change-me";

// Get authenticated user from either NextAuth session or JWT Bearer token
export async function getAuthUser(req: NextRequest): Promise<{ id: string; email: string; name?: string | null } | null> {
  // First try Bearer token (mobile app)
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, name: true },
      });
      
      if (user) {
        return user;
      }
    } catch {
      // Token invalid, fall through to session check
    }
  }

  // Fall back to NextAuth session (web)
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    return {
      id: session.user.id,
      email: session.user.email || "",
      name: session.user.name,
    };
  }

  return null;
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user && user) {
        session.user.id = user.id;
        // Fetch role from database
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true },
        });
        session.user.role = dbUser?.role || "member";
      }
      return session;
    },
  },
  events: {
    // Auto-accept pending invites when user signs in
    async signIn({ user, isNewUser: _isNewUser }) {
      if (!user?.email) return;

      const email = user.email.toLowerCase();

      // Find all pending invites for this email
      const pendingInvites = await prisma.boardInvite.findMany({
        where: {
          email,
          status: "pending",
          expiresAt: { gt: new Date() },
        },
      });

      // Process each invite
      for (const invite of pendingInvites) {
        // Check if already a member
        const existingMember = await prisma.boardMember.findFirst({
          where: { boardId: invite.boardId, userId: user.id },
        });

        if (!existingMember) {
          // Add user as board member
          await prisma.boardMember.create({
            data: {
              boardId: invite.boardId,
              userId: user.id,
              role: invite.role,
              invitedById: invite.invitedById,
              joinedAt: new Date(),
            },
          });
        }

        // Mark invite as accepted
        await prisma.boardInvite.update({
          where: { id: invite.id },
          data: { status: "accepted", acceptedAt: new Date() },
        });
      }
    },
  },
  pages: {
    signIn: "/login",
  },
};
