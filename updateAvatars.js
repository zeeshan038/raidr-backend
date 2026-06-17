import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function updateAvatars() {
    try {
        await prisma.avatar.updateMany({
            where: { avatarNumber: { in: [1, 2] } },
            data: { requiredLevel: 1 }
        });
        await prisma.avatar.updateMany({
            where: { avatarNumber: { in: [3, 4] } },
            data: { requiredLevel: 2 }
        });
        console.log("Avatars updated successfully!");
    } catch (e) {
        console.error("Error updating avatars:", e);
    } finally {
        await prisma.$disconnect();
    }
}

updateAvatars();
