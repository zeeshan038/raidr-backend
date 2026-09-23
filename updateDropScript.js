import { prisma } from "./config/db.js";

async function main() {
  try {
    const dropId = "bf210114-5e4c-4c26-a574-4404d32c32ce";

    // Find an active voucher in the database
    const voucher = await prisma.commercialVoucher.findFirst({
      where: { isActive: true }
    });

    if (!voucher) {
      console.log("No active vouchers found in the database. Cannot assign voucher reward.");
      return;
    }

    // Delete the old drop
    await prisma.dailyDrop.delete({
      where: { id: dropId }
    });

    // Recreate a fresh standard daily drop
    const newDrop = await prisma.dailyDrop.create({
      data: {
        id: dropId,
        userId: "e4abf66a-a5ce-48ae-827a-fe814cc525c6",
        latitude: 33.56476358195941,
        longitude: 73.15148834741022,
        isCollected: false,
        isRare: false,
        rewardType: "100_COINS",
        rewardAmount: 100,
        rewardAvatarFrontUrl: null,
        rewardAvatarBackUrl: null,
        rewardVoucherTitle: null,
        rewardVoucherSponsor: null,
        rewardVoucherCode: null,
        rewardVoucherImageUrl: null,
      }
    });

    console.log("Successfully deleted and recreated a fresh daily drop:", newDrop);
  } catch (error) {
    console.error("Error updating drop:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
