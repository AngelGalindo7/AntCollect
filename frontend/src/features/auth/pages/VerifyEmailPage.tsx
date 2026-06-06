import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { API_BASE } from '@/shared/api/api';

type State = 'loading' | 'success' | 'error';

const VerifyEmailPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    const [state, setState] = useState<State>(token ? 'loading' : 'error');
    const [errorDetail, setErrorDetail] = useState<string>(
        token ? '' : 'No verification token was provided.'
    );

    useEffect(() => {
        if (!token) return;

        const verify = async () => {
            try {
                const res = await fetch(`${API_BASE}/auth/verify-email`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token }),
                });
                const data = await res.json();
                if (res.ok) {
                    setState('success');
                } else {
                    setErrorDetail(data.detail ?? 'Verification failed. Please try again.');
                    setState('error');
                }
            } catch {
                setErrorDetail('Network error. Please check your connection and try again.');
                setState('error');
            }
        };

        verify();
    }, []);  // intentionally empty — runs once on mount

    return (
        <div className="min-h-screen bg-[#F5F5F5] flex flex-col items-center justify-center p-6">
            <div className="mb-[60px]">
                <h1 className="text-6xl font-extrabold text-[#003087] tracking-tight">
                    Petr Collect
                </h1>
            </div>

            <div className="bg-white w-full max-w-[440px] rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.08)] p-12 flex flex-col items-center text-center">
                {state === 'loading' && (
                    <>
                        <div className="w-10 h-10 border-4 border-[#003087] border-t-transparent rounded-full animate-spin mb-6" />
                        <p className="text-gray-500 text-sm">Verifying your email address…</p>
                    </>
                )}

                {state === 'success' && (
                    <>
                        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Email Verified</h2>
                        <p className="text-gray-600 text-sm mb-8">
                            Your email address has been confirmed.
                        </p>
                        <Link
                            to="/settings?tab=account"
                            className="h-[52px] w-full flex items-center justify-center bg-[#FFD200] hover:bg-[#e6bd00] text-[#003087] font-bold text-base rounded transition-colors"
                        >
                            Go to Settings
                        </Link>
                    </>
                )}

                {state === 'error' && (
                    <>
                        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Verification Failed</h2>
                        <p className="text-red-500 text-sm mb-4">{errorDetail}</p>
                        <p className="text-gray-400 text-xs">
                            You can resend from Settings &gt; Account
                        </p>
                    </>
                )}
            </div>
        </div>
    );
};

export default VerifyEmailPage;
