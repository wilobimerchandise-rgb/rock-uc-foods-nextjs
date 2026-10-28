/**
 * ROCK UC FOODS - Assistant Request Handler
 * Playbook v4 Section 19.2
 * 
 * Flow:
 * 1. Validate payload structure.
 * 2. Per-IP Rate limit: 20 per 600s with key `assistant:ip:<hash or 'unknown'>`.
 * 3. Deterministic guard check (runs BEFORE any LLM call).
 * 4. Daily cap on MODEL calls only (default 500, key `assistant:day:<YYYY-MM-DD Lagos>`).
 * 5. Generates grounded answer + verification.
 * 6. Append-only audit record (stores only { kind, reason, ipHash }, NEVER customer text).
 */

import { AssistantDeps, AssistantReply } from './types';
import { guardMessage } from './guard';
import { buildFacts } from './facts';
import { generateAssistantAnswer } from './answer';

export interface HandlerResult {
  status: number;
  body: AssistantReply;
  headers?: Record<string, string>;
}

export function getLagosDayString(date: Date = new Date()): string {
  // Format Africa/Lagos (UTC+1) date: YYYY-MM-DD
  const lagosOffsetMs = 60 * 60 * 1000;
  const lagosDate = new Date(date.getTime() + lagosOffsetMs);
  return lagosDate.toISOString().slice(0, 10);
}

export async function handleAssistantRequest(
  payload: any,
  ipHash: string = 'unknown',
  deps: AssistantDeps
): Promise<HandlerResult> {
  // 1. Validate payload
  if (!payload || typeof payload !== 'object' || typeof payload.message !== 'string') {
    return {
      status: 400,
      body: {
        kind: 'invalid',
        text: 'Request body must contain a "message" string property.',
        reason: 'malformed_payload',
      },
    };
  }

  const rawMessage = payload.message;

  // 2. Per-IP Rate Limit: 20 requests per 600 seconds
  const ipKey = `assistant:ip:${ipHash || 'unknown'}`;
  const ipLimitResult = await deps.checkRateLimit(ipKey, 20, 600);
  if (!ipLimitResult.allowed) {
    const retryAfter = ipLimitResult.retryAfter ?? 600;
    return {
      status: 429,
      body: {
        kind: 'unavailable',
        text: 'You have sent too many messages in a short window. Please wait a few minutes before trying again or message us on WhatsApp.',
        reason: 'rate_limited',
      },
      headers: {
        'Retry-After': String(retryAfter),
      },
    };
  }

  // 3. Deterministic Guard Filter (Pre-LLM)
  const guardedReply = guardMessage(rawMessage);
  if (guardedReply) {
    // Record audit asynchronously without blocking
    if (deps.recordAudit) {
      deps.recordAudit({
        action: 'assistant.chat',
        kind: guardedReply.kind,
        reason: guardedReply.reason,
        ipHash,
      }).catch(() => {});
    }

    const statusCode = guardedReply.kind === 'invalid' ? 400 : 200;
    return {
      status: statusCode,
      body: guardedReply,
    };
  }

  // 4. Daily Cap on Model Calls (default 500)
  const now = deps.now ? deps.now() : new Date();
  const dayStr = getLagosDayString(now);
  const dailyCap = parseInt(process.env.ASSISTANT_DAILY_CAP || '500', 10);
  const dailyKey = `assistant:day:${dayStr}`;
  const dailyLimitResult = await deps.checkRateLimit(dailyKey, dailyCap, 86400);

  if (!dailyLimitResult.allowed) {
    return {
      status: 429,
      body: {
        kind: 'unavailable',
        text: 'Our AI assistant has reached its daily query limit. Please message Chef Esther directly on WhatsApp for prompt assistance.',
        reason: 'daily_cap_exceeded',
      },
    };
  }

  // 5. Load menu & build grounded facts
  let menu;
  try {
    menu = await deps.loadMenu();
  } catch (err: any) {
    return {
      status: 200,
      body: {
        kind: 'handoff',
        text: 'Our live menu is currently updating. Please chat with us directly on WhatsApp for available dishes and prices.',
        reason: 'menu_load_failed',
      },
    };
  }

  const facts = buildFacts(menu);

  // 6. Generate answer
  const answerReply = await generateAssistantAnswer(rawMessage, facts, deps.llmClient);

  // Audit logging: records only metadata, never the customer's text
  if (deps.recordAudit) {
    deps.recordAudit({
      action: 'assistant.chat',
      kind: answerReply.kind,
      reason: answerReply.reason,
      ipHash,
    }).catch(() => {});
  }

  return {
    status: 200,
    body: answerReply,
  };
}
