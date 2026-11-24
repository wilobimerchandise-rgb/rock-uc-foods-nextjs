/**
 * ROCK UC FOODS - Owner Operational Kill Switches, Stale Draft Alerts & Drills API
 * Playbook v2 Section 31.6
 */

import { NextRequest, NextResponse } from 'next/server';
import { isSameOrigin } from '../../../../src/lib/same-origin';
import {
  getProfileFromService,
  resolveSessionFromRequest,
  hasSessionVerifiedMfa,
} from '../../../../src/auth/wiring';
import { requireRole, AuthorizationError, UserProfile } from '../../../../src/lib/auth/access';
import {
  getKillSwitchStatus,
  setKillSwitchState,
  checkStaleDraftInvoices,
  getOperationalAlerts,
} from '../../../../src/lib/operations';
import { getAuditFailureCount } from '../../../../src/lib/audit';
import { runOperationalDrills } from '../../../../src/lib/drills';
import { runNightlyInvoiceSelfCheck } from '../../../../src/invoices/selfCheck';
import { pruneExpiredCustomerPhones } from '../../../../src/lib/ndpaRetention';
import { getBusinessBankSettings, setBusinessBankSettings } from '../../../../src/lib/businessSettings';

export const dynamic = 'force-dynamic';

async function resolveAuthenticatedProfile(request?: NextRequest): Promise<
  | { userProfile: UserProfile }
  | { errorResponse: NextResponse }
> {
  const sessionRes = await resolveSessionFromRequest(request);
  const user = sessionRes.session?.user;
  if (!user) {
    return {
      errorResponse: NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      ),
    };
  }

  const profile = await getProfileFromService(user.id);
  if (!profile || !profile.isActive) {
    return {
      errorResponse: NextResponse.json(
        { error: 'Forbidden: Account inactive or profile missing.' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } }
      ),
    };
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

export async function GET(request: NextRequest) {
  const resolved = await resolveAuthenticatedProfile(request);
  if ('errorResponse' in resolved) return resolved.errorResponse;

  try {
    requireRole(['owner', 'developer'], resolved.userProfile, 'read operational status');

    const staleCheck = await checkStaleDraftInvoices();
    return NextResponse.json(
      {
        killSwitches: getKillSwitchStatus(),
        bankSettings: getBusinessBankSettings(),
        staleDrafts: staleCheck.staleDrafts,
        auditFailureCount: getAuditFailureCount(),
        recentAlerts: getOperationalAlerts().slice(-20),
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
          'X-Robots-Tag': 'noindex',
        },
      }
    );
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json(
        { error: err.message },
        { status: 403, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    return NextResponse.json(
      { error: err.message || 'Failed to read operational status.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: 'Cross-origin or missing origin requests are forbidden.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const resolved = await resolveAuthenticatedProfile(request);
  if ('errorResponse' in resolved) return resolved.errorResponse;

  try {
    requireRole(['owner'], resolved.userProfile, 'execute operational control', 'ops', {
      requireSecondFactor: true,
    });

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || '');

    if (action === 'toggle_switches') {
      const updated = setKillSwitchState(
        {
          invoiceRequestsPaused:
            typeof body.invoiceRequestsPaused === 'boolean'
              ? body.invoiceRequestsPaused
              : undefined,
          whatsappSendPaused:
            typeof body.whatsappSendPaused === 'boolean' ? body.whatsappSendPaused : undefined,
        },
        resolved.userProfile,
        typeof body.reason === 'string' ? body.reason : 'Owner dashboard toggle'
      );
      return NextResponse.json(
        { success: true, killSwitches: updated },
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (action === 'check_stale_drafts') {
      const result = await checkStaleDraftInvoices({ forceResend: Boolean(body.forceResend) });
      return NextResponse.json(
        { success: true, ...result },
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (action === 'run_drills') {
      const drillResult = await runOperationalDrills(resolved.userProfile);
      return NextResponse.json(
        { success: drillResult.allPassed, drillResult },
        { status: drillResult.allPassed ? 200 : 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (action === 'nightly_self_check') {
      const report = runNightlyInvoiceSelfCheck();
      return NextResponse.json(
        { success: report.passed, report },
        { status: report.passed ? 200 : 409, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (action === 'ndpa_prune') {
      const retentionDays =
        typeof body.retentionDays === 'number' && Number.isFinite(body.retentionDays)
          ? body.retentionDays
          : undefined;
      const result = pruneExpiredCustomerPhones({ retentionDays });
      return NextResponse.json(
        { success: true, result },
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (action === 'update_bank_details') {
      if (body.clear === true) {
        setBusinessBankSettings(null, resolved.userProfile);
        return NextResponse.json(
          { success: true, bankSettings: null },
          { status: 200, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      const updated = setBusinessBankSettings(
        {
          bankName: String(body.bankName || ''),
          accountNumber: String(body.accountNumber || ''),
          accountName: String(body.accountName || ''),
          verifiedByOwner: Boolean(body.verifiedByOwner),
        },
        resolved.userProfile
      );
      return NextResponse.json(
        { success: true, bankSettings: updated },
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return NextResponse.json(
      {
        error:
          'Unsupported operational action. Expected toggle_switches, check_stale_drafts, run_drills, nightly_self_check, ndpa_prune, or update_bank_details.',
      },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json(
        { error: err.message },
        { status: 403, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    return NextResponse.json(
      { error: err.message || 'Operational action failed.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
