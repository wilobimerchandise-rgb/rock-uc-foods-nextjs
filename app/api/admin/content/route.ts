import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { isSameOrigin } from '../../../../src/lib/same-origin';
import { getClientIp } from '../../../../src/lib/client-ip';
import { globalAuthService, getProfileFromService } from '../../../../src/auth/wiring';
import {
  getLatestSiteContentVersion,
  saveSiteContent,
} from '../../../../src/content/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const versionRecord = getLatestSiteContentVersion();
  return NextResponse.json(versionRecord, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: NextRequest) {
  // 1. Same-Site Origin Check
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: 'Cross-origin or missing origin requests are forbidden.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // 2. Authentication & Second-Factor Check
  const sessionRes = await globalAuthService.getSession();
  const user = sessionRes.session?.user;
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const profile = await getProfileFromService(user.id);
  if (!profile || !profile.isActive) {
    return NextResponse.json(
      { error: 'Forbidden: Account inactive or profile missing.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const hasVerifiedTotp =
    (user.factors?.some((f) => f.factor_type === 'totp' && f.status === 'verified') ?? false) ||
    sessionRes.session?.aal === 'aal2';

  // 3. Body validation
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON payload.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const { content, expectedVersion, note } = body;
  if (typeof expectedVersion !== 'number') {
    return NextResponse.json(
      { error: 'expectedVersion number is required for optimistic concurrency.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const clientIp = getClientIp(request);

  // 4. Execute mutation via Content Service
  const result = await saveSiteContent({
    content,
    note: typeof note === 'string' ? note : undefined,
    expectedVersion,
    actorRole: profile.role,
    actorHasMfa: hasVerifiedTotp,
    actorId: user.id,
    actorIp: clientIp,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: result.error, errors: result.errors },
      { status: result.statusCode, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // 5. Revalidate public pages
  try {
    revalidatePath('/');
    revalidatePath('/menu');
    revalidatePath('/catering');
    revalidatePath('/estimate');
  } catch {
    // Non-fatal in testing environments
  }

  return NextResponse.json(result.version, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}
