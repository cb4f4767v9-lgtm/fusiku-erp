-- Identity document type + number; batch timetable fields; enrollment admission dates.

ALTER TABLE "InstituteStudent" ADD COLUMN IF NOT EXISTS "identityDocumentType" TEXT;
ALTER TABLE "InstituteStudent" ADD COLUMN IF NOT EXISTS "identityDocumentNumber" TEXT;

ALTER TABLE "InstituteBatch" ADD COLUMN IF NOT EXISTS "timingSlot" TEXT;
ALTER TABLE "InstituteBatch" ADD COLUMN IF NOT EXISTS "timingLabel" TEXT;
ALTER TABLE "InstituteBatch" ADD COLUMN IF NOT EXISTS "teacherName" TEXT;
ALTER TABLE "InstituteBatch" ADD COLUMN IF NOT EXISTS "capacity" INTEGER;

ALTER TABLE "InstituteEnrollment" ADD COLUMN IF NOT EXISTS "admissionDate" TIMESTAMP(3);
ALTER TABLE "InstituteEnrollment" ADD COLUMN IF NOT EXISTS "expectedCompletionDate" TIMESTAMP(3);
