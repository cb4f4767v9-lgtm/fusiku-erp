import { logger } from '../utils/logger';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type ChatArgs = {
  purpose: string;
  model: string;
  temperature?: number;
  responseFormatJson?: boolean;
  messages: ChatMessage[];
};

let openUntilMs = 0;
let consecutiveFailures = 0;

function now() {
  return Date.now();
}

function circuitOpen(): boolean {
  return now() < openUntilMs;
}

function tripCircuit(reason: string) {
  const baseMs = Math.max(5_000, Math.min(300_000, Number(process.env.OPENAI_CIRCUIT_OPEN_MS || 60_000)));
  openUntilMs = now() + baseMs;
  logger.warn({ baseMs, reason }, '[openai] circuit opened');
}

export async function openAiChatJsonWithCircuitBreaker(args: ChatArgs): Promise<any> {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  if (circuitOpen()) {
    throw new Error('OPENAI_CIRCUIT_OPEN');
  }

  const timeoutMs = Math.max(500, Math.min(60_000, Number(process.env.OPENAI_TIMEOUT_MS || 8_000)));
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: args.model,
        temperature: args.temperature ?? 0.2,
        ...(args.responseFormatJson ? { response_format: { type: 'json_object' } } : {}),
        messages: args.messages,
      }),
    });

    if (!res.ok) {
      consecutiveFailures += 1;
      logger.warn({ status: res.status, purpose: args.purpose }, '[openai] http error');
      // trip on repeated failures or rate-limit
      if (res.status === 429 || consecutiveFailures >= 3) {
        tripCircuit(`http_${res.status}`);
      }
      throw new Error(`OPENAI_HTTP_${res.status}`);
    }

    const data = await res.json();
    consecutiveFailures = 0;
    return data;
  } catch (err: any) {
    consecutiveFailures += 1;
    const msg = String(err?.message || '');
    if (msg.includes('aborted') || msg.includes('AbortError')) {
      if (consecutiveFailures >= 2) tripCircuit('timeout');
    }
    throw err;
  } finally {
    clearTimeout(to);
  }
}

