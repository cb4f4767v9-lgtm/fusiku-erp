-- Institute Exam + Result models

CREATE TABLE "InstituteExam" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "batchId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'quiz',
    "totalMarks" INTEGER NOT NULL,
    "passingMarks" INTEGER NOT NULL,
    "examDate" TIMESTAMP(3),
    "weightPercent" INTEGER,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstituteExam_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InstituteExamResult" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "obtainedMarks" INTEGER NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "grade" TEXT,
    "gpa" DECIMAL(3,2),
    "status" TEXT NOT NULL DEFAULT 'pass',
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstituteExamResult_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one result per student per exam
CREATE UNIQUE INDEX "InstituteExamResult_examId_enrollmentId_key"
  ON "InstituteExamResult"("examId", "enrollmentId");

-- InstituteExam indexes
CREATE INDEX "InstituteExam_companyId_idx" ON "InstituteExam"("companyId");
CREATE INDEX "InstituteExam_batchId_idx" ON "InstituteExam"("batchId");
CREATE INDEX "InstituteExam_companyId_batchId_idx" ON "InstituteExam"("companyId", "batchId");

-- InstituteExamResult indexes
CREATE INDEX "InstituteExamResult_companyId_idx" ON "InstituteExamResult"("companyId");
CREATE INDEX "InstituteExamResult_examId_idx" ON "InstituteExamResult"("examId");
CREATE INDEX "InstituteExamResult_enrollmentId_idx" ON "InstituteExamResult"("enrollmentId");
CREATE INDEX "InstituteExamResult_companyId_enrollmentId_idx" ON "InstituteExamResult"("companyId", "enrollmentId");

-- Foreign keys
ALTER TABLE "InstituteExam" ADD CONSTRAINT "InstituteExam_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "InstituteBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InstituteExam" ADD CONSTRAINT "InstituteExam_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InstituteExam" ADD CONSTRAINT "InstituteExam_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InstituteExamResult" ADD CONSTRAINT "InstituteExamResult_examId_fkey"
  FOREIGN KEY ("examId") REFERENCES "InstituteExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InstituteExamResult" ADD CONSTRAINT "InstituteExamResult_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "InstituteEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InstituteExamResult" ADD CONSTRAINT "InstituteExamResult_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
