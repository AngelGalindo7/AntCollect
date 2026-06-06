import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '@/shared/api/api';

const ForgotPasswordPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await fetch(`${API_BASE}/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
        } catch {
            // swallow — anti-enumeration: always show success
        }
        setSubmitted(true);
    };

    return (
        <div className="min-h-screen bg-[#F5F5F5] flex flex-col items-center justify-center p-6">
            <div className="mb-[60px]">
                <h1 className="text-6xl font-extrabold text-[#003087] tracking-tight">
                    Petr Collect
                </h1>
            </div>

            <div className="bg-white w-full max-w-[440px] rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.08)] p-12">
                {submitted ? (
                    <p className="text-gray-700 text-sm text-center leading-relaxed">
                        If that email is registered, a password reset link has been sent. Check your inbox.
                    </p>
                ) : (
                    <>
                        <h2 className="text-2xl font-semibold text-gray-800 text-center mb-8">
                            Reset your password
                        </h2>

                        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                            <div className="relative">
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    placeholder=" "
                                    className="peer w-full h-[52px] px-4 pt-5 pb-2 rounded border border-gray-300 focus:outline-none focus:border-[#003087] text-sm transition-all"
                                />
                                <label
                                    htmlFor="email"
                                    className="absolute left-4 top-2 text-xs text-gray-500 transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-placeholder-shown:text-gray-400 peer-focus:top-2 peer-focus:text-xs peer-focus:text-[#003087]"
                                >
                                    Email
                                </label>
                            </div>

                            <button
                                type="submit"
                                className="h-[52px] w-full bg-[#FFD200] hover:bg-[#e6bd00] text-[#003087] font-bold text-base rounded transition-colors cursor-pointer mt-2"
                            >
                                SEND RESET LINK
                            </button>
                        </form>
                    </>
                )}
            </div>

            <Link
                to="/Login"
                className="mt-6 text-sm text-[#003087] hover:underline"
            >
                Back to Login
            </Link>
        </div>
    );
};

export default ForgotPasswordPage;
