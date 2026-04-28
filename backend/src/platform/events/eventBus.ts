import { EventEmitter } from 'node:events';
import type { DomainEventListener } from './eventBus.types';
import type { DomainEventName, DomainEventPayload } from './domainEvents';

export type { DomainEventName, DomainEventPayload } from './domainEvents';

let singleton: DomainEventBus | null = null;

/**
 * In-process event bus. Replace implementation later with Redis/worker fan-out if needed.
 */
export interface DomainEventBus {
  emit<N extends DomainEventName>(name: N, payload: DomainEventPayload<N>): boolean;
  on<N extends DomainEventName>(name: N, listener: DomainEventListener<N>): void;
  off<N extends DomainEventName>(name: N, listener: DomainEventListener<N>): void;
}

class EmitterDomainEventBus implements DomainEventBus {
  private readonly emitter = new EventEmitter({ captureRejections: true });

  emit<N extends DomainEventName>(name: N, payload: DomainEventPayload<N>): boolean {
    return this.emitter.emit(name, payload);
  }

  on<N extends DomainEventName>(name: N, listener: DomainEventListener<N>): void {
    this.emitter.on(name, listener);
  }

  off<N extends DomainEventName>(name: N, listener: DomainEventListener<N>): void {
    this.emitter.off(name, listener);
  }
}

export function getDomainEventBus(): DomainEventBus {
  if (!singleton) singleton = new EmitterDomainEventBus();
  return singleton;
}
