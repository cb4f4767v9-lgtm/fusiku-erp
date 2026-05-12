/**
 * Daily reporting (e.g. WhatsApp digest) — generator contract for scheduled jobs.
 */
export interface DailyReportSnapshot {
  date: string;
  companyId: string;
  metrics: Record<string, number>;
}

export interface DailyReportGenerator {
  build(companyId: string, date: string): Promise<DailyReportSnapshot>;
}
