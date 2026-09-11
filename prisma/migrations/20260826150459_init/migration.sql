-- AlterTable
ALTER TABLE "CoinRushCheckpoint" ADD COLUMN     "answer" TEXT,
ADD COLUMN     "photoRequirements" TEXT,
ADD COLUMN     "question" TEXT,
ADD COLUMN     "referencePhotoUrl" TEXT,
ADD COLUMN     "secretCode" TEXT,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'GPS';

-- CreateTable
CREATE TABLE "CoinRushAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "checkpointId" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoinRushAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CoinRushAttempt_userId_checkpointId_key" ON "CoinRushAttempt"("userId", "checkpointId");

-- AddForeignKey
ALTER TABLE "CoinRushAttempt" ADD CONSTRAINT "CoinRushAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinRushAttempt" ADD CONSTRAINT "CoinRushAttempt_checkpointId_fkey" FOREIGN KEY ("checkpointId") REFERENCES "CoinRushCheckpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
