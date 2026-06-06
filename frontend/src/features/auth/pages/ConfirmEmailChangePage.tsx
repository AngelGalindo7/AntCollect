import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { API_BASE } from '@/shared/api/api';

type Status = 'loading' | 'success' | 'error';

const ConfirmEmailChangePage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    const [status, setStatus] = useState<Status>(token ? 'loading' : 'error');
    const [errorMessage, setErrorMessage] = useState(
        token ? '' : 'No confirmation token found in the link.'
    );

    useEffect(() => {
        if (!token) return;

        const confirm = async () => {
            try {
                const res = await fetch(`${API_BASE}/auth/confirm-email-change`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token }),
                    credentials: 'include',
                });
                const data = await res.json();
                if (!res.ok) {
                    setErrorMessage(data.detail || 'Confirmation failed. The link may have expired.');
                    setStatus('error');
                    return;
                }
                setStatus('success');
            } catch {
                setErrorMessage('Network error. Please check your connection and try again.');
                setStatus('error');
            }
        };

        confirm();
    }, [token]);

    return (
        <div className="min-h-screen bg-[#F5F5F5] flex flex-col items-center justify-center p-6">
            <div className="mb-[60px]">
                <h1 className="text-6xl font-extrabold text-[#003087] tracking-tight">
                    Petr Collect
                </h1>
            </div>

            <div className="bg-white w-full max-w-[440px] rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.08)] p-12 text-center">
                {status === 'loading' && (
                    <>
                        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                            Confirming…
                        </h2>
                        <p className="text-sm text-gray-500">
                            Please wait while we update your email address.
                        </p>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                            Email Updated
                        </h2>
                        <p className="text-sm text-gray-600 mb-8">
                            Your email has been updated successfully. Log in with your new address.
                        </p>
                        <Link
                            to="/Login"
                            className="inline-block h-[52px] leading-[52px] w-full bg-[#FFD200] hover:bg-[#e6bd00] text-[#003087] font-bold text-base rounded transition-colors"
                        >
                            Go to Login
                        </Link>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                            Confirmation Failed
                        </h2>
                        <p className="text-sm text-red-500 mb-8">
                            {errorMessage}
                        </p>
                        <Link
                            to="/Login"
                            className="inline-block h-[52px] leading-[52px] w-full bg-[#FFD200] hover:bg-[#e6bd00] text-[#003087] font-bold text-base rounded transition-colors"
                        >
                            Go to Login
                        </Link>
                    </>
                )}
            </div>
        </div>
    );
};

export default ConfirmEmailChangePage;
