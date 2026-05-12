/**
 * Platform expansion layer — mobile clients, storefront, SaaS billing, AI triggers,
 * notifications (WhatsApp), marketing analytics, finance & trading (types only).
 *
 * Rules:
 * - No Express routes registered from here yet (keeps API surface stable).
 * - No dependency on the React frontend; only HTTP/JSON contracts.
 * - Import from services/jobs when features are implemented.
 */

export * from './events/domainEvents';
export * from './events/eventBus';
export type { DomainEventListener } from './events/eventBus.types';
export * from './notifications/notificationHub';
export * from './saas/saas.types';
export * from './storefront/storefront.types';
export * from './marketing/marketing.types';
export * from './reporting/dailyReport.types';
export * from './finance';
