import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { fetchWithAuth, API_BASE } from '@/shared/api/api';
import { getSession, clearSession } from '@/shared/auth/session';

interface UserMe {
  has_password: boolean;
  email_verified: boolean;
  pending_email: string | null;
}

function passwordStrength(pw: string): 'weak' | 'medium' | 'strong' {
  if (pw.length < 8) return 'weak';
  const hasUpper = /[A-Z]/.test(pw);
  const hasNumber = /[0-9]/.test(pw);
  const hasSpecial = /[^A-Za-z0-9]/.test(pw);
  const score = [hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
  if (score >= 2) return 'strong';
  if (score === 1) return 'medium';
  return 'weak';
}

const strengthConfig = {
  weak:   { label: 'Weak',   color: 'bg-red-500',    width: 'w-1/3' },
  medium: { label: 'Medium', color: 'bg-yellow-400',  width: 'w-2/3' },
  strong: { label: 'Strong', color: 'bg-green-500',   width: 'w-full' },
};

export default function AccountTab() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const email = getSession()?.email || '—';

  const { data: me } = useQuery<UserMe>({
    queryKey: ['me'],
    queryFn: () => fetchWithAuth(`${API_BASE}/users/me`).then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });
  const hasPassword = me?.has_password ?? true;

  // Password accordion state
  const [open, setOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [localError, setLocalError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Email change accordion state
  const [emailOpen, setEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');

  // Resend verification inline feedback
  const [resendMsg, setResendMsg] = useState('');

  const strength = newPw ? passwordStrength(newPw) : null;

  const passwordMutation = useMutation({
    mutationFn: () =>
      fetchWithAuth(`${API_BASE}/users/me/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
      }).then(async (r) => {
        if (r.status === 400) throw new Error('Current password is incorrect');
        if (r.status === 422) throw new Error('New password must be at least 8 characters');
        if (!r.ok) throw new Error('Failed to update password');
        return r.json();
      }),
    onSuccess: () => {
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setLocalError('');
      setSuccessMsg('Password updated successfully');
      setOpen(false);
    },
    onError: (err: Error) => setLocalError(err.message),
  });

  const handlePasswordSubmit = () => {
    setLocalError(''); setSuccessMsg('');
    if (newPw !== confirmPw) { setLocalError('Passwords do not match'); return; }
    if (newPw.length < 8) { setLocalError('New password must be at least 8 characters'); return; }
    passwordMutation.mutate();
  };

  const resendMutation = useMutation({
    mutationFn: () =>
      fetchWithAuth(`${API_BASE}/auth/resend-verification`, { method: 'POST' }).then(async (r) => {
        if (!r.ok) throw new Error('resend_failed');
        return r.json();
      }),
    onSuccess: () => setResendMsg('Check your inbox — email sent.'),
    onError: () => setResendMsg('Failed to send. Try again shortly.'),
  });

  const emailChangeMutation = useMutation({
    mutationFn: () =>
      fetchWithAuth(`${API_BASE}/users/me/email`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_email: newEmail }),
      }).then(async (r) => {
        if (r.status === 400) throw new Error('Failed to update email. Please try again.');
        if (!r.ok) throw new Error('Failed to update email. Please try again.');
        return r.json();
      }),
    onSuccess: () => {
      setNewEmail('');
      setEmailError('');
      setEmailSuccess(`Check ${newEmail} for a confirmation link.`);
      setEmailOpen(false);
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (err: Error) => setEmailError(err.message),
  });

  const cancelEmailChangeMutation = useMutation({
    mutationFn: () =>
      fetchWithAuth(`${API_BASE}/users/me/email/cancel`, { method: 'DELETE' }).then(async (r) => {
        if (!r.ok) throw new Error('Failed to cancel email change');
        return r.json();
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  });

  const handleEmailChangeSubmit = () => {
    setEmailError(''); setEmailSuccess('');
    if (!newEmail) { setEmailError('Enter a new email address'); return; }
    emailChangeMutation.mutate();
  };

  const handleLogout = async () => {
    try {
      await fetchWithAuth(`${API_BASE}/auth/logout`, { method: 'POST' });
    } catch {
      // continue regardless
    }
    clearSession();
    navigate('/Login');
  };

  const role = getSession()?.role ?? 'user';
  const roleConfig: Record<string, { label: string; className: string }> = {
    admin:     { label: 'Admin',     className: 'bg-purple-100 text-purple-700 border-purple-200' },
    moderator: { label: 'Moderator', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  };
  const roleBadge = roleConfig[role] ?? null;

  const emailVerified = me?.email_verified ?? true;
  const pendingEmail = me?.pending_email ?? null;

  return (
    <div className="space-y-6">
      {/* Email */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <div className="flex items-center gap-2">
          <p className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-500 bg-gray-50">
            {email}
          </p>
          {emailVerified && !pendingEmail && (
            <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
              Verified
            </span>
          )}
        </div>

        {/* Case A — unverified */}
        {!emailVerified && !pendingEmail && (
          <div className="mt-2 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2">
            <p className="text-sm text-yellow-800">Your email address is not verified.</p>
            <button
              onClick={() => { setResendMsg(''); resendMutation.mutate(); }}
              disabled={resendMutation.isPending}
              className="mt-1 text-sm font-medium text-yellow-700 hover:text-yellow-900 underline disabled:opacity-50"
            >
              {resendMutation.isPending ? 'Sending…' : 'Resend verification email'}
            </button>
            {resendMsg && (
              <p className={`mt-1 text-xs ${resendMsg.startsWith('Failed') ? 'text-red-600' : 'text-green-700'}`}>
                {resendMsg}
              </p>
            )}
          </div>
        )}

        {/* Case B — pending email change */}
        {pendingEmail && (
          <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 flex items-start justify-between gap-2">
            <p className="text-sm text-blue-800">
              Pending change to <span className="font-medium">{pendingEmail}</span> — check your inbox.
            </p>
            <button
              onClick={() => cancelEmailChangeMutation.mutate()}
              disabled={cancelEmailChangeMutation.isPending}
              className="shrink-0 text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
            >
              {cancelEmailChangeMutation.isPending ? 'Cancelling…' : 'Cancel'}
            </button>
          </div>
        )}

        {/* Case C — verified, no pending: show Change Email accordion */}
        {emailVerified && !pendingEmail && (
          <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => { setEmailOpen((v) => !v); setEmailError(''); setEmailSuccess(''); }}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Change Email
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${emailOpen ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {emailOpen && (
              <div className="px-4 pb-4 space-y-3 border-t border-gray-200 pt-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">New email address</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {emailError && <p className="text-xs text-red-500">{emailError}</p>}
                {emailSuccess && <p className="text-xs text-green-600">{emailSuccess}</p>}
                <button
                  onClick={handleEmailChangeSubmit}
                  disabled={emailChangeMutation.isPending}
                  className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  {emailChangeMutation.isPending ? 'Sending…' : 'Send Confirmation'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Role badge — only shown for non-standard roles */}
      {roleBadge && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Account type</label>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${roleBadge.className}`}>
            {roleBadge.label}
          </span>
        </div>
      )}

      {/* Change password */}
      {hasPassword ? (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => { setOpen((v) => !v); setLocalError(''); setSuccessMsg(''); }}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Change Password
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {open && (
            <div className="px-4 pb-4 space-y-3 border-t border-gray-200 pt-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Current password</label>
                <input
                  type="password"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">New password</label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {strength && (
                  <div className="mt-1.5">
                    <div className="h-1 w-full bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${strengthConfig[strength].color} ${strengthConfig[strength].width}`} />
                    </div>
                    <p className={`text-xs mt-0.5 ${strength === 'weak' ? 'text-red-500' : strength === 'medium' ? 'text-yellow-600' : 'text-green-600'}`}>
                      {strengthConfig[strength].label}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Confirm new password</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {localError && <p className="text-xs text-red-500">{localError}</p>}
              {successMsg && <p className="text-xs text-green-600">{successMsg}</p>}

              <button
                onClick={handlePasswordSubmit}
                disabled={passwordMutation.isPending}
                className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {passwordMutation.isPending ? 'Updating…' : 'Update Password'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg px-4 py-3 bg-gray-50">
          <p className="text-sm font-medium text-gray-700 mb-0.5">Password</p>
          <p className="text-sm text-gray-500">
            You signed in with Google. Manage your password through your Google account.
          </p>
        </div>
      )}

      {/* Logout */}
      <div className="pt-2 border-t border-gray-100">
        <button
          onClick={handleLogout}
          className="text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
