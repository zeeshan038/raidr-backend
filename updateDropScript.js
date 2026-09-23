import { prisma } from "./config/db.js";

async function main() {
  try {
    const dropId ="bf210114-5e4c-4c26-a574-4404d32c32ce";
    
    const updatedDrop = await prisma.dailyDrop.update({
      where: { id: dropId },
      data: {
        isRare: true,
        isCollected: false,
        rewardType: "AVATAR",
        rewardAvatarFrontUrl: "https://hel1.your-objectstorage.com/raidr-assets/avatars/1784639234403_avatar_16_front.png",
        rewardAvatarBackUrl: "https://hel1.your-objectstorage.com/raidr-assets/avatars/1784639237938_Avatar_16_back.png",
      }
    });
    
    console.log("Successfully updated drop with avatar:", updatedDrop);
  } catch (error) {
    console.error("Error updating drop:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
