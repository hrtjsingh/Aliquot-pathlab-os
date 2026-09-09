-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "primaryColor" TEXT,
    "letterheadUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Vendor_slug_key" ON "Vendor"("slug");

INSERT INTO "Vendor" ("id", "slug", "name", "active", "createdAt", "updatedAt")
VALUES ('clvendor_aliquot_default', 'aliquot', 'Aliquot Lab', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- AlterTable User
ALTER TABLE "User" ADD COLUMN "vendorId" TEXT;
UPDATE "User" SET "vendorId" = 'clvendor_aliquot_default' WHERE "vendorId" IS NULL;
ALTER TABLE "User" ALTER COLUMN "vendorId" SET NOT NULL;
DROP INDEX IF EXISTS "User_email_key";
CREATE UNIQUE INDEX "User_vendorId_email_key" ON "User"("vendorId", "email");
CREATE INDEX "User_vendorId_idx" ON "User"("vendorId");
ALTER TABLE "User" ADD CONSTRAINT "User_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable Branch
ALTER TABLE "Branch" ADD COLUMN "vendorId" TEXT;
ALTER TABLE "Branch" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "Branch" SET "vendorId" = 'clvendor_aliquot_default' WHERE "vendorId" IS NULL;
ALTER TABLE "Branch" ALTER COLUMN "vendorId" SET NOT NULL;
DROP INDEX IF EXISTS "Branch_code_key";
CREATE UNIQUE INDEX "Branch_vendorId_code_key" ON "Branch"("vendorId", "code");
CREATE INDEX "Branch_vendorId_idx" ON "Branch"("vendorId");
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable Patient
ALTER TABLE "Patient" ADD COLUMN "vendorId" TEXT;
UPDATE "Patient" SET "vendorId" = 'clvendor_aliquot_default' WHERE "vendorId" IS NULL;
ALTER TABLE "Patient" ALTER COLUMN "vendorId" SET NOT NULL;
DROP INDEX IF EXISTS "Patient_mrn_key";
CREATE UNIQUE INDEX "Patient_vendorId_mrn_key" ON "Patient"("vendorId", "mrn");
CREATE INDEX "Patient_vendorId_idx" ON "Patient"("vendorId");
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable Test
ALTER TABLE "Test" ADD COLUMN "vendorId" TEXT;
UPDATE "Test" SET "vendorId" = 'clvendor_aliquot_default' WHERE "vendorId" IS NULL;
ALTER TABLE "Test" ALTER COLUMN "vendorId" SET NOT NULL;
DROP INDEX IF EXISTS "Test_code_key";
CREATE UNIQUE INDEX "Test_vendorId_code_key" ON "Test"("vendorId", "code");
CREATE INDEX "Test_vendorId_idx" ON "Test"("vendorId");
ALTER TABLE "Test" ADD CONSTRAINT "Test_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable Panel
ALTER TABLE "Panel" ADD COLUMN "vendorId" TEXT;
ALTER TABLE "Panel" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Panel" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "Panel" SET "vendorId" = 'clvendor_aliquot_default' WHERE "vendorId" IS NULL;
ALTER TABLE "Panel" ALTER COLUMN "vendorId" SET NOT NULL;
DROP INDEX IF EXISTS "Panel_code_key";
CREATE UNIQUE INDEX "Panel_vendorId_code_key" ON "Panel"("vendorId", "code");
CREATE INDEX "Panel_vendorId_idx" ON "Panel"("vendorId");
ALTER TABLE "Panel" ADD CONSTRAINT "Panel_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable Order
ALTER TABLE "Order" ADD COLUMN "vendorId" TEXT;
UPDATE "Order" SET "vendorId" = 'clvendor_aliquot_default' WHERE "vendorId" IS NULL;
ALTER TABLE "Order" ALTER COLUMN "vendorId" SET NOT NULL;
DROP INDEX IF EXISTS "Order_accessionNo_key";
CREATE UNIQUE INDEX "Order_vendorId_accessionNo_key" ON "Order"("vendorId", "accessionNo");
CREATE INDEX "Order_vendorId_status_idx" ON "Order"("vendorId", "status");
ALTER TABLE "Order" ADD CONSTRAINT "Order_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable ReportTemplate
ALTER TABLE "ReportTemplate" ADD COLUMN "vendorId" TEXT;
ALTER TABLE "ReportTemplate" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "ReportTemplate" SET "vendorId" = 'clvendor_aliquot_default' WHERE "vendorId" IS NULL;
ALTER TABLE "ReportTemplate" ALTER COLUMN "vendorId" SET NOT NULL;
CREATE INDEX "ReportTemplate_vendorId_idx" ON "ReportTemplate"("vendorId");
ALTER TABLE "ReportTemplate" ADD CONSTRAINT "ReportTemplate_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable AuditLog
ALTER TABLE "AuditLog" ADD COLUMN "vendorId" TEXT;
UPDATE "AuditLog" SET "vendorId" = 'clvendor_aliquot_default';
CREATE INDEX "AuditLog_vendorId_idx" ON "AuditLog"("vendorId");
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable SyncState
CREATE TABLE "SyncState" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "lastPushedAt" TIMESTAMP(3),
    "lastPulledAt" TIMESTAMP(3),
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SyncState_vendorId_key" ON "SyncState"("vendorId");
ALTER TABLE "SyncState" ADD CONSTRAINT "SyncState_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable Tombstone
CREATE TABLE "Tombstone" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tombstone_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tombstone_vendorId_entityType_entityId_key" ON "Tombstone"("vendorId", "entityType", "entityId");
CREATE INDEX "Tombstone_vendorId_deletedAt_idx" ON "Tombstone"("vendorId", "deletedAt");
ALTER TABLE "Tombstone" ADD CONSTRAINT "Tombstone_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
