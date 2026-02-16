import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const BASE_URL = process.env.NEXTAUTH_URL || "https://kanban.rhythm.engineering";
const JWT_SECRET = process.env.NEXTAUTH_SECRET || "fallback-secret-change-me";
const APP_SCHEME = "rhythm-kanban";

// GET /api/auth/mobile/callback - Handle Google OAuth callback
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      return redirectToApp({ error: error });
    }

    if (!code) {
      return redirectToApp({ error: "no_code" });
    }

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: `${BASE_URL}/api/auth/mobile/callback`,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("Token exchange failed:", err);
      return redirectToApp({ error: "token_exchange_failed" });
    }

    const tokens = await tokenRes.json();

    // Get user info from Google
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userRes.ok) {
      return redirectToApp({ error: "userinfo_failed" });
    }

    const googleUser = await userRes.json();

    if (!googleUser.email) {
      return redirectToApp({ error: "no_email" });
    }

    // Find or create user in database
    let user = await prisma.user.findUnique({
      where: { email: googleUser.email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: googleUser.email,
          name: googleUser.name || googleUser.email.split("@")[0],
          image: googleUser.picture || null,
        },
      });
    } else {
      // Update user info if changed
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name: googleUser.name || user.name,
          image: googleUser.picture || user.image,
        },
      });
    }

    // Create JWT token for the mobile app
    const appToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
      },
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    // Redirect back to app with token
    return redirectToApp({ token: appToken });
  } catch (error) {
    console.error("Mobile OAuth callback error:", error);
    return redirectToApp({ error: "server_error" });
  }
}

function redirectToApp(params: Record<string, string>) {
  const url = new URL(`${APP_SCHEME}://auth`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return NextResponse.redirect(url.toString());
}
