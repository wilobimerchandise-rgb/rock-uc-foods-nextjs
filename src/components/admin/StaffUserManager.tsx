'use client';

/**
 * ROCK UC FOODS - Staff User Management Screen (Phase 1E)
 * Playbook v2 Section 6 (Phase 1), Section 9 (Phase 4), Section 28.4 (Phase 1E), Section 35
 */

import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  UserX,
  KeyRound,
  RotateCcw,
  Search,
  Filter,
  AlertCircle,
  CheckCircle,
  X,
  Lock,
  Mail,
  User,
  Info,
} from 'lucide-react';
import { PublicStaffUser } from '../../auth/staff-service';

interface StaffUserManagerProps {
  currentUserRole?: string;
  currentUserId?: string;
}

export function StaffUserManager({
  currentUserId = '',
}: StaffUserManagerProps) {
  const [users, setUsers] = useState<PublicStaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'owner' | 'staff' | 'developer'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'deactivated'>('all');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addRole, setAddRole] = useState<'owner' | 'staff' | 'developer'>('staff');
  const [addPassword, setAddPassword] = useState('StaffPass2026!');
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // Reset Password Modal
  const [passwordTargetUser, setPasswordTargetUser] = useState<PublicStaffUser | null>(null);
  const [newPassword, setNewPassword] = useState('NewSecret2026!');
  const [submittingPassword, setSubmittingPassword] = useState(false);

  // Confirmation modal state (replaces window.confirm for iframe & Section 35 safety)
  const [pendingConfirmAction, setPendingConfirmAction] = useState<{
    type: 'toggle_active' | 'reset_mfa';
    user: PublicStaffUser;
    nextState?: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    isDanger: boolean;
  } | null>(null);

  // Action Loading states per user ID
  const [actionInProgress, setActionInProgress] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await fetch('/api/admin/users');
        const data = await res.json();
        if (!ignore) {
          if (!res.ok) {
            setErrorMsg(data.error || 'Failed to fetch team members.');
          } else {
            setUsers(data.users || []);
          }
        }
      } catch (err: any) {
        if (!ignore) {
          setErrorMsg(err.message || 'Error connecting to staff management API.');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, []);

  function handleToggleActive(user: PublicStaffUser) {
    if (user.id === currentUserId) {
      setErrorMsg('You cannot deactivate your own owner account.');
      return;
    }

    const nextState = !user.isActive;
    setPendingConfirmAction({
      type: 'toggle_active',
      user,
      nextState,
      title: nextState ? 'Reactivate Team Member' : 'Deactivate Team Member',
      message: nextState
        ? `Reactivate account for ${user.fullName}? They will regain access immediately.`
        : `Deactivate ${user.fullName}? They will be immediately signed out and lose access.`,
      confirmLabel: nextState ? 'Reactivate Account' : 'Deactivate Account',
      isDanger: !nextState,
    });
  }

  function handleResetMfa(user: PublicStaffUser) {
    setPendingConfirmAction({
      type: 'reset_mfa',
      user,
      title: 'Reset Authenticator (MFA)',
      message: `Reset MFA for ${user.fullName}? This removes their registered authenticator app and requires re-enrollment on their next sign-in (use this for lost phones).`,
      confirmLabel: 'Clear MFA Factors',
      isDanger: true,
    });
  }

  async function executeConfirmedAction() {
    if (!pendingConfirmAction) return;
    const { type, user, nextState } = pendingConfirmAction;
    setPendingConfirmAction(null);
    setActionInProgress((prev) => ({ ...prev, [user.id]: true }));
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload =
        type === 'toggle_active'
          ? { action: 'toggle_active', isActive: nextState }
          : { action: 'reset_mfa' };

      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error ||
            (type === 'toggle_active'
              ? 'Failed to update account status.'
              : 'Failed to reset MFA.')
        );
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? data.user : u))
      );

      if (type === 'toggle_active') {
        setSuccessMsg(
          nextState
            ? `Account for ${user.fullName} successfully reactivated.`
            : `Account for ${user.fullName} deactivated. Access revoked immediately.`
        );
      } else {
        setSuccessMsg(`MFA factors for ${user.fullName} have been cleared.`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Operation failed.');
    } finally {
      setActionInProgress((prev) => ({ ...prev, [user.id]: false }));
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingAdd(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: addName,
          email: addEmail,
          role: addRole,
          password: addPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create team member.');
      }

      setUsers((prev) => [data.user, ...prev]);
      setShowAddModal(false);
      setAddName('');
      setAddEmail('');
      setAddPassword('StaffPass2026!');
      setSuccessMsg(`Team member ${data.user.fullName} (${data.user.role}) created successfully.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create team member.');
    } finally {
      setSubmittingAdd(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordTargetUser) return;

    setSubmittingPassword(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/admin/users/${passwordTargetUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset_password',
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset password.');
      }

      setPasswordTargetUser(null);
      setSuccessMsg(`Password for ${passwordTargetUser.fullName} successfully updated.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Password reset failed.');
    } finally {
      setSubmittingPassword(false);
    }
  }

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && u.isActive) ||
      (statusFilter === 'deactivated' && !u.isActive);

    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-full min-w-0 text-[var(--text-primary)]">
      {/* Header Banner */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-[#6B1230] border border-[#D4AF37]/50 flex items-center justify-center text-[#D4AF37] shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                  Staff &amp; User Management
                </h1>
                <span className="text-sm font-bold px-2.5 py-0.5 rounded-md bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/40 uppercase tracking-wider">
                  Phase 1E
                </span>
              </div>
              <p className="text-sm text-[var(--text-body-muted)] mt-1">
                Owner-only directory for team accounts, role-based access, and lost-phone authenticator recovery.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            data-testid="add-staff-button"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#6B1230] hover:bg-[#80183b] text-[#F7EFD9] border border-[#D4AF37]/60 font-semibold text-sm tracking-wide shadow-lg transition-all min-h-[44px] shrink-0"
          >
            <UserPlus className="w-4 h-4 text-[#D4AF37]" />
            <span>Add Team Member</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] text-[var(--status-danger-text)] text-sm flex items-center justify-between gap-3 shadow-lg"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setErrorMsg(null)}
            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg hover:bg-black/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div
          role="status"
          className="p-4 rounded-xl bg-[var(--status-success-bg)] border border-[var(--status-success-border)] text-[var(--status-success-text)] text-sm flex items-center justify-between gap-3 shadow-lg"
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            aria-label="Dismiss status message"
            onClick={() => setSuccessMsg(null)}
            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg hover:bg-black/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-subtle-card)] rounded-xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-body-muted)] pointer-events-none" />
          <input
            type="text"
            aria-label="Search team members"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full min-h-[44px] pl-10 pr-4 py-2 bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--border-gold)]"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-[var(--bg-primary)] px-3 rounded-lg border border-[var(--border-card)] min-h-[44px]">
            <Filter className="w-4 h-4 text-[var(--text-accent)] shrink-0" />
            <select
              aria-label="Filter by role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="min-h-[44px] bg-transparent text-sm text-[var(--text-primary)] focus:outline-none cursor-pointer"
            >
              <option value="all">All Roles</option>
              <option value="owner">Owner</option>
              <option value="staff">Staff</option>
              <option value="developer">Developer</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-[var(--bg-primary)] px-3 rounded-lg border border-[var(--border-card)] min-h-[44px]">
            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="min-h-[44px] bg-transparent text-sm text-[var(--text-primary)] focus:outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="deactivated">Deactivated</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users List */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-subtle-card)] rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-[var(--text-body-muted)] text-sm">
            Loading team directory...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Users className="w-8 h-8 text-[var(--text-body-muted)] mx-auto" />
            <p className="text-sm text-[var(--text-body-muted)]">
              No team members match your filters.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle-card)]">
            {filteredUsers.map((u) => {
              const isCurrentUser = u.id === currentUserId;
              const isOwner = u.role === 'owner';
              const isDev = u.role === 'developer';
              const isBusy = actionInProgress[u.id];

              return (
                <div
                  key={u.id}
                  className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                    !u.isActive ? 'bg-[var(--bg-surface-muted)] opacity-80' : ''
                  }`}
                  data-testid={`user-row-${u.id}`}
                >
                  {/* Left: User Details */}
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
                        isOwner
                          ? 'bg-[var(--bg-surface-muted)] border-[var(--border-gold)] text-[var(--text-accent)]'
                          : isDev
                          ? 'bg-[var(--status-success-bg)] border-[var(--status-success-border)] text-[var(--status-success-text)]'
                          : 'bg-[#6B1230] border-[#D4AF37]/40 text-[#F7EFD9]'
                      }`}
                    >
                      {isOwner ? <ShieldCheck className="w-5 h-5" /> : <User className="w-5 h-5" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-base text-[var(--text-primary)] truncate">
                          {u.fullName}
                        </span>
                        {isCurrentUser && (
                          <span className="text-sm bg-[var(--bg-surface-muted)] text-[var(--text-body-muted)] px-2 py-0.5 rounded font-mono">
                            (You)
                          </span>
                        )}

                        {/* Role Badge */}
                        <span
                          className={`text-sm font-bold px-2.5 py-0.5 rounded-md border uppercase tracking-wider ${
                            isOwner
                              ? 'bg-[#6B1230] border-[#D4AF37]/60 text-[#F7EFD9]'
                              : isDev
                              ? 'bg-[var(--status-success-bg)] border-[var(--status-success-border)] text-[var(--status-success-text)]'
                              : 'bg-[var(--status-info-bg)] border-[var(--status-info-border)] text-[var(--status-info-text)]'
                          }`}
                        >
                          {u.role}
                        </span>

                        {/* Status Badge */}
                        <span
                          className={`text-sm font-bold px-2 py-0.5 rounded-md border uppercase ${
                            u.isActive
                              ? 'bg-[var(--status-success-bg)] border-[var(--status-success-border)] text-[var(--status-success-text)]'
                              : 'bg-[var(--status-danger-bg)] border-[var(--status-danger-border)] text-[var(--status-danger-text)]'
                          }`}
                        >
                          {u.isActive ? 'Active' : 'Deactivated'}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 mt-1 text-sm text-[var(--text-body-muted)] flex-wrap">
                        <span className="flex items-center gap-1.5 font-mono text-sm">
                          <Mail className="w-3.5 h-3.5 text-[var(--text-accent)] shrink-0" />
                          {u.email}
                        </span>

                        {/* MFA Indicator */}
                        <span
                          className={`flex items-center gap-1.5 text-sm font-medium ${
                            u.hasMfaVerified
                              ? 'text-[var(--text-money-positive)]'
                              : 'text-[var(--status-warning-text)]'
                          }`}
                        >
                          {u.hasMfaVerified ? (
                            <ShieldCheck className="w-4 h-4 shrink-0" />
                          ) : (
                            <ShieldAlert className="w-4 h-4 shrink-0" />
                          )}
                          <span>
                            {u.hasMfaVerified
                              ? 'MFA Verified (TOTP)'
                              : isOwner || isDev
                              ? 'MFA Pending Setup'
                              : 'No MFA Required (Staff)'}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-wrap items-center gap-2 self-end sm:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => setPasswordTargetUser(u)}
                      disabled={isBusy}
                      title="Reset staff password"
                      aria-label={`Reset password for ${u.fullName}`}
                      className="px-3.5 py-2 rounded-xl bg-[var(--bg-surface-muted)] hover:border-[var(--border-gold)] border border-[var(--border-card)] text-sm font-semibold text-[var(--text-primary)] inline-flex items-center gap-1.5 min-h-[44px] min-w-[44px] transition-colors"
                    >
                      <KeyRound className="w-4 h-4 text-[var(--text-accent)] shrink-0" />
                      <span>Password</span>
                    </button>

                    {(u.hasMfaVerified || u.mfaFactorsCount > 0) && (
                      <button
                        type="button"
                        onClick={() => handleResetMfa(u)}
                        disabled={isBusy}
                        title="Reset MFA factor (lost phone recovery)"
                        aria-label={`Reset MFA for ${u.fullName}`}
                        className="px-3.5 py-2 rounded-xl bg-[var(--bg-surface-muted)] hover:border-[var(--border-gold)] border border-[var(--border-card)] text-sm font-semibold text-[var(--text-primary)] inline-flex items-center gap-1.5 min-h-[44px] min-w-[44px] transition-colors"
                      >
                        <RotateCcw className="w-4 h-4 text-[var(--status-warning-text)] shrink-0" />
                        <span>Reset MFA</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleToggleActive(u)}
                      disabled={isBusy || isCurrentUser}
                      title={
                        isCurrentUser
                          ? 'You cannot deactivate your own account'
                          : u.isActive
                          ? 'Deactivate account'
                          : 'Reactivate account'
                      }
                      className={`px-3.5 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-1.5 min-h-[44px] border transition-colors ${
                        isCurrentUser
                          ? 'opacity-45 cursor-not-allowed bg-[var(--bg-surface-muted)] border-[var(--border-subtle-card)] text-[var(--text-body-muted)]'
                          : u.isActive
                          ? 'bg-[var(--status-danger-bg)] hover:opacity-90 border-[var(--status-danger-border)] text-[var(--status-danger-text)]'
                          : 'bg-[var(--status-success-bg)] hover:opacity-90 border-[var(--status-success-border)] text-[var(--status-success-text)]'
                      }`}
                    >
                      {u.isActive ? (
                        <>
                          <UserX className="w-4 h-4 shrink-0" />
                          <span>Deactivate</span>
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-4 h-4 shrink-0" />
                          <span>Reactivate</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Safety Notice Card */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-subtle-card)] rounded-xl p-4 flex items-start gap-3 text-sm text-[var(--text-body-muted)]">
        <Info className="w-4 h-4 text-[var(--text-accent)] shrink-0 mt-0.5" />
        <div>
          <strong className="text-[var(--text-primary)]">Role Enforcement Policy:</strong> Owner and Developer
          accounts strictly mandate two-factor authenticator verification (<code>aal2</code>). Deactivating an account immediately blocks its next request and prevents any active session renewal.
        </div>
      </div>

      {/* ADD USER MODAL */}
      {showAddModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-team-modal-title"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle-card)] pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[var(--text-accent)]" />
                <h3 id="add-team-modal-title" className="font-bold text-lg text-[var(--text-primary)]">
                  Add Team Member
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close Add Team Member modal"
                onClick={() => setShowAddModal(false)}
                className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg hover:bg-[var(--bg-surface-muted)] text-[var(--text-body-muted)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label htmlFor="add-staff-name" className="block text-sm font-semibold text-[var(--text-primary)] mb-1.5">
                  Full Name
                </label>
                <input
                  id="add-staff-name"
                  type="text"
                  required
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="e.g. Joy Okafor"
                  className="w-full min-h-[44px] px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-gold)]"
                />
              </div>

              <div>
                <label htmlFor="add-staff-email" className="block text-sm font-semibold text-[var(--text-primary)] mb-1.5">
                  Email Address
                </label>
                <input
                  id="add-staff-email"
                  type="email"
                  required
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  placeholder="e.g. joy@rockucfoods.com"
                  className="w-full min-h-[44px] px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-gold)]"
                />
              </div>

              <div>
                <label htmlFor="add-staff-role" className="block text-sm font-semibold text-[var(--text-primary)] mb-1.5">
                  Role
                </label>
                <select
                  id="add-staff-role"
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value as any)}
                  className="w-full min-h-[44px] px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-gold)]"
                >
                  <option value="staff">Staff (Operational KDS, Dispatch &amp; Orders)</option>
                  <option value="owner">Owner (Full administrative rights &amp; finance)</option>
                  <option value="developer">Developer (Audited platform access with MFA)</option>
                </select>
              </div>

              <div>
                <label htmlFor="add-staff-password" className="block text-sm font-semibold text-[var(--text-primary)] mb-1.5">
                  Initial Password
                </label>
                <input
                  id="add-staff-password"
                  type="text"
                  required
                  value={addPassword}
                  onChange={(e) => setAddPassword(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg text-sm text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--border-gold)]"
                />
                <p className="text-sm text-[var(--text-body-muted)] mt-1">
                  Minimum 8 characters. Must be shared securely with the employee.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-subtle-card)]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold text-[var(--text-body-muted)] border border-[var(--border-subtle-card)] hover:text-[var(--text-primary)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdd}
                  className="min-h-[44px] px-4 py-2 rounded-lg bg-[#6B1230] hover:bg-[#80183b] text-[#F7EFD9] border border-[#D4AF37]/60 text-sm font-bold transition-all shadow-md"
                >
                  {submittingAdd ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {passwordTargetUser && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-password-modal-title"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle-card)] pb-3">
              <div className="flex items-center gap-2 min-w-0">
                <Lock className="w-5 h-5 text-[var(--text-accent)] shrink-0" />
                <h3 id="reset-password-modal-title" className="font-bold text-base text-[var(--text-primary)] truncate">
                  Reset Password for {passwordTargetUser.fullName}
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close Reset Password modal"
                onClick={() => setPasswordTargetUser(null)}
                className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg hover:bg-[var(--bg-surface-muted)] text-[var(--text-body-muted)] shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label htmlFor="reset-staff-password" className="block text-sm font-semibold text-[var(--text-primary)] mb-1.5">
                  New Password
                </label>
                <input
                  id="reset-staff-password"
                  type="text"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg text-sm text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--border-gold)]"
                />
                <p className="text-sm text-[var(--text-body-muted)] mt-1">
                  Minimum 8 characters.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-subtle-card)]">
                <button
                  type="button"
                  onClick={() => setPasswordTargetUser(null)}
                  className="min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold border border-[var(--border-subtle-card)] text-[var(--text-body-muted)] hover:text-[var(--text-primary)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPassword}
                  className="min-h-[44px] px-4 py-2 rounded-lg bg-[#6B1230] hover:bg-[#80183b] text-[#F7EFD9] border border-[#D4AF37]/60 text-sm font-bold transition-all shadow-md"
                >
                  {submittingPassword ? 'Saving...' : 'Set Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* CONFIRM ACTION MODAL */}
      {pendingConfirmAction && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-staff-action-title"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle-card)] pb-3 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <ShieldAlert className="w-5 h-5 text-[var(--status-warning-text)] shrink-0" />
                <h3 id="confirm-staff-action-title" className="font-bold text-base text-[var(--text-primary)] truncate">
                  {pendingConfirmAction.title}
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close confirmation dialog"
                onClick={() => setPendingConfirmAction(null)}
                className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg hover:bg-[var(--bg-surface-muted)] text-[var(--text-body-muted)] shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-[var(--text-primary)] leading-relaxed">
              {pendingConfirmAction.message}
            </p>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-[var(--border-subtle-card)]">
              <button
                type="button"
                onClick={() => setPendingConfirmAction(null)}
                className="min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold border border-[var(--border-subtle-card)] text-[var(--text-body-muted)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="confirm-staff-action-button"
                onClick={executeConfirmedAction}
                className={`min-h-[44px] px-4 py-2 rounded-lg text-sm font-bold border transition-all shadow-md ${
                  pendingConfirmAction.isDanger
                    ? 'bg-[var(--status-danger-bg)] border-[var(--status-danger-border)] text-[var(--status-danger-text)] hover:opacity-90'
                    : 'bg-[#6B1230] hover:bg-[#80183b] text-[#F7EFD9] border-[#D4AF37]/60'
                }`}
              >
                {pendingConfirmAction.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
