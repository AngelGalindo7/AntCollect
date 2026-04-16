import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_BASE } from '@/shared/api/api';

const SignUp: React.FC = () => {
    const navigate = useNavigate();
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (!isEmail.test(email)) {
            setError("Please enter a valid email address.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/users/create-user`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                const detail = data.detail;
                if (Array.isArray(detail)) {
                    setError(detail.map((e: { msg: string }) => e.msg).join(" · "));
                } else {
                    setError(detail || "Something went wrong.");
                }
                return;
            }

            setSuccess(data.msg || "Account created successfully!");
            setTimeout(() => navigate('/Login'), 1500);
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
                    Create your account
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
                            id="email"
                            type="text"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder=" "
                            className="peer w-full px-3 pt-5 pb-2 rounded-lg border border-gray-300 focus:outline-none focus:border-[#003087] text-sm bg-white"
                        />
                        <label
                            htmlFor="email"
                            className="absolute left-3 top-2 text-xs text-gray-500 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-gray-400 peer-focus:top-2 peer-focus:text-xs peer-focus:text-[#003087]"
                        >
                            Email
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

                    <div className="relative">
                        <input
                            id="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            placeholder=" "
                            className="peer w-full px-3 pt-5 pb-2 rounded-lg border border-gray-300 focus:outline-none focus:border-[#003087] text-sm bg-white"
                        />
                        <label
                            htmlFor="confirmPassword"
                            className="absolute left-3 top-2 text-xs text-gray-500 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-gray-400 peer-focus:top-2 peer-focus:text-xs peer-focus:text-[#003087]"
                        >
                            Confirm Password
                        </label>
                    </div>

                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    {success && <p className="text-green-600 text-sm">{success}</p>}

                    <button
                        type="submit"
                        className="mt-1 w-full py-3 bg-[#FFD200] hover:bg-[#e6bd00] text-[#003087] font-bold text-base rounded-lg transition-colors cursor-pointer"
                    >
                        Create Account
                    </button>
                </form>

                <div className="mt-5 flex flex-col items-center gap-1 text-sm">
                    <Link to="/Login" className="text-[#003087] underline hover:text-[#002060]">
                        Already have an account? Log in
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default SignUp;
