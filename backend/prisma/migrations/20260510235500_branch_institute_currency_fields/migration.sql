-- Optional institute ISO overrides per branch. Operating currency stays `Branch.currency`.
ALTER TABLE "Branch" ADD COLUMN "instituteFeeCurrency" TEXT;
ALTER TABLE "Branch" ADD COLUMN "instituteReceiptCurrency" TEXT;
ALTER TABLE "Branch" ADD COLUMN "instituteReportingCurrency" TEXT;
