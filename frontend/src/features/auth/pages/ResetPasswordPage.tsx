import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { API_BASE } from '@/shared/api/api';

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
  weak:   { label: 'Weak',   color: 'bg-red-500',   width: 'w-1/3' },
  medium: { label: 'Medium', color: 'bg-yellow-400', width: 'w-2/3' },
  strong: { label: 'Strong', color: 'bg-green-500',  width: 'w-full' },
};

const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const strength = newPw ? passwordStrength(newPw) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPw.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPw !== confirmPw) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: newPw }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || 'Something went wrong.');
        return;
      }
      setSuccess(true);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col items-center justify-center p-6">
      <div className="mb-[60px]">
        <h1 className="text-6xl font-extrabold text-[#003087] tracking-tight">
          Petr Collect
        </h1>
      </div>

      <div className="bg-white w-full max-w-[440px] rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.08)] p-12">
        {!token ? (
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-gray-800 mb-3">Invalid Reset Link</h2>
            <p className="text-sm text-gray-500 mb-6">
              This password reset link is missing a token. Please request a new one.
            </p>
            <Link to="/Login" className="text-[#003087] text-sm font-medium hover:underline">
              Back to Login
            </Link>
          </div>
        ) : success ? (
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-gray-800 mb-3">Password Updated</h2>
            <p className="text-sm text-gray-500 mb-6">
              Your password has been reset. You can now log in.
            </p>
            <Link
              to="/Login"
              className="inline-block h-[52px] px-8 leading-[52px] bg-[#FFD200] hover:bg-[#e6bd00] text-[#003087] font-bold text-base rounded transition-colors"
            >
              Go to Login
            </Link>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-semibold text-gray-800 text-center mb-8">
              Reset Your Password
            </h2>

            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              {/* New password */}
              <div>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showNew ? 'text' : 'password'}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    required
                    placeholder=" "
                    className="peer w-full h-[52px] px-4 pt-5 pb-2 pr-10 rounded border border-gray-300 focus:outline-none focus:border-[#003087] text-sm transition-all"
                  />
                  <label
                    htmlFor="new-password"
                    className="absolute left-4 top-2 text-xs text-gray-500 transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-placeholder-shown:text-gray-400 peer-focus:top-2 peer-focus:text-xs peer-focus:text-[#003087]"
                  >
                    New Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {strength && (
                  <div className="mt-1.5 px-1">
                    <div className="h-1 w-full bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${strengthConfig[strength].color} ${strengthConfig[strength].width}`}
                      />
                    </div>
                    <p
                      className={`text-xs mt-0.5 ${
                        strength === 'weak'
                          ? 'text-red-500'
                          : strength === 'medium'
                          ? 'text-yellow-600'
                          : 'text-green-600'
                      }`}
                    >
                      {strengthConfig[strength].label}
                    </p>
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div className="relative">
                <input
                  id="confirm-password"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  required
                  placeholder=" "
                  className="peer w-full h-[52px] px-4 pt-5 pb-2 pr-10 rounded border border-gray-300 focus:outline-none focus:border-[#003087] text-sm transition-all"
                />
                <label
                  htmlFor="confirm-password"
                  className="absolute left-4 top-2 text-xs text-gray-500 transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-placeholder-shown:text-gray-400 peer-focus:top-2 peer-focus:text-xs peer-focus:text-[#003087]"
                >
                  Confirm Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {error && <p className="text-red-500 text-sm text-center">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="h-[52px] w-full bg-[#FFD200] hover:bg-[#e6bd00] disabled:opacity-50 text-[#003087] font-bold text-base rounded transition-colors cursor-pointer mt-2"
              >
                {loading ? 'Updating…' : 'RESET PASSWORD'}
              </button>

              <div className="text-center">
                <Link to="/Login" className="text-[#003087] text-sm hover:underline">
                  Back to Login
                </Link>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
