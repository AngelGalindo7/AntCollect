import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_BASE } from '@/shared/api/api';

const LogIn: React.FC = () => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const navigate = useNavigate();

    useEffect(() => {
        if (localStorage.getItem('userId')) {
            navigate('/', { replace: true });
        }
    }, [navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

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
                localStorage.setItem("userId", data.user.id.toString());
                localStorage.setItem("email", data.user.email);
                localStorage.setItem("username", data.user.username);
                window.dispatchEvent(new Event('auth:login'));
            }

            navigate(`/${data.user.username}`);
        } catch (err) {
            console.error("Network Error:", err);
            setError("Network error.");
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#f0ede6]">
            <h1 className="text-6xl font-extrabold text-[#003087] mb-10 tracking-tight">
                Petr Collect
            </h1>

            <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg px-8 py-9">
                <h2 className="text-2xl font-semibold text-gray-800 text-center mb-6">
                    Login with your username
                </h2>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="relative">
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            placeholder=" "
                            className="peer w-full px-3 pt-5 pb-2 rounded-lg border border-gray-300 focus:outline-none focus:border-[#003087] text-sm bg-white"
                        />
                        <label
                            htmlFor="username"
                            className="absolute left-3 top-2 text-xs text-gray-500 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-gray-400 peer-focus:top-2 peer-focus:text-xs peer-focus:text-[#003087]"
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
                            className="peer w-full px-3 pt-5 pb-2 rounded-lg border border-gray-300 focus:outline-none focus:border-[#003087] text-sm bg-white"
                        />
                        <label
                            htmlFor="password"
                            className="absolute left-3 top-2 text-xs text-gray-500 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-gray-400 peer-focus:top-2 peer-focus:text-xs peer-focus:text-[#003087]"
                        >
                            Password
                        </label>
                    </div>

                    {error && <p className="text-red-500 text-sm">{error}</p>}

                    <button
                        type="submit"
                        className="mt-1 w-full py-3 bg-[#FFD200] hover:bg-[#e6bd00] text-[#003087] font-bold text-base rounded-lg transition-colors cursor-pointer"
                    >
                        Login
                    </button>
                </form>

                <div className="mt-5 flex flex-col items-center gap-1 text-sm">
                    <Link to="/CreateAccount" className="text-[#003087] underline hover:text-[#002060]">
                        Create an account
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default LogIn;
