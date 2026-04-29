import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '@/shared/api/api';

const AuthComplete: React.FC = () => {
    const navigate = useNavigate();

    useEffect(() => {
        fetch(`${API_BASE}/users/me`, { credentials: 'include' })
            .then(r => {
                if (!r.ok) throw new Error('auth failed');
                return r.json();
            })
            .then(user => {
                localStorage.setItem('userId', String(user.id));
                localStorage.setItem('username', user.username);
                localStorage.setItem('email', user.email);
                window.dispatchEvent(new Event('auth:login'));
                navigate(`/${user.username}`, { replace: true });
            })
            .catch(() => navigate('/Login', { replace: true }));
    }, [navigate]);

    return (
        <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center">
            <p className="text-gray-500 text-sm">Signing you in...</p>
        </div>
    );
};

export default AuthComplete;
