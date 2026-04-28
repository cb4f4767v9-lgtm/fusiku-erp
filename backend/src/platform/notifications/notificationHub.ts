/**
 * Abstraction for WhatsApp, email, push — implement adapters when channels go live.
 * Default hub is a no-op so the rest of the stack stays stable.
 */
export type NotificationChannel = 'whatsapp' | 'email' | 'push';

export interface NotificationMessage {
  channel: NotificationChannel;
  /** Plain text or channel-specific template id (future) */
  body: string;
  to?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationHub {
  send(message: NotificationMessage): Promise<void>;
}

export class NoopNotificationHub implements NotificationHub {
  async send(_message: NotificationMessage): Promise<void> {
    /* reserved for future logging/metrics */
  }
}

let hub: NotificationHub = new NoopNotificationHub();

export function getNotificationHub(): NotificationHub {
  return hub;
}

/** Call at startup when a real hub is registered (e.g. WhatsApp provider). */
export function setNotificationHub(next: NotificationHub): void {
  hub = next;
}
