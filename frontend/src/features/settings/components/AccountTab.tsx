import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ChevronDown, LogOut } from 'lucide-react';
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
  weak:   { label: 'Weak',   bar: 'bg-red-500',   width: 'w-1/3' },
  medium: { label: 'Medium', bar: 'bg-yellow-400', width: 'w-2/3' },
  strong: { label: 'Strong', bar: 'bg-green-500',  width: 'w-full' },
};

const inputCls =
  'w-full bg-white border border-warm-gray rounded-lg px-3 py-2.5 text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-uci-blue focus:ring-1 focus:ring-uci-blue/20 transition-colors';

const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-espresso/50 mb-1.5';

export default function AccountTab() {
  const navigate = useNavigate();
  const email = getSession()?.email || '—';

  const { data: me } = useQuery<UserMe>({
    queryKey: ['me'],
    queryFn: () => fetchWithAuth(`${API_BASE}/users/me`).then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });
  const hasPassword = me?.has_password ?? true;

  const [open, setOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [localError, setLocalError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [resendMsg, setResendMsg] = useState('');
  const [directNewEmail, setDirectNewEmail] = useState('');
  const [directEmailError, setDirectEmailError] = useState('');
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
      setSuccessMsg('Password updated successfully.');
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
    <div className="space-y-8">

      {/* Email */}
      <section>
        <p className="text-[10px] font-bold uppercase tracking-widest text-espresso/40 mb-4">
          Email Address
        </p>
        <div className="flex items-center gap-2.5 mb-3">
          <div className="flex-1 bg-warm-gray/20 border border-warm-gray rounded-lg px-3 py-2.5 text-sm text-espresso/70">
            {email}
          </div>
          {emailVerified && (
            <span className="shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
              Verified
            </span>
          )}
        </div>

        {!emailVerified && (
          <div className="mb-3 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3">
            <p className="text-sm text-yellow-800 font-medium">Your email address is not verified.</p>
            <button
              onClick={() => { setResendMsg(''); resendMutation.mutate(); }}
              disabled={resendMutation.isPending}
              className="mt-1 text-sm font-semibold text-yellow-700 hover:text-yellow-900 underline disabled:opacity-50"
            >
              {resendMutation.isPending ? 'Sending…' : 'Resend verification email'}
            </button>
            {resendMsg && (
              <p className={`mt-1.5 text-xs ${resendMsg.startsWith('Failed') ? 'text-red-600' : 'text-green-700'}`}>
                {resendMsg}
              </p>
            )}
          </div>
        )}

        {/* Change email */}
        {directEmailMutation.isSuccess ? (
          <p className="text-sm text-green-600">
            Confirmation sent to <strong>{directNewEmail}</strong>. Click the link in that email to complete the change.
          </p>
        ) : (
          <div className="space-y-2">
            <label className={labelCls}>Change Email</label>
            <input
              type="email"
              value={directNewEmail}
              onChange={(e) => setDirectNewEmail(e.target.value)}
              placeholder="New email address"
              className={inputCls}
            />
            {directEmailError && <p className="text-xs text-red-500">{directEmailError}</p>}
            <div className="flex justify-end pt-1">
              <button
                onClick={() => { setDirectEmailError(''); directEmailMutation.mutate(); }}
                disabled={directEmailMutation.isPending || !directNewEmail}
                className="bg-uci-blue hover:bg-uci-navy disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
              >
                {directEmailMutation.isPending ? 'Sending…' : 'Update Email'}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Role badge */}
      {roleBadge && (
        <>
          <div className="border-t border-warm-gray" />
          <section>
            <p className="text-[10px] font-bold uppercase tracking-widest text-espresso/40 mb-3">
              Account Type
            </p>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${roleBadge.className}`}>
              {roleBadge.label}
            </span>
          </section>
        </>
      )}

      <div className="border-t border-warm-gray" />

      {/* Password */}
      <section>
        <p className="text-[10px] font-bold uppercase tracking-widest text-espresso/40 mb-4">
          Password
        </p>
        {hasPassword ? (
          <div className="border border-warm-gray rounded-xl overflow-hidden">
            <button
              onClick={() => { setOpen((v) => !v); setLocalError(''); setSuccessMsg(''); }}
              className="w-full flex items-center justify-between px-4 py-3.5 text-sm font-semibold text-espresso/80 hover:bg-warm-gray/20 transition-colors"
            >
              Change Password
              <ChevronDown
                size={16}
                className={`text-espresso/40 transition-transform ${open ? 'rotate-180' : ''}`}
              />
            </button>

            {open && (
              <div className="px-4 pb-5 pt-4 space-y-4 border-t border-warm-gray bg-white/50">
                <div>
                  <label className={labelCls}>Current Password</label>
                  <input
                    type="password"
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>New Password</label>
                  <div className="relative">
                    <input
                      type={showNew ? 'text' : 'password'}
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      className={`${inputCls} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-espresso/40 hover:text-espresso/70"
                    >
                      {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {strength && (
                    <div className="mt-2">
                      <div className="h-1 w-full bg-warm-gray/60 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${strengthConfig[strength].bar} ${strengthConfig[strength].width}`}
                        />
                      </div>
                      <p className={`text-xs mt-1 ${strength === 'weak' ? 'text-red-500' : strength === 'medium' ? 'text-yellow-600' : 'text-green-600'}`}>
                        {strengthConfig[strength].label}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className={labelCls}>Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPw}
                      onChange={(e) => setConfirmPw(e.target.value)}
                      className={`${inputCls} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-espresso/40 hover:text-espresso/70"
                    >
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {localError && <p className="text-xs text-red-500">{localError}</p>}
                {successMsg && <p className="text-xs text-green-600">{successMsg}</p>}

                <div className="flex items-center justify-between pt-1">
                  {forgotSent ? (
                    <p className="text-sm text-green-600">Check your inbox for a reset link.</p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => forgotFromSettingsMutation.mutate()}
                      disabled={forgotFromSettingsMutation.isPending}
                      className="text-sm text-uci-blue hover:text-uci-navy hover:underline disabled:opacity-50 transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                  <button
                    onClick={handlePasswordSubmit}
                    disabled={passwordMutation.isPending}
                    className="bg-uci-blue hover:bg-uci-navy disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
                  >
                    {passwordMutation.isPending ? 'Updating…' : 'Update Password'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-warm-gray px-4 py-4 bg-warm-gray/10">
            <p className="text-sm font-semibold text-espresso/80 mb-0.5">Managed by Google</p>
            <p className="text-sm text-espresso/50">
              You signed in with Google. Manage your password through your Google account.
            </p>
          </div>
        )}
      </section>

      <div className="border-t border-warm-gray" />

      {/* Sign out */}
      <section>
        <p className="text-[10px] font-bold uppercase tracking-widest text-espresso/40 mb-4">
          Session
        </p>
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-2 text-sm font-semibold text-espresso/70 hover:text-espresso px-4 py-2.5 rounded-lg border border-warm-gray hover:bg-warm-gray/30 transition-colors"
        >
          <LogOut size={15} />
          Log Out
        </button>
      </section>

    </div>
  );
}
