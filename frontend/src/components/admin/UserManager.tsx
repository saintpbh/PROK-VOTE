'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function UserManager() {
    const [managers, setManagers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    // New Manager Form
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [quotas, setQuotas] = useState({
        maxSessions: 5,
        maxAgendasPerSession: 20,
        maxVotersPerSession: 500
    });

    useEffect(() => {
        fetchManagers();
    }, []);

    const fetchManagers = async () => {
        try {
            const res = await api.getAllManagers();
            setManagers(res.managers || []);
        } catch (error) {
            console.error('Failed to fetch managers:', error);
            toast.error('매니저 목록을 불러오지 못했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true);
        try {
            await api.createManager({
                username: newUsername,
                password: newPassword,
                ...quotas
            });
            toast.success('매니저가 생성되었습니다.');
            setNewUsername('');
            setNewPassword('');
            fetchManagers();
        } catch (error: any) {
            toast.error(error.message || '생성 실패');
        } finally {
            setIsCreating(false);
        }
    };

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        try {
            await api.setUserStatus(id, !currentStatus);
            toast.success('상태가 변경되었습니다.');
            fetchManagers();
        } catch (error) {
            toast.error('상태 변경 실패');
        }
    };

    const handleQuotaUpdate = async (id: string, key: string, value: number) => {
        try {
            await api.updateUserQuotas(id, { [key]: value });
            toast.success('쿼터가 업데이트되었습니다.');
            fetchManagers();
        } catch (error) {
            toast.error('쿼터 업데이트 실패');
        }
    };

    if (isLoading) return <div className="text-center py-12">로딩 중...</div>;

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Create Manager Form */}
            <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    👤 새 투표관리자 등록
                </h2>
                <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <input
                        type="text"
                        placeholder="아이디"
                        className="input text-gray-900 bg-white"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        required
                    />
                    <input
                        type="password"
                        placeholder="비밀번호"
                        className="input text-gray-900 bg-white"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                    />
                    <input
                        type="number"
                        placeholder="세션 수"
                        className="input text-gray-900 bg-white"
                        value={quotas.maxSessions}
                        onChange={(e) => setQuotas({ ...quotas, maxSessions: parseInt(e.target.value) })}
                        required
                    />
                    <input
                        type="number"
                        placeholder="동시인원"
                        className="input text-gray-900 bg-white"
                        value={quotas.maxVotersPerSession}
                        onChange={(e) => setQuotas({ ...quotas, maxVotersPerSession: parseInt(e.target.value) })}
                        required
                    />
                    <button type="submit" disabled={isCreating} className="btn btn-primary">
                        {isCreating ? '생성 중...' : '등록하기'}
                    </button>
                </form>
            </div>

            {/* Manager List */}
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-muted/50 border-b border-border">
                        <tr>
                            <th className="p-4 font-semibold text-sm">아이디</th>
                            <th className="p-4 font-semibold text-sm text-center">상태</th>
                            <th className="p-4 font-semibold text-sm text-center">최대 세션</th>
                            <th className="p-4 font-semibold text-sm text-center">최대 인원</th>
                            <th className="p-4 font-semibold text-sm text-center">최대 안건</th>
                            <th className="p-4 font-semibold text-sm text-right">관리</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {managers.map((manager) => (
                            <tr key={manager.id} className="hover:bg-muted/30 transition-colors">
                                <td className="p-4">
                                    <div className="font-medium">{manager.username}</div>
                                    <div className="text-xs text-muted-foreground">{new Date(manager.createdAt).toLocaleDateString()} 가입</div>
                                </td>
                                <td className="p-4 text-center">
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${manager.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                        }`}>
                                        {manager.isActive ? '활성' : '중지'}
                                    </span>
                                </td>
                                <td className="p-4 text-center">
                                    <input
                                        type="number"
                                        defaultValue={manager.maxSessions}
                                        onBlur={(e) => handleQuotaUpdate(manager.id, 'maxSessions', parseInt(e.target.value))}
                                        className="w-16 p-1 border rounded text-center text-sm text-gray-900 bg-white"
                                    />
                                </td>
                                <td className="p-4 text-center">
                                    <input
                                        type="number"
                                        defaultValue={manager.maxVotersPerSession}
                                        onBlur={(e) => handleQuotaUpdate(manager.id, 'maxVotersPerSession', parseInt(e.target.value))}
                                        className="w-20 p-1 border rounded text-center text-sm text-gray-900 bg-white"
                                    />
                                </td>
                                <td className="p-4 text-center">
                                    <input
                                        type="number"
                                        defaultValue={manager.maxAgendasPerSession}
                                        onBlur={(e) => handleQuotaUpdate(manager.id, 'maxAgendasPerSession', parseInt(e.target.value))}
                                        className="w-16 p-1 border rounded text-center text-sm text-gray-900 bg-white"
                                    />
                                </td>
                                <td className="p-4 text-right">
                                    <button
                                        onClick={() => toggleStatus(manager.id, manager.isActive)}
                                        className={`btn btn-sm ${manager.isActive ? 'btn-outline-danger' : 'btn-outline-success'}`}
                                    >
                                        {manager.isActive ? '중지' : '복구'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {managers.length === 0 && (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                                    등록된 투표관리자가 없습니다.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
