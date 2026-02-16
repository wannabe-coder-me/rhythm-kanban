import { NextRequest, NextResponse } from "next/server";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const BASE_URL = process.env.NEXTAUTH_URL || "https://kanban.rhythm.engineering";

// GET /api/auth/mobile/login - Initiate Google OAuth for mobile
export async function GET(req: NextRequest) {
  const state = crypto.randomUUID(); // CSRF protection
  
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: `${BASE_URL}/api/auth/mobile/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "offline",
    prompt: "select_account",
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  
  return NextResponse.redirect(authUrl);
}
