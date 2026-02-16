import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { subscribeToBoard, unsubscribeFromBoard } from "@/lib/activity-emitter";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Get all boards the user has access to
  const userBoardIds = await prisma.boardMember.findMany({
    where: { userId: session.user.id },
    select: { boardId: true },
  });
  const accessibleBoardIds = userBoardIds.map((b) => b.boardId);

  if (accessibleBoardIds.length === 0) {
    return new Response("No boards accessible", { status: 403 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      // Subscribe to all accessible boards
      accessibleBoardIds.forEach((boardId) => {
        subscribeToBoard(boardId, send);
      });

      // Send heartbeat every 30 seconds
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30000);

      // Cleanup on close
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        accessibleBoardIds.forEach((boardId) => {
          unsubscribeFromBoard(boardId, send);
        });
      });

      // Send initial connection confirmation
      send(JSON.stringify({ type: "connected", boardIds: accessibleBoardIds }));
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
