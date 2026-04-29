/** Desktop SQLite outbox kinds → replayed against the same REST API as the web app. */
export const OUTBOX_KIND = {
  POS_SALE: 'pos_sale',
  PURCHASE_CREATE: 'purchase_create',
  INVENTORY_CREATE: 'inventory_create',
  EXPENSE_CREATE: 'expense_create',
} as const;

export type OutboxKind = (typeof OUTBOX_KIND)[keyof typeof OUTBOX_KIND];
