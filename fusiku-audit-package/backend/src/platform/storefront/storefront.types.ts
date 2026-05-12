/**
 * Reserved types for a public storefront and website integration (inventory sync, orders).
 * REST surface will live under `/api/public/v1/...` alongside existing public API routes.
 */
export interface StorefrontLineItem {
  sku: string;
  quantity: number;
}

export interface StorefrontOrderDraft {
  externalId?: string;
  lineItems: StorefrontLineItem[];
}

export interface InventorySyncCursor {
  companyId: string;
  /** Opaque token for incremental sync — define when implementing */
  cursor?: string;
  updatedAfter?: string;
}
