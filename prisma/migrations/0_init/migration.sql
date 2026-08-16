-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "password" TEXT,
    "lat" TEXT,
    "long" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "authProvider" TEXT NOT NULL DEFAULT 'email',
    "signupMethod" TEXT NOT NULL DEFAULT 'manual',
    "agreedToTerms" BOOLEAN NOT NULL DEFAULT false,
    "firebaseUid" TEXT,
    "photoUrl" TEXT NOT NULL DEFAULT '',
    "otpCode" TEXT,
    "otpCreatedAt" TIMESTAMP(3),
    "otpUpdatedAt" TIMESTAMP(3),
    "otpCodeExpireTime" TIMESTAMP(3),
    "avatarBackUrl" TEXT NOT NULL DEFAULT 'https://hel1.your-objectstorage.com/raidr-assets/avatars/1_back.png',
    "avatarUpdatedAt" TIMESTAMP(3),
    "selectedAvatarId" TEXT NOT NULL DEFAULT '',
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp_earned" INTEGER NOT NULL DEFAULT 0,
    "xp_progress" INTEGER NOT NULL DEFAULT 0,
    "quests_played" INTEGER NOT NULL DEFAULT 0,
    "rewards_claimed" INTEGER NOT NULL DEFAULT 0,
    "green_boxes_count" INTEGER NOT NULL DEFAULT 0,
    "golden_boxes_count" INTEGER NOT NULL DEFAULT 0,
    "purple_boxes_count" INTEGER NOT NULL DEFAULT 0,
    "distance_covered_km" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "has_seen_level_welcome" BOOLEAN NOT NULL DEFAULT false,
    "fcmToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "avatarFrontUrl" TEXT NOT NULL DEFAULT 'https://hel1.your-objectstorage.com/raidr-assets/avatars/1_front.png',
    "isNewUser" BOOLEAN NOT NULL DEFAULT false,
    "isReviewed" BOOLEAN NOT NULL DEFAULT false,
    "raidrCoins" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoxCollectionLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "boxType" TEXT NOT NULL,
    "xpEarned" INTEGER NOT NULL,
    "distanceCoveredKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "source" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adData" JSONB,
    "isClaimed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BoxCollectionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "routeTitle" TEXT,
    "destination" TEXT,
    "hotelLocation" TEXT,
    "tripDates" TIMESTAMP(3)[],
    "status" TEXT,
    "tripPace" BOOLEAN,
    "radiusKm" DOUBLE PRECISION,
    "travelWith" TEXT,
    "interestedVibes" TEXT[],
    "routesByDate" JSONB,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "inviteToken" TEXT,
    "currentLatitude" DOUBLE PRECISION,
    "currentLongitude" DOUBLE PRECISION,
    "lastLocationUpdatedAt" TIMESTAMP(3),
    "navStatus" TEXT,
    "flowKind" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "destinationLat" DOUBLE PRECISION,
    "destinationLng" DOUBLE PRECISION,
    "hotelLat" DOUBLE PRECISION,
    "agreedToSafetyWarning" BOOLEAN NOT NULL DEFAULT false,
    "hotelLng" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Avatar" (
    "id" TEXT NOT NULL,
    "avatarNumber" INTEGER NOT NULL,
    "frontUrl" TEXT NOT NULL,
    "backUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Avatar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Box" (
    "id" TEXT NOT NULL,
    "boxNumber" INTEGER NOT NULL,
    "frontUrl" TEXT NOT NULL,
    "backUrl" TEXT NOT NULL,
    "requiredLevel" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Box_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaidPurchaseHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "coinsAmount" INTEGER NOT NULL,
    "priceUsd" DOUBLE PRECISION NOT NULL,
    "transactionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RaidPurchaseHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Merchant" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "name" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "defaultRadiusMeter" DOUBLE PRECISION,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "photoUrl" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "credits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantAds" (
    "id" TEXT NOT NULL,
    "adCategory" TEXT NOT NULL,
    "adTitle" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "approvalStatus" TEXT NOT NULL DEFAULT 'pending',
    "boxOpens" INTEGER NOT NULL DEFAULT 0,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "descriptionText" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "logoUrl" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "merchantName" TEXT NOT NULL,
    "mysteryBoxReward" TEXT NOT NULL,
    "radius" INTEGER NOT NULL DEFAULT 0,
    "rewardClaims" INTEGER NOT NULL DEFAULT 0,
    "stockLimit" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "categoryName" TEXT NOT NULL,

    CONSTRAINT "MerchantAds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdImpression" (
    "id" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdImpression_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantAdClaim" (
    "id" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchantAdClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantAdCode" (
    "id" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isClaimed" BOOLEAN NOT NULL DEFAULT false,
    "isRedeemed" BOOLEAN NOT NULL DEFAULT false,
    "redeemedAt" TIMESTAMP(3),
    "claimId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchantAdCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "merchantId" TEXT NOT NULL,
    "commanderAvatar" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "reward" TEXT NOT NULL,
    "rewardQuantity" INTEGER NOT NULL,
    "remainingQty" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "xpReward" INTEGER NOT NULL DEFAULT 0,
    "size" TEXT NOT NULL DEFAULT 'small',
    "qrCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveEventParticipant" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agreedToSafetyWarning" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveEventParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveEventClaim" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT,
    "isRedeemed" BOOLEAN NOT NULL DEFAULT false,
    "redeemedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "xpEarned" INTEGER NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,

    CONSTRAINT "LiveEventClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserOwnedAvatar" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserOwnedAvatar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantCreditPurchase" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "creditsAmount" INTEGER NOT NULL,
    "priceUsd" DOUBLE PRECISION NOT NULL,
    "transactionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantCreditPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantCreditLog" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "eventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchantCreditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "frontUrl" TEXT NOT NULL,
    "backUrl" TEXT NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0,
    "isNew" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoinRushEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "checkpointCount" INTEGER NOT NULL DEFAULT 5,
    "duration" INTEGER NOT NULL,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "centerLat" DOUBLE PRECISION,
    "centerLng" DOUBLE PRECISION,
    "radiusMeter" DOUBLE PRECISION,
    "rewardType" TEXT NOT NULL,
    "rewardTitle" TEXT NOT NULL,
    "rewardImageUrl" TEXT NOT NULL DEFAULT '',
    "rewardDescription" TEXT NOT NULL DEFAULT '',
    "rewardClaimInstructions" TEXT NOT NULL DEFAULT '',
    "rewardValue" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "winnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoinRushEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoinRushCheckpoint" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "qrCode" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "xp" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinRushCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoinRushParticipant" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agreedToSafetyWarning" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinRushParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoinRushProgress" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "checkpointId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinRushProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoinRushClaim" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isRedeemed" BOOLEAN NOT NULL DEFAULT false,
    "redeemedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinRushClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_firebaseUid_key" ON "User"("firebaseUid");

-- CreateIndex
CREATE INDEX "BoxCollectionLog_userId_idx" ON "BoxCollectionLog"("userId");

-- CreateIndex
CREATE INDEX "BoxCollectionLog_createdAt_idx" ON "BoxCollectionLog"("createdAt");

-- CreateIndex
CREATE INDEX "Trip_userId_status_createdAt_idx" ON "Trip"("userId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Trip_isShared_idx" ON "Trip"("isShared");

-- CreateIndex
CREATE INDEX "Trip_userId_lastLocationUpdatedAt_idx" ON "Trip"("userId", "lastLocationUpdatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Avatar_avatarNumber_key" ON "Avatar"("avatarNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Box_boxNumber_key" ON "Box"("boxNumber");

-- CreateIndex
CREATE UNIQUE INDEX "RaidPurchaseHistory_transactionId_key" ON "RaidPurchaseHistory"("transactionId");

-- CreateIndex
CREATE INDEX "RaidPurchaseHistory_userId_idx" ON "RaidPurchaseHistory"("userId");

-- CreateIndex
CREATE INDEX "RaidPurchaseHistory_createdAt_idx" ON "RaidPurchaseHistory"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_email_key" ON "Merchant"("email");

-- CreateIndex
CREATE INDEX "AdImpression_adId_idx" ON "AdImpression"("adId");

-- CreateIndex
CREATE INDEX "AdImpression_userId_idx" ON "AdImpression"("userId");

-- CreateIndex
CREATE INDEX "AdImpression_createdAt_idx" ON "AdImpression"("createdAt");

-- CreateIndex
CREATE INDEX "MerchantAdClaim_adId_idx" ON "MerchantAdClaim"("adId");

-- CreateIndex
CREATE INDEX "MerchantAdClaim_userId_idx" ON "MerchantAdClaim"("userId");

-- CreateIndex
CREATE INDEX "MerchantAdClaim_createdAt_idx" ON "MerchantAdClaim"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantAdClaim_userId_adId_key" ON "MerchantAdClaim"("userId", "adId");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantAdCode_code_key" ON "MerchantAdCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantAdCode_claimId_key" ON "MerchantAdCode"("claimId");

-- CreateIndex
CREATE INDEX "MerchantAdCode_adId_idx" ON "MerchantAdCode"("adId");

-- CreateIndex
CREATE INDEX "MerchantAdCode_isClaimed_idx" ON "MerchantAdCode"("isClaimed");

-- CreateIndex
CREATE UNIQUE INDEX "LiveEvent_qrCode_key" ON "LiveEvent"("qrCode");

-- CreateIndex
CREATE INDEX "LiveEvent_merchantId_idx" ON "LiveEvent"("merchantId");

-- CreateIndex
CREATE INDEX "LiveEvent_status_idx" ON "LiveEvent"("status");

-- CreateIndex
CREATE INDEX "LiveEvent_startTime_idx" ON "LiveEvent"("startTime");

-- CreateIndex
CREATE INDEX "LiveEvent_endTime_idx" ON "LiveEvent"("endTime");

-- CreateIndex
CREATE INDEX "LiveEventParticipant_eventId_idx" ON "LiveEventParticipant"("eventId");

-- CreateIndex
CREATE INDEX "LiveEventParticipant_userId_idx" ON "LiveEventParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveEventParticipant_eventId_userId_key" ON "LiveEventParticipant"("eventId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveEventClaim_code_key" ON "LiveEventClaim"("code");

-- CreateIndex
CREATE INDEX "LiveEventClaim_eventId_idx" ON "LiveEventClaim"("eventId");

-- CreateIndex
CREATE INDEX "LiveEventClaim_userId_idx" ON "LiveEventClaim"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveEventClaim_eventId_userId_key" ON "LiveEventClaim"("eventId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserOwnedAvatar_userId_storeId_key" ON "UserOwnedAvatar"("userId", "storeId");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantCreditPurchase_transactionId_key" ON "MerchantCreditPurchase"("transactionId");

-- CreateIndex
CREATE INDEX "MerchantCreditPurchase_merchantId_idx" ON "MerchantCreditPurchase"("merchantId");

-- CreateIndex
CREATE INDEX "MerchantCreditPurchase_createdAt_idx" ON "MerchantCreditPurchase"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "MerchantCreditLog_merchantId_idx" ON "MerchantCreditLog"("merchantId");

-- CreateIndex
CREATE INDEX "MerchantCreditLog_createdAt_idx" ON "MerchantCreditLog"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE INDEX "CoinRushEvent_merchantId_idx" ON "CoinRushEvent"("merchantId");

-- CreateIndex
CREATE INDEX "CoinRushEvent_status_idx" ON "CoinRushEvent"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CoinRushCheckpoint_qrCode_key" ON "CoinRushCheckpoint"("qrCode");

-- CreateIndex
CREATE INDEX "CoinRushCheckpoint_eventId_idx" ON "CoinRushCheckpoint"("eventId");

-- CreateIndex
CREATE INDEX "CoinRushParticipant_eventId_idx" ON "CoinRushParticipant"("eventId");

-- CreateIndex
CREATE INDEX "CoinRushParticipant_userId_idx" ON "CoinRushParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CoinRushParticipant_eventId_userId_key" ON "CoinRushParticipant"("eventId", "userId");

-- CreateIndex
CREATE INDEX "CoinRushProgress_eventId_userId_idx" ON "CoinRushProgress"("eventId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CoinRushProgress_eventId_userId_checkpointId_key" ON "CoinRushProgress"("eventId", "userId", "checkpointId");

-- CreateIndex
CREATE UNIQUE INDEX "CoinRushClaim_code_key" ON "CoinRushClaim"("code");

-- CreateIndex
CREATE INDEX "CoinRushClaim_eventId_idx" ON "CoinRushClaim"("eventId");

-- CreateIndex
CREATE INDEX "CoinRushClaim_userId_idx" ON "CoinRushClaim"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CoinRushClaim_eventId_userId_key" ON "CoinRushClaim"("eventId", "userId");

-- CreateIndex
CREATE INDEX "Review_userId_idx" ON "Review"("userId");

-- AddForeignKey
ALTER TABLE "BoxCollectionLog" ADD CONSTRAINT "BoxCollectionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaidPurchaseHistory" ADD CONSTRAINT "RaidPurchaseHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantAds" ADD CONSTRAINT "MerchantAds_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdImpression" ADD CONSTRAINT "AdImpression_adId_fkey" FOREIGN KEY ("adId") REFERENCES "MerchantAds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdImpression" ADD CONSTRAINT "AdImpression_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantAdClaim" ADD CONSTRAINT "MerchantAdClaim_adId_fkey" FOREIGN KEY ("adId") REFERENCES "MerchantAds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantAdClaim" ADD CONSTRAINT "MerchantAdClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantAdCode" ADD CONSTRAINT "MerchantAdCode_adId_fkey" FOREIGN KEY ("adId") REFERENCES "MerchantAds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantAdCode" ADD CONSTRAINT "MerchantAdCode_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "MerchantAdClaim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveEvent" ADD CONSTRAINT "LiveEvent_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveEventParticipant" ADD CONSTRAINT "LiveEventParticipant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "LiveEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveEventParticipant" ADD CONSTRAINT "LiveEventParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveEventClaim" ADD CONSTRAINT "LiveEventClaim_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "LiveEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveEventClaim" ADD CONSTRAINT "LiveEventClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOwnedAvatar" ADD CONSTRAINT "UserOwnedAvatar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOwnedAvatar" ADD CONSTRAINT "UserOwnedAvatar_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantCreditPurchase" ADD CONSTRAINT "MerchantCreditPurchase_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantCreditLog" ADD CONSTRAINT "MerchantCreditLog_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantCreditLog" ADD CONSTRAINT "MerchantCreditLog_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "LiveEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinRushEvent" ADD CONSTRAINT "CoinRushEvent_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinRushCheckpoint" ADD CONSTRAINT "CoinRushCheckpoint_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CoinRushEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinRushParticipant" ADD CONSTRAINT "CoinRushParticipant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CoinRushEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinRushParticipant" ADD CONSTRAINT "CoinRushParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinRushProgress" ADD CONSTRAINT "CoinRushProgress_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CoinRushEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinRushProgress" ADD CONSTRAINT "CoinRushProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinRushProgress" ADD CONSTRAINT "CoinRushProgress_checkpointId_fkey" FOREIGN KEY ("checkpointId") REFERENCES "CoinRushCheckpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinRushClaim" ADD CONSTRAINT "CoinRushClaim_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CoinRushEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinRushClaim" ADD CONSTRAINT "CoinRushClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

