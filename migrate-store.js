import { PrismaClient } from '@prisma/client';

const devPrisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://raidr_user:raidr_password@188.245.72.1:5432/raidr_db?schema=public"
    }
  }
});

const prodPrisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://raidr_user:raidr_password@188.245.72.1:5432/raidr_prod?schema=public"
    }
  }
});

async function migrate() {
  try {
    const stores = await devPrisma.store.findMany();
    console.log(`Found ${stores.length} stores in dev.`);
    
    let count = 0;
    for (const store of stores) {
      await prodPrisma.store.upsert({
        where: { id: store.id },
        update: store,
        create: store,
      });
      count++;
    }
    
    console.log(`Successfully migrated ${count} stores to prod.`);
  } catch (error) {
    console.error("Error during migration:", error);
  } finally {
    await devPrisma.$disconnect();
    await prodPrisma.$disconnect();
  }
}

migrate();
