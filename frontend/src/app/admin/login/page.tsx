'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function AdminLoginPage() {
    const [username, setUsername] = useState('admin');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await api.adminLogin({ username, password });
            if (res.success && res.accessToken) {
                api.setAdminToken(res.accessToken);
                if (res.user) {
                    localStorage.setItem('admin_user', JSON.stringify(res.user));
                }
                toast.success('로그인 성공');
                router.push('/admin');
            } else {
                toast.error('로그인 실패: 토큰이 없습니다.');
            }
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || '로그인 실패 Check credentials');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
                <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">Admin Login</h1>
                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-900 bg-white"
                            placeholder="Enter username"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-900 bg-white"
                            placeholder="Enter password"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Logging in...' : 'Login'}
                    </button>
                    <div className="text-center mt-4 space-y-2">
                        <div>
                            <a href="/signup" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                                계정이 없으신가요? 회원가입
                            </a>
                        </div>
                        <div>
                            <a href="/" className="text-sm text-gray-500 hover:text-gray-700">Back to Home</a>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
