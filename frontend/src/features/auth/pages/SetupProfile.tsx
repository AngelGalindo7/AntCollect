import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API_BASE } from '@/shared/api/api';

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,50}$/;

const SetupProfile: React.FC = () => {
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const displayName = searchParams.get('name') || '';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!USERNAME_REGEX.test(username)) {
            setError('3–50 characters, letters, numbers, and underscores only.');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/auth/google/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username }),
                credentials: 'include',
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.detail || 'Something went wrong.');
                return;
            }
            localStorage.setItem('userId', String(data.id));
            localStorage.setItem('username', data.username);
            localStorage.setItem('email', data.email);
            window.dispatchEvent(new Event('auth:login'));
            navigate(`/${data.username}`, { replace: true });
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
                <h2 className="text-2xl font-semibold text-gray-800 text-center mb-2">
                    {displayName ? `Welcome, ${displayName}!` : 'One last step'}
                </h2>
                <p className="text-sm text-gray-500 text-center mb-8">
                    Choose a username for your account.
                </p>

                <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                    <div className="relative">
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            placeholder=" "
                            className="peer w-full h-[52px] px-4 pt-5 pb-2 rounded border border-gray-300 focus:outline-none focus:border-[#003087] text-sm transition-all"
                        />
                        <label
                            htmlFor="username"
                            className="absolute left-4 top-2 text-xs text-gray-500 transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-placeholder-shown:text-gray-400 peer-focus:top-2 peer-focus:text-xs peer-focus:text-[#003087]"
                        >
                            Username
                        </label>
                    </div>

                    <p className="text-xs text-gray-400 -mt-4 px-1">
                        Letters, numbers, and underscores only.
                    </p>

                    <button
                        type="submit"
                        disabled={loading}
                        className="h-[52px] w-full bg-[#FFD200] hover:bg-[#e6bd00] text-[#003087] font-bold text-base rounded transition-colors cursor-pointer mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {loading ? 'SAVING...' : 'GET STARTED'}
                    </button>
                </form>

                {error && (
                    <p className="text-red-500 text-sm mt-4 text-center">{error}</p>
                )}
            </div>
        </div>
    );
};

export default SetupProfile;
