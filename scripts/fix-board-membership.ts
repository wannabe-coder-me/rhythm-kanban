// Run with: npx tsx scripts/fix-board-membership.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Checking for boards without owner membership...");

  // Find all boards
  const boards = await prisma.board.findMany({
    include: {
      members: true,
      owner: true,
    },
  });

  let fixed = 0;
  for (const board of boards) {
    const ownerIsMember = board.members.some((m) => m.userId === board.ownerId);
    
    if (!ownerIsMember) {
      console.log(`Fixing board "${board.name}" (${board.id}) - owner ${board.owner?.email} not in members`);
      
      await prisma.boardMember.create({
        data: {
          boardId: board.id,
          userId: board.ownerId,
          role: "admin",
          joinedAt: board.createdAt,
        },
      });
      fixed++;
    }
  }

  console.log(`\nDone! Fixed ${fixed} boards.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
