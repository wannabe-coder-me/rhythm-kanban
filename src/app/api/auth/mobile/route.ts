import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.NEXTAUTH_SECRET || "fallback-secret-change-me";

// POST /api/auth/mobile - Exchange Google token for app JWT
export async function POST(req: NextRequest) {
  try {
    const { accessToken, idToken } = await req.json();

    if (!accessToken && !idToken) {
      return NextResponse.json(
        { error: "accessToken or idToken required" },
        { status: 400 }
      );
    }

    // Verify token with Google and get user info
    let googleUser;
    
    if (idToken) {
      // Verify ID token
      const tokenInfoRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
      );
      if (!tokenInfoRes.ok) {
        return NextResponse.json(
          { error: "Invalid ID token" },
          { status: 401 }
        );
      }
      const tokenInfo = await tokenInfoRes.json();
      googleUser = {
        id: tokenInfo.sub,
        email: tokenInfo.email,
        name: tokenInfo.name,
        picture: tokenInfo.picture,
      };
    } else {
      // Use access token to get user info
      const userInfoRes = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (!userInfoRes.ok) {
        return NextResponse.json(
          { error: "Invalid access token" },
          { status: 401 }
        );
      }
      googleUser = await userInfoRes.json();
    }

    if (!googleUser.email) {
      return NextResponse.json(
        { error: "Could not get email from Google" },
        { status: 400 }
      );
    }

    // Find or create user
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
      if (googleUser.name || googleUser.picture) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            name: googleUser.name || user.name,
            image: googleUser.picture || user.image,
          },
        });
      }
    }

    // Create JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
      },
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      },
    });
  } catch (error) {
    console.error("Mobile auth error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}

// GET /api/auth/mobile - Verify JWT and return user
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "No token provided" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
        },
      });

      if (!user) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ user });
    } catch {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("Mobile auth verify error:", error);
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 500 }
    );
  }
}
