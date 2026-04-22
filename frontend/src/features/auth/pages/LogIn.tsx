import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_BASE } from '@/shared/api/api';

const LogIn: React.FC = () => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const navigate = useNavigate();

    useEffect(() => {
        if (localStorage.getItem('userId')) {
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
                localStorage.setItem("userId", data.user.id.toString());
                localStorage.setItem("email", data.user.email);
                localStorage.setItem("username", data.user.username);
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

                {error && <p className="text-red-500 text-sm mt-4 text-center">{error}</p>}
                {success && <p className="text-green-600 text-sm mt-4 text-center">{success}</p>}
            </div>
        </div>
    );
};

export default LogIn;
