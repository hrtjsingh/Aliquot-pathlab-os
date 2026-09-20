-- Catalog print sequence + booking hide flag
ALTER TABLE "Test" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Test" ADD COLUMN "hideOnBooking" BOOLEAN NOT NULL DEFAULT false;

-- Snapshot of print/entry sequence at booking time
ALTER TABLE "OrderTest" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Reagent-lot ISI for INR calculation
ALTER TABLE "Branch" ADD COLUMN "inrIsi" DOUBLE PRECISION NOT NULL DEFAULT 1.0;

CREATE INDEX "Test_vendorId_sortOrder_idx" ON "Test"("vendorId", "sortOrder");

UPDATE "OrderTest" AS ot
SET "sortOrder" = t."sortOrder"
FROM "Test" AS t
WHERE ot."testId" = t.id;
