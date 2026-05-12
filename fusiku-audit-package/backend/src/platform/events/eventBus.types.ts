import type { DomainEventName, DomainEventPayload } from './domainEvents';

export type DomainEventListener<N extends DomainEventName> = (
  payload: DomainEventPayload<N>
) => void | Promise<void>;
