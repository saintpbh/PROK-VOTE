'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function ModeratorLoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        if (api.isAdminAuthenticated()) {
            const storedUser = localStorage.getItem('admin_user');
            if (storedUser) {
                const parsedUser = JSON.parse(storedUser);
                if (parsedUser.role === 'VOTE_MANAGER') {
                    router.replace('/moderator');
                }
            }
        }
    }, [router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await api.adminLogin({ username, password });
            if (res.success && res.accessToken) {
                // Only allow VOTE_MANAGER role
                if (res.user?.role !== 'VOTE_MANAGER') {
                    toast.error('투표관리자 계정으로만 로그인할 수 있습니다.');
                    setLoading(false);
                    return;
                }
                api.setAdminToken(res.accessToken);
                localStorage.setItem('admin_user', JSON.stringify(res.user));
                toast.success('로그인 성공');
                router.push('/moderator');
            } else {
                toast.error('로그인 실패: 인증 정보를 확인해주세요.');
            }
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || '로그인 실패');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            <div className="w-full max-w-md p-8">
                {/* Logo / Title */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">PROK Vote</h1>
                    <p className="text-slate-400 text-sm">투표관리자 로그인</p>
                </div>

                {/* Login Card */}
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 shadow-2xl">
                    <form onSubmit={handleLogin} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                아이디
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                                placeholder="투표관리자 아이디"
                                required
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                비밀번호
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                                placeholder="비밀번호"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50 shadow-lg shadow-purple-500/25"
                        >
                            {loading ? '로그인 중...' : '로그인'}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-xs text-slate-500">
                            계정이 없으신가요? 최고관리자에게 문의하세요.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
