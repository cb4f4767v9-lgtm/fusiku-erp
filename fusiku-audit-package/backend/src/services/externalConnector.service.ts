/**
 * External service connectors
 * Phase 10 - SMS, Email, Shipping carriers
 */
import { logger } from '../utils/logger';

export interface SmsConfig {
  provider: string;
  apiKey?: string;
  from?: string;
}

export interface EmailConfig {
  provider: string;
  apiKey?: string;
  from?: string;
}

export const externalConnectorService = {
  async sendSms(to: string, message: string, config?: SmsConfig): Promise<boolean> {
    logger.info({ to, provider: config?.provider }, 'SMS send (placeholder)');
    return true;
  },

  async sendEmail(to: string, subject: string, body: string, config?: EmailConfig): Promise<boolean> {
    logger.info({ to, subject, provider: config?.provider }, 'Email send (placeholder)');
    return true;
  },

  async getShippingRates(carrier: string, from: string, to: string, weight: number): Promise<Array<{ service: string; cost: number }>> {
    logger.info({ carrier, from, to }, 'Shipping rates (placeholder)');
    return [{ service: 'standard', cost: 0 }];
  }
};
