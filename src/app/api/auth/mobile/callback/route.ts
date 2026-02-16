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
  // For Expo Go, we can't use custom schemes - show a success page instead
  if (params.token) {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Login Successful</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; background: #1a1a2e; color: #fff; 
           display: flex; flex-direction: column; align-items: center; justify-content: center; 
           min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
    h1 { color: #4ade80; margin-bottom: 10px; }
    p { color: #a0a0a0; margin-bottom: 30px; }
    .token-box { background: #2a2a4e; padding: 15px; border-radius: 8px; word-break: break-all; 
                 font-family: monospace; font-size: 12px; max-width: 100%; margin-bottom: 20px; }
    button { background: #6366f1; color: white; border: none; padding: 15px 30px; 
             border-radius: 8px; font-size: 16px; cursor: pointer; margin: 5px; }
    button:active { background: #4f46e5; }
    .hint { font-size: 14px; color: #666; margin-top: 20px; }
  </style>
</head>
<body>
  <h1>✓ Login Successful</h1>
  <p>Copy this token and paste it in the app:</p>
  <div class="token-box" id="token">${params.token}</div>
  <button onclick="navigator.clipboard.writeText('${params.token}').then(() => { this.textContent = 'Copied!'; })">
    Copy Token
  </button>
  <p class="hint">Go back to Expo Go and paste the token</p>
</body>
</html>`;
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } });
  }
  
  // Error case - redirect with error
  const url = new URL(`${APP_SCHEME}://auth`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return NextResponse.redirect(url.toString());
}
