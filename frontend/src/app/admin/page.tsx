'use client';

import { useState, useEffect } from 'react';
import SystemSettings from '@/components/admin/SystemSettings';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import UserManager from '@/components/admin/UserManager';
import AuditLogViewer from '@/components/admin/AuditLogViewer';

export default function AdminPage() {
    const [activeTab, setActiveTab] = useState<'users' | 'settings' | 'audit'>('users');
    const [user, setUser] = useState<any>(null);

    const router = useRouter();

    useEffect(() => {
        const checkAuth = async () => {
            if (!api.isAdminAuthenticated()) {
                router.replace('/admin/login');
                return;
            }

            const storedUser = localStorage.getItem('admin_user');
            if (storedUser) {
                const parsedUser = JSON.parse(storedUser);
                // Only allow SUPER_ADMIN role on this page
                if (parsedUser.role !== 'SUPER_ADMIN') {
                    toast.error('최고관리자 계정으로만 접근할 수 있습니다.');
                    router.replace('/moderator');
                    return;
                }
                setUser(parsedUser);
            }
        };
        checkAuth();
    }, [router]);

    const tabs = [
        { id: 'users', label: '사용자 관리' },
        { id: 'settings', label: '시스템 설정' },
        { id: 'audit', label: '감사 로그' },
    ];

    const handleLogout = () => {
        api.removeToken();
        localStorage.removeItem('admin_user');
        router.push('/admin/login');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary/10 to-secondary/10">
            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                            PROK Vote 최고관리자
                        </h1>
                        <p className="text-muted-foreground">
                            최고 관리자: {user?.username}
                        </p>
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-100"
                        >
                            로그아웃
                        </button>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex gap-2 mb-6 overflow-x-auto">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`px-6 py-3 rounded-lg font-semibold whitespace-nowrap transition-all ${activeTab === tab.id
                                ? 'bg-primary text-white shadow-lg scale-105'
                                : 'bg-card text-foreground hover:bg-muted/50'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="animate-slide-in-bottom">
                    {activeTab === 'users' && <UserManager />}
                    {activeTab === 'settings' && <SystemSettings />}
                    {activeTab === 'audit' && <AuditLogViewer />}
                </div>
            </div>
        </div>
    );
}
