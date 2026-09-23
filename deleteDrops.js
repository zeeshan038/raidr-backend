import { prisma } from "./config/db.js";

async function main() {
  try {
    const deleted = await prisma.dailyDrop.deleteMany({});
    console.log(`Successfully deleted all ${deleted.count} drops from the database!`);
  } catch (error) {
    console.error("Error deleting drops:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
