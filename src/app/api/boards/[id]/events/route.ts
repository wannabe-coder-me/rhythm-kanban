import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { subscribe, getConnectedUsers, BoardEvent } from "@/lib/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Heartbeat interval in ms (default 30s, configurable via env)
const SSE_HEARTBEAT_MS = parseInt(process.env.SSE_HEARTBEAT_MS || "30000", 10);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: boardId } = await params;

  // Verify user has access to this board
  const member = await prisma.boardMember.findFirst({
    where: { boardId, userId: session.user.id },
  });

  if (!member) {
    return new Response("Forbidden", { status: 403 });
  }

  const userId = session.user.id;
  const userName = session.user.name || session.user.email || "Unknown";

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connected users
      const connectedUsers = getConnectedUsers(boardId);
      const initialEvent = {
        type: "init",
        connectedUsers: [...connectedUsers, { userId, userName }],
      };
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify(initialEvent)}\n\n`)
      );

      // Heartbeat to keep connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          // Stream closed
          clearInterval(heartbeatInterval);
        }
      }, SSE_HEARTBEAT_MS);

      // Subscribe to board events
      const unsubscribe = subscribe(
        boardId,
        (event: BoardEvent) => {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
            );
          } catch {
            // Stream closed, unsubscribe
            clearInterval(heartbeatInterval);
            unsubscribe();
          }
        },
        userId,
        userName
      );

      // Handle client disconnect
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeatInterval);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
