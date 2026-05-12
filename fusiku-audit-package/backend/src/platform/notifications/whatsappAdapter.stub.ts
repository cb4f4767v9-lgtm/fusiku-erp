import type { NotificationHub, NotificationMessage } from './notificationHub';

/**
 * Placeholder for a future WhatsApp Business / Cloud API adapter.
 * Do not wire until credentials and compliance are in place.
 */
export class WhatsAppNotificationAdapterStub implements NotificationHub {
  async send(_message: NotificationMessage): Promise<void> {
    /* intentionally empty */
  }
}
