import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { handleAssistantRequest } from '@/src/assistant/handler';
import { llmFromEnv } from '@/src/assistant/llm';
import { checkRateLimit } from '@/src/lib/security';
import { initialMenuItems, initialCategories } from '@/src/menu/data';
import { MenuFact } from '@/src/assistant/types';

export async function POST(req: NextRequest) {
  try {
    // 1. Check content length (Cap at 4096 bytes)
    const rawBody = await req.text();
    if (Buffer.byteLength(rawBody, 'utf8') > 4096) {
      return NextResponse.json(
        { error: 'Payload too large. Maximum message size is 4KB.' },
        { status: 413 }
      );
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: 'Malformed JSON payload.' },
        { status: 400 }
      );
    }

    // 2. Client IP Hash
    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';

    const salt = process.env.IP_HASH_SALT || 'rock-uc-foods-salt-2026';
    const ipHash =
      clientIp === 'unknown'
        ? 'unknown'
        : crypto.createHash('sha256').update(`${clientIp}:${salt}`).digest('hex').slice(0, 16);

    // 3. Delegate to assistant handler
    const result = await handleAssistantRequest(payload, ipHash, {
      llmClient: llmFromEnv(),
      loadMenu: async (): Promise<MenuFact[]> => {
        const catMap = new Map(initialCategories.map((c) => [c.id, c.name]));
        return initialMenuItems
          .filter((i) => i.status === 'published' && i.isAvailable)
          .map((i) => ({
            category: catMap.get(i.categoryId) || 'Dishes',
            name: i.name,
            portion: i.portionLabel || null,
            priceKobo: i.priceKobo,
          }));
      },
      checkRateLimit: async (key, limit, windowSeconds) => {
        const check = checkRateLimit(key, limit, windowSeconds * 1000);
        return {
          allowed: check.allowed,
          retryAfter: Math.ceil(check.resetInMs / 1000),
        };
      },
    });

    return NextResponse.json(result.body, {
      status: result.status,
      headers: result.headers,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Internal assistant error.' },
      { status: 500 }
    );
  }
}
