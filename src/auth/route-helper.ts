/**
 * ROCK UC FOODS - Auth Route Guard Helper
 * Playbook v2 Section 28 (Phase 1E)
 * 
 * Rules:
 * - Accepts only same-site POSTs (missing or foreign Origin = 403 Forbidden).
 * - Max body size: 2048 bytes (413 Payload Too Large).
 * - Invalid JSON = 400 Bad Request.
 * - Responses carry Cache-Control: no-store.
 */

import { NextResponse } from 'next/server';
import { isSameOrigin } from '../lib/same-origin';
import { getClientIp, hashIp } from '../lib/client-ip';

export const MAX_AUTH_BODY_BYTES = 2048;

export interface AuthRouteContext {
  body: Record<string, unknown>;
  ipHash: string;
}

export async function validateAuthRouteRequest(
  request: Request
): Promise<AuthRouteContext | NextResponse> {
  // 1. Same-Site Origin Check
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: 'Cross-origin or missing origin requests are forbidden.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // 2. Body Size Check (Max 2048 bytes)
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_AUTH_BODY_BYTES) {
    return NextResponse.json(
      { error: 'Payload exceeds maximum allowed size of 2048 bytes.' },
      { status: 413, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  let rawBodyText: string;
  try {
    rawBodyText = await request.text();
  } catch {
    return NextResponse.json(
      { error: 'Failed to read request body.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  if (rawBodyText.length > MAX_AUTH_BODY_BYTES) {
    return NextResponse.json(
      { error: 'Payload exceeds maximum allowed size of 2048 bytes.' },
      { status: 413, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // 3. JSON Parsing Check
  let body: Record<string, unknown> = {};
  if (rawBodyText.trim().length > 0) {
    try {
      body = JSON.parse(rawBodyText);
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }
  }

  const clientIp = getClientIp(request);
  const ipHash = hashIp(clientIp);

  return {
    body,
    ipHash,
  };
}

export function authJson(data: unknown, status = 200, headers?: Record<string, string>): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...(headers || {}),
    },
  });
}
