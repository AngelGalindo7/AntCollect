import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { fetchWithAuth, API_BASE } from '@/shared/api/api';
import { getSession, clearSession } from '@/shared/auth/session';

interface UserMe {
  has_password: boolean;
  email_verified: boolean;
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

  // Resend verification inline feedback
  const [resendMsg, setResendMsg] = useState('');

  // Send-intent button feedback
  const [intentError, setIntentError] = useState('');

  // Direct email change (unverified users only)
  const [directNewEmail, setDirectNewEmail] = useState('');
  const [directEmailError, setDirectEmailError] = useState('');

  // Forgot-password shortcut feedback
  const [forgotSent, setForgotSent] = useState(false);

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

  const sendIntentMutation = useMutation({
    mutationFn: () =>
      fetchWithAuth(`${API_BASE}/auth/send-change-email-intent`, { method: 'POST' }).then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data.detail ?? 'Failed to send link. Try again.');
        }
        return r.json();
      }),
    onError: (err: Error) => setIntentError(err.message),
  });

  const directEmailMutation = useMutation({
    mutationFn: () =>
      fetchWithAuth(`${API_BASE}/users/me/email`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_email: directNewEmail }),
      }).then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data.detail ?? 'Failed to update email. Try again.');
        }
        return r.json();
      }),
    onError: (err: Error) => setDirectEmailError(err.message),
  });

  const forgotFromSettingsMutation = useMutation({
    mutationFn: () =>
      fetchWithAuth(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: getSession()?.email ?? '' }),
      }).then((r) => r.json()),
    onSettled: () => setForgotSent(true),
  });

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

  return (
    <div className="space-y-6">
      {/* Email */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <div className="flex items-center gap-2">
          <p className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-500 bg-gray-50">
            {email}
          </p>
          {emailVerified && (
            <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
              Verified
            </span>
          )}
        </div>

        {/* Case A — unverified */}
        {!emailVerified && (
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

        {/* Change email */}
        <div className="mt-3">
          {emailVerified ? (
            // Verified: send intent link to current inbox to prove ownership
            sendIntentMutation.isSuccess ? (
              <p className="text-sm text-green-600">
                Check your inbox — a link to change your email has been sent.
              </p>
            ) : (
              <>
                <button
                  onClick={() => { setIntentError(''); sendIntentMutation.mutate(); }}
                  disabled={sendIntentMutation.isPending}
                  className="text-sm font-medium text-blue-600 hover:text-blue-800 underline disabled:opacity-50"
                >
                  {sendIntentMutation.isPending ? 'Sending…' : 'Send change email link'}
                </button>
                {intentError && (
                  <p className="mt-1 text-xs text-red-500">{intentError}</p>
                )}
              </>
            )
          ) : directEmailMutation.isSuccess ? (
            // Unverified success
            <p className="text-sm text-green-600">
              Confirmation sent to {directNewEmail}. Click the link in that email to complete the change.
            </p>
          ) : (
            // Unverified: current email is untrusted, allow direct change
            <div className="space-y-2">
              <input
                type="email"
                value={directNewEmail}
                onChange={(e) => setDirectNewEmail(e.target.value)}
                placeholder="New email address"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => { setDirectEmailError(''); directEmailMutation.mutate(); }}
                disabled={directEmailMutation.isPending || !directNewEmail}
                className="text-sm font-medium text-blue-600 hover:text-blue-800 underline disabled:opacity-50"
              >
                {directEmailMutation.isPending ? 'Sending…' : 'Update Email'}
              </button>
              {directEmailError && (
                <p className="mt-1 text-xs text-red-500">{directEmailError}</p>
              )}
            </div>
          )}
        </div>
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

              {forgotSent ? (
                <p className="mt-2 text-sm text-green-600">Check your inbox for a reset link.</p>
              ) : (
                <button
                  type="button"
                  onClick={() => forgotFromSettingsMutation.mutate()}
                  disabled={forgotFromSettingsMutation.isPending}
                  className="mt-2 text-sm text-blue-600 hover:underline cursor-pointer disabled:opacity-50"
                >
                  Forgot your password?
                </button>
              )}
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
