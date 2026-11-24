/**
 * ROCK UC FOODS - Order Access & Ownership Authorization Helper
 * Prevents IDOR on customer orders by requiring either an active admin session
 * or the matching 128-bit trackingToken (via ?token=, x-order-token, or HttpOnly cookie).
 */

import crypto from 'crypto';
import {
  getProfileFromService,
  resolveSessionFromRequest,
  hasSessionVerifiedMfa,
} from '../auth/wiring';
import { orderRepository } from './orderRepository';
import { Order } from '../types/order';
import { UserProfile } from '../lib/auth/access';
import { maskCustomerPhone } from '../lib/security';

export const ORDER_TOKEN_COOKIE_NAME = 'ruc_order_tokens';

export async function resolveActiveAdminProfile(request?: Request): Promise<
  | { userProfile: UserProfile }
  | { status: 401 | 403; error: string }
> {
  const sessionRes = await resolveSessionFromRequest(request);
  const user = sessionRes.session?.user;
  if (!user) {
    return { status: 401, error: 'Authentication required.' };
  }

  const profile = await getProfileFromService(user.id);
  if (!profile || !profile.isActive) {
    return { status: 403, error: 'Forbidden: Account inactive or profile missing.' };
  }

  if (!['owner', 'staff', 'developer'].includes(profile.role)) {
    return { status: 403, error: 'Forbidden: Admin access required.' };
  }

  const hasVerifiedTotp = hasSessionVerifiedMfa(sessionRes.session);

  return {
    userProfile: {
      id: profile.id,
      role: profile.role,
      isActive: profile.isActive,
      fullName: profile.fullName,
      email: profile.email,
      hasMfaVerified: hasVerifiedTotp,
    },
  };
}

function parseCookieHeader(cookieHeader: string | null): Record<string, string> {
  const map: Record<string, string> = {};
  if (!cookieHeader) return map;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim();
    if (key) map[key] = decodeURIComponent(val);
  }
  return map;
}

export function extractOrderTokensFromRequest(
  req: Request,
  orderCode: string
): { cookieMap: Record<string, string>; suppliedToken: string | null } {
  const cookies = parseCookieHeader(req.headers.get('cookie'));
  let cookieMap: Record<string, string> = {};
  const rawTokenMap = cookies[ORDER_TOKEN_COOKIE_NAME];
  if (rawTokenMap) {
    try {
      const parsed = JSON.parse(rawTokenMap);
      if (parsed && typeof parsed === 'object') {
        cookieMap = parsed as Record<string, string>;
      }
    } catch {
      cookieMap = {};
    }
  }

  const url = new URL(req.url);
  const queryToken = url.searchParams.get('token')?.trim();
  const headerToken = req.headers.get('x-order-token')?.trim();
  const cleanCode = orderCode.trim().toUpperCase();
  const cookieToken = (cookieMap[cleanCode] || cookieMap[orderCode.trim()] || '').trim();

  const suppliedToken = headerToken || queryToken || cookieToken || null;
  return { cookieMap, suppliedToken };
}

export function buildUpdatedOrderTokenCookieValue(
  req: Request,
  orderCode: string,
  trackingToken: string
): string {
  const { cookieMap } = extractOrderTokensFromRequest(req, orderCode);
  const entries = Object.entries(cookieMap).slice(-19);
  const nextMap: Record<string, string> = Object.fromEntries(entries);
  nextMap[orderCode.trim().toUpperCase()] = trackingToken;
  return encodeURIComponent(JSON.stringify(nextMap));
}

function constantTimeTokenEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function authorizeOrderAccess(
  req: Request,
  orderCode: string
): Promise<
  | { authorized: true; order: Order; isAdmin: boolean; adminProfile?: UserProfile }
  | { authorized: false; status: 401 | 403 | 404; error: string }
> {
  const cleanCode = orderCode.trim();
  if (!cleanCode) {
    return { authorized: false, status: 400 as any, error: 'Order code is required.' };
  }

  // 1. Check active admin session first
  const adminCheck = await resolveActiveAdminProfile(req);
  const rawOrder = orderRepository.getByCode(cleanCode);
  const order = rawOrder ? orderRepository.syncExpiry(rawOrder.id) || rawOrder : undefined;

  if ('userProfile' in adminCheck) {
    if (!order) {
      return { authorized: false, status: 404, error: `Order '${cleanCode}' not found.` };
    }
    return {
      authorized: true,
      order,
      isAdmin: true,
      adminProfile: adminCheck.userProfile,
    };
  }

  // 2. Customer ownership check via CSPRNG 128-bit trackingToken
  const { suppliedToken } = extractOrderTokensFromRequest(req, cleanCode);
  if (!suppliedToken) {
    return {
      authorized: false,
      status: 401,
      error: 'Order verification token or admin sign-in is required to view this order.',
    };
  }

  if (!order || !order.trackingToken || !constantTimeTokenEquals(suppliedToken, order.trackingToken)) {
    return {
      authorized: false,
      status: 403,
      error: 'Forbidden: You do not have permission to access this order.',
    };
  }

  return {
    authorized: true,
    order,
    isAdmin: false,
  };
}

export function serializeOrderForApi(
  order: Order,
  options?: { isAdmin?: boolean; role?: string; hasMfaVerified?: boolean }
) {
  const customerPhone =
    options?.isAdmin
      ? maskCustomerPhone(order.customerPhone, options.role, options.hasMfaVerified)
      : order.customerPhone;

  // Strip trackingToken from serialized read payloads
  const { trackingToken: _hiddenToken, ...safeOrder } = order;

  return {
    ...safeOrder,
    customerPhone,
    deliveryFeeKobo: order.deliveryFeeKobo.toString(),
    subtotalKobo: order.subtotalKobo.toString(),
    totalKobo: order.totalKobo.toString(),
    paidAmountKobo: (order.paidAmountKobo ?? 0n).toString(),
    discountKobo: order.discountKobo ? order.discountKobo.toString() : undefined,
    items: order.items.map((i) => ({
      ...i,
      unitPriceKoboSnapshot: i.unitPriceKoboSnapshot.toString(),
      totalKoboSnapshot: i.totalKoboSnapshot.toString(),
      selectedOptionsSnapshot: (i.selectedOptionsSnapshot || []).map((o) => ({
        ...o,
        priceDeltaKobo: o.priceDeltaKobo ? o.priceDeltaKobo.toString() : '0',
      })),
    })),
  };
}
