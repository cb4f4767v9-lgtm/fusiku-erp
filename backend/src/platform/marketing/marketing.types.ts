/**
 * AI marketing / analytics ingestion — shape for future event capture endpoints.
 * No persistence layer here yet.
 */
export interface MarketingAnalyticsEvent {
  event: string;
  occurredAt: string;
  companyId?: string;
  /** PII-safe properties only when implementing collection */
  properties?: Record<string, unknown>;
}
