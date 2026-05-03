import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_BASE } from '@/shared/api/api';
import { getSession, setSession, type Role } from '@/shared/auth/session';

const GoogleIcon = () => (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
        <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
);

const LogIn: React.FC = () => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const navigate = useNavigate();

    useEffect(() => {
        if (getSession()) {
            navigate('/', { replace: true });
        }
    }, [navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        try {
            const res = await fetch(`${API_BASE}/users/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: username, password }),
                credentials: "include",
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.detail || "Something went wrong.");
                return;
            }

            if (data.user) {
                setSession({
                    userId: data.user.id.toString(),
                    username: data.user.username,
                    email: data.user.email,
                    role: (data.user.role as Role) ?? 'user',
                });
                window.dispatchEvent(new Event('auth:login'));
            }

            setSuccess("Redirecting ...");
            navigate(`/${data.user.username}`);
        } catch (err) {
            console.error("Network Error:", err);
            setError("Network error.");
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
                    Login with your username
                </h2>

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

                    <div className="relative">
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder=" "
                            className="peer w-full h-[52px] px-4 pt-5 pb-2 rounded border border-gray-300 focus:outline-none focus:border-[#003087] text-sm transition-all"
                        />
                        <label
                            htmlFor="password"
                            className="absolute left-4 top-2 text-xs text-gray-500 transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-placeholder-shown:text-gray-400 peer-focus:top-2 peer-focus:text-xs peer-focus:text-[#003087]"
                        >
                            Password
                        </label>
                    </div>

                    <div className="flex justify-between items-center text-sm px-1">
                        <a href="#" className="text-[#003087] hover:underline">Forgot password?</a>
                        <Link to="/CreateAccount" className="text-[#003087] hover:underline">Sign up</Link>
                    </div>

                    <button
                        type="submit"
                        className="h-[52px] w-full bg-[#FFD200] hover:bg-[#e6bd00] text-[#003087] font-bold text-base rounded transition-colors cursor-pointer mt-2"
                    >
                        LOGIN
                    </button>
                </form>

                <div className="flex items-center gap-3 mt-6">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400">or</span>
                    <div className="flex-1 h-px bg-gray-200" />
                </div>

                <a
                    href={`${API_BASE}/auth/google`}
                    className="mt-4 flex items-center justify-center gap-3 h-[52px] w-full border border-gray-300 rounded hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
                >
                    <GoogleIcon />
                    Sign in with Google
                </a>

                {error && <p className="text-red-500 text-sm mt-4 text-center">{error}</p>}
                {success && <p className="text-green-600 text-sm mt-4 text-center">{success}</p>}
            </div>
        </div>
    );
};

export default LogIn;
