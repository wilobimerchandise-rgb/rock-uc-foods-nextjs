'use client';

/**
 * ROCK UC FOODS - Staff User Management Screen (Phase 1E)
 * Playbook v2 Section 6 (Phase 1), Section 9 (Phase 4), Section 28.4 (Phase 1E)
 * 
 * Rules:
 * - Owner ONLY with Second-Factor MFA.
 * - Manage staff, developer, and owner accounts.
 * - Self-deactivation prevention for the active owner.
 * - Lost-phone recovery via Reset MFA.
 * - Mobile-first layout with 44px+ touch targets, dark brand luxury styling.
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
import { PublicStaffUser } from '@/src/auth/staff-service';

interface StaffUserManagerProps {
  currentUserRole?: string;
  currentUserId?: string;
}

export function StaffUserManager({
  currentUserRole = 'owner',
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

  async function handleToggleActive(user: PublicStaffUser) {
    if (user.id === currentUserId) {
      setErrorMsg('You cannot deactivate your own owner account.');
      return;
    }

    const nextState = !user.isActive;
    const confirmText = nextState
      ? `Reactivate account for ${user.fullName}?`
      : `Deactivate ${user.fullName}? They will be immediately signed out and lose access.`;

    if (!window.confirm(confirmText)) return;

    setActionInProgress((prev) => ({ ...prev, [user.id]: true }));
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_active',
          isActive: nextState,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update account status.');
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? data.user : u))
      );
      setSuccessMsg(
        nextState
          ? `Account for ${user.fullName} successfully reactivated.`
          : `Account for ${user.fullName} deactivated. Access revoked immediately.`
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'Operation failed.');
    } finally {
      setActionInProgress((prev) => ({ ...prev, [user.id]: false }));
    }
  }

  async function handleResetMfa(user: PublicStaffUser) {
    const confirmText = `Reset MFA for ${user.fullName}? This removes their registered authenticator app and requires re-enrollment on their next sign-in (use this for lost phones).`;
    if (!window.confirm(confirmText)) return;

    setActionInProgress((prev) => ({ ...prev, [user.id]: true }));
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_mfa' }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset MFA.');
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? data.user : u))
      );
      setSuccessMsg(`MFA factors for ${user.fullName} have been cleared.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'MFA reset failed.');
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
    <div className="space-y-6 max-w-full">
      {/* Header Banner */}
      <div className="bg-[#17120F] border border-[#D4AF37]/30 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#6B1230]/40 border border-[#D4AF37]/50 flex items-center justify-center text-[#D4AF37] shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-[#F7EFD9] tracking-tight">
                  Staff & User Management
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/40 uppercase tracking-widest">
                  Phase 1E
                </span>
              </div>
              <p className="text-xs text-[#F7EFD9]/60 mt-1">
                Owner-only directory for team accounts, role-based access, and lost-phone authenticator recovery.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            data-testid="add-staff-button"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#6B1230] hover:bg-[#80183b] text-[#F7EFD9] border border-[#D4AF37]/60 font-semibold text-xs tracking-wide shadow-lg transition-all min-h-[44px]"
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
          className="p-4 rounded-xl bg-red-950/60 border border-red-500/50 text-red-200 text-xs flex items-center justify-between gap-3 shadow-lg"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={() => setErrorMsg(null)}
            className="p-1 rounded hover:bg-white/10 text-red-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div
          role="status"
          className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 text-xs flex items-center justify-between gap-3 shadow-lg"
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            onClick={() => setSuccessMsg(null)}
            className="p-1 rounded hover:bg-white/10 text-emerald-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-[#17120F] border border-white/10 rounded-xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#0B0A09] border border-white/10 rounded-lg text-xs text-[#F7EFD9] placeholder:text-white/30 focus:outline-none focus:border-[#D4AF37]"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-[#0B0A09] px-2.5 py-1.5 rounded-lg border border-white/10">
            <Filter className="w-3.5 h-3.5 text-[#D4AF37]" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="bg-transparent text-xs text-[#F7EFD9] focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-[#0B0A09]">All Roles</option>
              <option value="owner" className="bg-[#0B0A09]">Owner</option>
              <option value="staff" className="bg-[#0B0A09]">Staff</option>
              <option value="developer" className="bg-[#0B0A09]">Developer</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-[#0B0A09] px-2.5 py-1.5 rounded-lg border border-white/10">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-transparent text-xs text-[#F7EFD9] focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-[#0B0A09]">All Statuses</option>
              <option value="active" className="bg-[#0B0A09]">Active Only</option>
              <option value="deactivated" className="bg-[#0B0A09]">Deactivated</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users List */}
      <div className="bg-[#17120F] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-[#F7EFD9]/40 text-xs animate-pulse">
            Loading team directory...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Users className="w-8 h-8 text-white/20 mx-auto" />
            <p className="text-xs text-white/50">No team members match your filters.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredUsers.map((u) => {
              const isCurrentUser = u.id === currentUserId;
              const isOwner = u.role === 'owner';
              const isDev = u.role === 'developer';
              const isBusy = actionInProgress[u.id];

              return (
                <div
                  key={u.id}
                  className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                    !u.isActive ? 'bg-[#0B0A09]/60 opacity-75' : 'hover:bg-white/[0.02]'
                  }`}
                  data-testid={`user-row-${u.id}`}
                >
                  {/* Left: User Details */}
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                        isOwner
                          ? 'bg-[#D4AF37]/10 border-[#D4AF37]/50 text-[#D4AF37]'
                          : isDev
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                          : 'bg-[#6B1230]/20 border-[#6B1230]/50 text-[#F7EFD9]'
                      }`}
                    >
                      {isOwner ? (
                        <ShieldCheck className="w-5 h-5" />
                      ) : (
                        <User className="w-5 h-5" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-[#F7EFD9] truncate">
                          {u.fullName}
                        </span>
                        {isCurrentUser && (
                          <span className="text-[10px] bg-white/10 text-white/70 px-1.5 py-0.2 rounded font-mono">
                            (You)
                          </span>
                        )}

                        {/* Role Badge */}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                            isOwner
                              ? 'bg-[#D4AF37]/20 border-[#D4AF37]/60 text-[#D4AF37]'
                              : isDev
                              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                              : 'bg-purple-950/60 border-purple-500/50 text-purple-300'
                          }`}
                        >
                          {u.role}
                        </span>

                        {/* Status Badge */}
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                            u.isActive
                              ? 'bg-emerald-900/30 border-emerald-500/40 text-emerald-400'
                              : 'bg-red-900/30 border-red-500/40 text-red-400'
                          }`}
                        >
                          {u.isActive ? 'Active' : 'Deactivated'}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 mt-1 text-xs text-[#F7EFD9]/60 flex-wrap">
                        <span className="flex items-center gap-1 font-mono text-[11px]">
                          <Mail className="w-3 h-3 text-[#D4AF37]/70" />
                          {u.email}
                        </span>

                        {/* MFA Indicator */}
                        <span
                          className={`flex items-center gap-1 text-[11px] ${
                            u.hasMfaVerified ? 'text-emerald-400' : 'text-amber-400/80'
                          }`}
                        >
                          {u.hasMfaVerified ? (
                            <ShieldCheck className="w-3 h-3" />
                          ) : (
                            <ShieldAlert className="w-3 h-3" />
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
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {/* Reset Password */}
                    <button
                      onClick={() => setPasswordTargetUser(u)}
                      disabled={isBusy}
                      title="Reset staff password"
                      className="px-3 py-1.5 rounded-lg bg-[#0B0A09] hover:bg-white/5 border border-white/10 text-xs text-[#F7EFD9] flex items-center gap-1.5 min-h-[44px] transition-colors"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span className="hidden sm:inline">Password</span>
                    </button>

                    {/* Reset MFA */}
                    {(u.hasMfaVerified || u.mfaFactorsCount > 0) && (
                      <button
                        onClick={() => handleResetMfa(u)}
                        disabled={isBusy}
                        title="Reset MFA factor (lost phone recovery)"
                        className="px-3 py-1.5 rounded-lg bg-[#0B0A09] hover:bg-white/5 border border-white/10 text-xs text-[#F7EFD9] flex items-center gap-1.5 min-h-[44px] transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                        <span className="hidden sm:inline">Reset MFA</span>
                      </button>
                    )}

                    {/* Deactivate / Reactivate Toggle */}
                    <button
                      onClick={() => handleToggleActive(u)}
                      disabled={isBusy || isCurrentUser}
                      title={
                        isCurrentUser
                          ? 'You cannot deactivate your own account'
                          : u.isActive
                          ? 'Deactivate account'
                          : 'Reactivate account'
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 min-h-[44px] border transition-colors ${
                        isCurrentUser
                          ? 'opacity-40 cursor-not-allowed bg-black/40 border-white/5 text-white/40'
                          : u.isActive
                          ? 'bg-red-950/40 hover:bg-red-900/60 border-red-500/40 text-red-300'
                          : 'bg-emerald-950/40 hover:bg-emerald-900/60 border-emerald-500/40 text-emerald-300'
                      }`}
                    >
                      {u.isActive ? (
                        <>
                          <UserX className="w-3.5 h-3.5" />
                          <span>Deactivate</span>
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-3.5 h-3.5" />
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
      <div className="bg-[#17120F]/60 border border-white/5 rounded-xl p-4 flex items-start gap-3 text-xs text-[#F7EFD9]/60">
        <Info className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
        <div>
          <strong className="text-[#F7EFD9]">Role Enforcement Policy:</strong> Owner and Developer
          accounts strictly mandate two-factor authenticator verification (`aal2`). Deactivating an account immediately blocks its next request and prevents any active session renewal.
        </div>
      </div>

      {/* ADD USER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#17120F] border border-[#D4AF37]/40 rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#D4AF37]" />
                <h3 className="font-bold text-base text-[#F7EFD9]">Add Team Member</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-white/50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#F7EFD9] mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="e.g. Joy Okafor"
                  className="w-full px-3 py-2 bg-[#0B0A09] border border-white/15 rounded-lg text-xs text-[#F7EFD9] focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#F7EFD9] mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  placeholder="e.g. joy@rockucfoods.com"
                  className="w-full px-3 py-2 bg-[#0B0A09] border border-white/15 rounded-lg text-xs text-[#F7EFD9] focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#F7EFD9] mb-1">
                  Role
                </label>
                <select
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value as any)}
                  className="w-full px-3 py-2 bg-[#0B0A09] border border-white/15 rounded-lg text-xs text-[#F7EFD9] focus:outline-none focus:border-[#D4AF37]"
                >
                  <option value="staff">Staff (Operational KDS, Dispatch & Orders)</option>
                  <option value="owner">Owner (Full administrative rights & finance)</option>
                  <option value="developer">Developer (Audited platform access with MFA)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#F7EFD9] mb-1">
                  Initial Password
                </label>
                <input
                  type="text"
                  required
                  value={addPassword}
                  onChange={(e) => setAddPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0B0A09] border border-white/15 rounded-lg text-xs text-[#F7EFD9] font-mono focus:outline-none focus:border-[#D4AF37]"
                />
                <p className="text-[10px] text-white/40 mt-1">
                  Minimum 8 characters. Must be shared securely with the employee.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white/70 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdd}
                  className="px-4 py-2 rounded-lg bg-[#6B1230] hover:bg-[#80183b] text-[#F7EFD9] border border-[#D4AF37]/60 text-xs font-bold transition-all shadow-md min-h-[44px]"
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#17120F] border border-[#D4AF37]/40 rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-[#D4AF37]" />
                <h3 className="font-bold text-base text-[#F7EFD9]">
                  Reset Password for {passwordTargetUser.fullName}
                </h3>
              </div>
              <button
                onClick={() => setPasswordTargetUser(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-white/50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#F7EFD9] mb-1">
                  New Password
                </label>
                <input
                  type="text"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0B0A09] border border-white/15 rounded-lg text-xs text-[#F7EFD9] font-mono focus:outline-none focus:border-[#D4AF37]"
                />
                <p className="text-[10px] text-white/40 mt-1">
                  Minimum 8 characters.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setPasswordTargetUser(null)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white/70 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPassword}
                  className="px-4 py-2 rounded-lg bg-[#6B1230] hover:bg-[#80183b] text-[#F7EFD9] border border-[#D4AF37]/60 text-xs font-bold transition-all shadow-md min-h-[44px]"
                >
                  {submittingPassword ? 'Saving...' : 'Set Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
