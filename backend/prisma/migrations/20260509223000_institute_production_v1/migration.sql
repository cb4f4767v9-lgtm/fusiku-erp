-- ============================================================================
-- Institute module — production-grade upgrade (v1)
--
-- Adds:
--   * Tenant scope on InstituteEnrollment (companyId + composite unique).
--   * Decimal money on InstituteFeeCharge (amount/paidAmount/balance) plus an
--     optional enrollmentId link so charges trace back to a specific batch.
--   * Payment.instituteFeeChargeId so a Payment row can be allocated against
--     a specific fee charge (institute payment service updates paidAmount,
--     balance, and status atomically).
--   * Course.defaultFee and Batch.feeOverride for auto fee generation.
--
-- Idempotent-ish: uses IF NOT EXISTS / IF EXISTS for indexes and constraints
-- where Postgres allows it, so the migration is safe to re-run on a partially
-- migrated database (e.g. one that was previously updated via `prisma db push`).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. InstituteCourse.defaultFee
-- ---------------------------------------------------------------------------
ALTER TABLE "InstituteCourse"
  ADD COLUMN IF NOT EXISTS "defaultFee" DECIMAL(18,4);

-- ---------------------------------------------------------------------------
-- 2. InstituteBatch.feeOverride
-- ---------------------------------------------------------------------------
ALTER TABLE "InstituteBatch"
  ADD COLUMN IF NOT EXISTS "feeOverride" DECIMAL(18,4);

-- ---------------------------------------------------------------------------
-- 3. InstituteEnrollment.companyId
--    Add nullable, backfill from the joined student, then enforce NOT NULL.
-- ---------------------------------------------------------------------------
ALTER TABLE "InstituteEnrollment"
  ADD COLUMN IF NOT EXISTS "companyId" TEXT;

UPDATE "InstituteEnrollment" e
SET    "companyId" = s."companyId"
FROM   "InstituteStudent" s
WHERE  s."id" = e."studentId"
  AND  e."companyId" IS NULL;

ALTER TABLE "InstituteEnrollment"
  ALTER COLUMN "companyId" SET NOT NULL;

-- Drop the old per-(studentId, batchId) unique; replaced by tenant-scoped one.
ALTER TABLE "InstituteEnrollment"
  DROP CONSTRAINT IF EXISTS "InstituteEnrollment_studentId_batchId_key";
DROP INDEX IF EXISTS "InstituteEnrollment_studentId_batchId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "InstituteEnrollment_companyId_studentId_batchId_key"
  ON "InstituteEnrollment"("companyId", "studentId", "batchId");

CREATE INDEX IF NOT EXISTS "InstituteEnrollment_companyId_batchId_idx"
  ON "InstituteEnrollment"("companyId", "batchId");

ALTER TABLE "InstituteEnrollment"
  DROP CONSTRAINT IF EXISTS "InstituteEnrollment_companyId_fkey";
ALTER TABLE "InstituteEnrollment"
  ADD CONSTRAINT "InstituteEnrollment_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 4. InstituteFeeCharge: enrollmentId, Decimal money, paidAmount, balance
-- ---------------------------------------------------------------------------
ALTER TABLE "InstituteFeeCharge"
  ADD COLUMN IF NOT EXISTS "enrollmentId" TEXT;

ALTER TABLE "InstituteFeeCharge"
  ADD COLUMN IF NOT EXISTS "paidAmount" DECIMAL(18,4) NOT NULL DEFAULT 0;

ALTER TABLE "InstituteFeeCharge"
  ADD COLUMN IF NOT EXISTS "balance" DECIMAL(18,4);

-- Convert legacy double precision -> DECIMAL(18,4). Round to 4 dp on the way in.
ALTER TABLE "InstituteFeeCharge"
  ALTER COLUMN "amount" TYPE DECIMAL(18,4) USING ROUND(("amount")::numeric, 4);

-- Backfill balance for any rows that already exist.
UPDATE "InstituteFeeCharge"
SET    "balance" = "amount" - "paidAmount"
WHERE  "balance" IS NULL;

ALTER TABLE "InstituteFeeCharge"
  ALTER COLUMN "balance" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "InstituteFeeCharge_enrollmentId_idx"
  ON "InstituteFeeCharge"("enrollmentId");

CREATE INDEX IF NOT EXISTS "InstituteFeeCharge_companyId_status_idx"
  ON "InstituteFeeCharge"("companyId", "status");

CREATE INDEX IF NOT EXISTS "InstituteFeeCharge_companyId_dueDate_idx"
  ON "InstituteFeeCharge"("companyId", "dueDate");

ALTER TABLE "InstituteFeeCharge"
  DROP CONSTRAINT IF EXISTS "InstituteFeeCharge_enrollmentId_fkey";
ALTER TABLE "InstituteFeeCharge"
  ADD CONSTRAINT "InstituteFeeCharge_enrollmentId_fkey"
    FOREIGN KEY ("enrollmentId") REFERENCES "InstituteEnrollment"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 5. Payment.instituteFeeChargeId — FK to fee charge, nullable
-- ---------------------------------------------------------------------------
ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "instituteFeeChargeId" TEXT;

CREATE INDEX IF NOT EXISTS "Payment_instituteFeeChargeId_idx"
  ON "Payment"("instituteFeeChargeId");

ALTER TABLE "Payment"
  DROP CONSTRAINT IF EXISTS "Payment_instituteFeeChargeId_fkey";
ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_instituteFeeChargeId_fkey"
    FOREIGN KEY ("instituteFeeChargeId") REFERENCES "InstituteFeeCharge"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
