import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { fetchWithAuth } from '@/shared/api/api';

const API_BASE = 'http://localhost:8000';

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
  const email = localStorage.getItem('email') ?? '—';

  const [open, setOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [localError, setLocalError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

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

  const handleLogout = async () => {
    try {
      await fetchWithAuth(`${API_BASE}/auth/logout`, { method: 'POST' });
    } catch {
      // continue regardless
    }
    localStorage.removeItem('username');
    localStorage.removeItem('userId');
    localStorage.removeItem('email');
    navigate('/Login');
  };

  return (
    <div className="space-y-6">
      {/* Email */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <p className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-500 bg-gray-50">
          {email}
        </p>
      </div>

      {/* Change password accordion */}
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
                  {showNew ? '🙈' : '👁️'}
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
                  {showConfirm ? '🙈' : '👁️'}
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

      {/* Logout */}
      <div className="pt-2">
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-gray-700 font-medium underline"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
