import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchWithAuth, API_BASE } from '@/shared/api/api';

interface FormState {
    newEmail: string;
}

const ChangeEmailPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    const [form, setForm] = useState<FormState>({ newEmail: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successEmail, setSuccessEmail] = useState('');

    if (!token) {
        return (
            <div className="min-h-screen bg-[#F5F5F5] flex flex-col items-center justify-center p-6">
                <div className="mb-[60px]">
                    <h1 className="text-6xl font-extrabold text-[#003087] tracking-tight">
                        Petr Collect
                    </h1>
                </div>
                <div className="bg-white w-full max-w-[440px] rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.08)] p-12 text-center">
                    <p className="text-red-500 text-sm">Invalid link.</p>
                </div>
            </div>
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetchWithAuth(`${API_BASE}/users/me/email`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ intent_token: token, new_email: form.newEmail }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.detail || 'Something went wrong.');
                return;
            }

            setSuccessEmail(form.newEmail);
        } catch {
            setError('Network error.');
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
                <h2 className="text-2xl font-semibold text-gray-800 text-center mb-8">
                    Change Email Address
                </h2>

                {successEmail ? (
                    <p className="text-green-600 text-sm text-center">
                        Confirmation sent to {successEmail}. Click the link in that email to complete the change.
                    </p>
                ) : (
                    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                        <div className="relative">
                            <input
                                id="newEmail"
                                type="email"
                                value={form.newEmail}
                                onChange={(e) => setForm({ newEmail: e.target.value })}
                                required
                                placeholder=" "
                                className="peer w-full h-[52px] px-4 pt-5 pb-2 rounded border border-gray-300 focus:outline-none focus:border-[#003087] text-sm transition-all"
                            />
                            <label
                                htmlFor="newEmail"
                                className="absolute left-4 top-2 text-xs text-gray-500 transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-placeholder-shown:text-gray-400 peer-focus:top-2 peer-focus:text-xs peer-focus:text-[#003087]"
                            >
                                New email address
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="h-[52px] w-full bg-[#FFD200] hover:bg-[#e6bd00] disabled:opacity-60 text-[#003087] font-bold text-base rounded transition-colors cursor-pointer"
                        >
                            {loading ? 'Updating…' : 'Update Email'}
                        </button>

                        {error && (
                            <p className="text-red-500 text-sm text-center">{error}</p>
                        )}
                    </form>
                )}
            </div>
        </div>
    );
};

export default ChangeEmailPage;
