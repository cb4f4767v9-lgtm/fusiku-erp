import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { logger } from '../utils/logger';

let started = false;

export async function startOtel(): Promise<void> {
  if (started) return;
  started = true;

  const enabled = String(process.env.OTEL_ENABLED || process.env.OTEL_TRACES_ENABLED || '0') === '1';
  if (!enabled) return;

  const serviceName = String(process.env.OTEL_SERVICE_NAME || 'fusiku-backend').trim() || 'fusiku-backend';
  const endpoint = String(process.env.OTEL_EXPORTER_OTLP_ENDPOINT || '').trim();

  const traceExporter = endpoint ? new OTLPTraceExporter({ url: endpoint }) : undefined;

  const sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
    }),
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        // keep noise down; enable http/express by default
      }),
    ],
  });

  try {
    await sdk.start();
    logger.info({ serviceName, endpoint: endpoint || null }, '[otel] tracing started');
  } catch (err) {
    logger.warn({ err }, '[otel] failed to start');
  }
}

