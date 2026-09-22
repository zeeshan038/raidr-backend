import { prisma } from "./config/db.js";

async function main() {
  try {
    const dropId = "390a16b7-ea54-477e-8ea8-b466bd5468bb";
    const updatedDrop = await prisma.dailyDrop.update({
      where: { id: dropId },
      data: {
        isRare: false,
        isCollected: false,
        rewardType: "100 COINS" // Standard enum value for 2x boost based on the code
      }
    });
    console.log("Successfully updated drop:", updatedDrop);
  } catch (error) {
    console.error("Error updating drop:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
