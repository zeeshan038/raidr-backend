import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ConnectDB = async () => {
  try {
    await prisma.$connect();
    console.log("PostgreSQL Connection Created via Prisma");
  } catch (error) {
    console.error("Database connection error:", error);
    process.exit(1);
  }
};

export { prisma };
export default ConnectDB; 