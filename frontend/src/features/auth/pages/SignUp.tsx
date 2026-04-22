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
        <div className="min-h-screen bg-[#F5F5F5] flex flex-col items-center justify-center p-6">
            <div className="mb-[60px]">
                <h1 className="text-6xl font-extrabold text-[#003087] tracking-tight">
                    Petr Collect
                </h1>
            </div>

            <div className="bg-white w-full max-w-[440px] rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.08)] p-12">
                <h2 className="text-2xl font-semibold text-gray-800 text-center mb-8">
                    Create your account
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
                            id="email"
                            type="text"
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

                    <div className="relative">
                        <input
                            id="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            placeholder=" "
                            className="peer w-full h-[52px] px-4 pt-5 pb-2 rounded border border-gray-300 focus:outline-none focus:border-[#003087] text-sm transition-all"
                        />
                        <label
                            htmlFor="confirmPassword"
                            className="absolute left-4 top-2 text-xs text-gray-500 transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-placeholder-shown:text-gray-400 peer-focus:top-2 peer-focus:text-xs peer-focus:text-[#003087]"
                        >
                            Confirm Password
                        </label>
                    </div>

                    <div className="flex justify-end items-center text-sm px-1">
                        <Link to="/Login" className="text-[#003087] hover:underline">Already have an account? Log in</Link>
                    </div>

                    <button
                        type="submit"
                        className="h-[52px] w-full bg-[#FFD200] hover:bg-[#e6bd00] text-[#003087] font-bold text-base rounded transition-colors cursor-pointer mt-2"
                    >
                        CREATE ACCOUNT
                    </button>
                </form>

                {error && <p className="text-red-500 text-sm mt-4 text-center">{error}</p>}
                {success && <p className="text-green-600 text-sm mt-4 text-center">{success}</p>}
            </div>
        </div>
    );
};

export default SignUp;
