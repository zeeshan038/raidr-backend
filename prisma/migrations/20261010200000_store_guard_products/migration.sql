ALTER TABLE "Store" ADD COLUMN "itemType" TEXT NOT NULL DEFAULT 'AVATAR';
ALTER TABLE "Store" ADD COLUMN "guardsPerPurchase" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Store" ADD COLUMN "isStoreActive" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "Store_itemType_idx" ON "Store"("itemType");
CREATE INDEX "Store_isStoreActive_idx" ON "Store"("isStoreActive");
