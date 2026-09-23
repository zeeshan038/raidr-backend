import { prisma } from "./config/db.js";

async function main() {
  try {
    const user = await prisma.user.findFirst();

    if (!user) {
      console.log("No users found in the database. Please create a user first.");
      return;
    }

    const drop = await prisma.dailyDrop.create({
      data: {
        userId: "1840e01f-c205-47ab-8d9f-eb48053aade8",
        latitude: 33.565613,
        longitude: 73.150328,
        isRare: true,
        rewardType: "AVATAR",
        rewardAvatarFrontUrl: "https://hel1.your-objectstorage.com/raidr-assets/avatars/1784639234403_avatar_16_front.png",
        rewardAvatarBackUrl: "https://hel1.your-objectstorage.com/raidr-assets/avatars/1784639237938_Avatar_16_back.png"
      }
    });

    console.log(`Successfully created a Rare Avatar Drop for user ${user.username || user.email || user.id}!`);
    console.log("Drop ID:", drop.id);
  } catch (error) {
    console.error("Error creating drop:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

