'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function SignupPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (password !== confirmPassword) {
            toast.error('비밀번호가 일치하지 않습니다.');
            return;
        }

        if (password.length < 6) {
            toast.error('비밀번호는 최소 6자 이상이어야 합니다.');
            return;
        }

        if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
            toast.error('아이디는 3-20자의 영문, 숫자, 언더스코어만 가능합니다.');
            return;
        }

        setLoading(true);
        try {
            const res = await api.register({
                username,
                password,
                email: email || undefined
            });

            if (res.success) {
                toast.success('회원가입이 완료되었습니다! 로그인해 주세요.');
                router.push('/admin/login');
            } else {
                toast.error(res.message || '회원가입 실패');
            }
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || '회원가입 실패');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
            <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
                <h1 className="text-2xl font-bold mb-2 text-center text-gray-800">PROK Vote</h1>
                <p className="text-center text-gray-600 mb-6">투표 관리자 회원가입</p>

                <form onSubmit={handleSignup} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            아이디 <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-900 bg-white"
                            placeholder="영문, 숫자, 언더스코어 (3-20자)"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            이메일 (선택)
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-900 bg-white"
                            placeholder="example@email.com"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            비밀번호 <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-900 bg-white"
                            placeholder="최소 6자 이상"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            비밀번호 확인 <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-900 bg-white"
                            placeholder="비밀번호 재입력"
                            required
                        />
                    </div>

                    <div className="bg-blue-50 p-3 rounded border border-blue-200">
                        <p className="text-xs text-blue-800">
                            <strong>무료 플랜:</strong> 세션 5개, 동시 인원 500명, 안건 20개
                        </p>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                        {loading ? '가입 중...' : '회원가입'}
                    </button>

                    <div className="text-center mt-4">
                        <a href="/admin/login" className="text-sm text-blue-600 hover:text-blue-800">
                            이미 계정이 있으신가요? 로그인
                        </a>
                    </div>

                    <div className="text-center">
                        <a href="/" className="text-sm text-gray-500 hover:text-gray-700">
                            홈으로 돌아가기
                        </a>
                    </div>
                </form>
            </div>
        </div>
    );
}
