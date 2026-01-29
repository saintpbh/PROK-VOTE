'use client';

import { useState, useEffect } from 'react';
import SessionManager from '@/components/admin/SessionManager';
import SystemSettings from '@/components/admin/SystemSettings';
import QRGenerator from '@/components/admin/QRGenerator';
import AgendaList from '@/components/admin/AgendaList';
import StageController from '@/components/admin/StageController';
import { useSessionStore } from '@/store/sessionStore';
import api from '@/lib/api';
import socketService from '@/lib/socket';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import UserManager from '@/components/admin/UserManager';
import AuditLogViewer from '@/components/admin/AuditLogViewer';

export default function AdminPage() {
    const [activeTab, setActiveTab] = useState<'sessions' | 'qr' | 'agendas' | 'control' | 'settings' | 'users' | 'audit'>('sessions');
    const { currentSession, setCurrentSession, currentAgenda } = useSessionStore();
    const [sessions, setSessions] = useState<any[]>([]);
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
                setUser(parsedUser);
                // Set default tab based on role
                if (parsedUser.role === 'SUPER_ADMIN') {
                    setActiveTab('users');
                }
            }

            try {
                const res = await api.getAllSessions();
                setSessions(res.sessions || []);
            } catch (error: any) {
                console.error('Initial session fetch failed:', error);
                if (error.status === 401) {
                    toast.error('세션이 만료되었습니다. 다시 로그인해주세요.');
                    api.removeToken();
                    localStorage.removeItem('admin_user');
                    router.replace('/admin/login');
                }
            }
        };
        checkAuth();
    }, [currentSession, router]); // simplified deps to avoid loop with activeTab

    const renderSessionSelector = (targetTab: string) => (
        <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-bold mb-4 text-center">세션을 선택해주세요</h2>
            <div className="grid gap-4">
                {sessions.map((session) => (
                    <div
                        key={session.id}
                        onClick={() => setCurrentSession(session)}
                        className="p-4 bg-card rounded-lg border border-border cursor-pointer hover:border-primary transition-all hover:shadow-md"
                    >
                        <div className="flex justify-between items-center">
                            <span className="font-semibold">{session.name}</span>
                            <span className="text-sm text-muted-foreground">{session.accessCode}</span>
                        </div>
                    </div>
                ))}
                {sessions.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                        생성된 세션이 없습니다. 세션 관리에서 먼저 세션을 생성해주세요.
                        <div className="mt-4">
                            <button
                                onClick={() => setActiveTab('sessions')}
                                className="btn btn-primary"
                            >
                                세션 관리로 이동
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    const tabs = [
        { id: 'users', label: '사용자 관리', icon: '👥', roles: ['SUPER_ADMIN'] },
        { id: 'settings', label: '시스템 설정', icon: '⚙️', roles: ['SUPER_ADMIN'] },
        { id: 'audit', label: '오딧 로그', icon: '⚖️', roles: ['SUPER_ADMIN'] },
        { id: 'sessions', label: '세션 관리', icon: '🏢', roles: ['SUPER_ADMIN', 'VOTE_MANAGER'] },
        { id: 'qr', label: 'QR 생성', icon: '📱', roles: ['SUPER_ADMIN', 'VOTE_MANAGER'] },
        { id: 'agendas', label: '안건 관리', icon: '📋', roles: ['SUPER_ADMIN', 'VOTE_MANAGER'] },
        { id: 'control', label: '투표 제어', icon: '🎮', roles: ['SUPER_ADMIN', 'VOTE_MANAGER'] },
    ].filter(tab => !tab.roles || (user && tab.roles.includes(user.role)));

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
                            PROK Vote 관리자
                        </h1>
                        <p className="text-muted-foreground flex items-center gap-2">
                            {user?.role === 'SUPER_ADMIN' ? '👑 수퍼 관리자' : '👤 투표 관리자'}: {user?.username}
                        </p>
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-100"
                        >
                            로그아웃
                        </button>
                        {currentSession && (
                            <button
                                onClick={async () => {
                                    if (window.confirm('전광판을 정말 리셋하시겠습니까?')) {
                                        try {
                                            socketService.connect();
                                            socketService.emit('stadium:control', { sessionId: currentSession.id, action: 'reset' });
                                            toast.success('전광판이 리셋되었습니다');
                                        } catch (e) {
                                            toast.error('전광판 리셋 실패');
                                        }
                                    }
                                }}
                                className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                            >
                                🔄 전광판 리셋
                            </button>
                        )}
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
                            <span className="mr-2">{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="animate-slide-in-bottom">
                    {activeTab === 'sessions' && <SessionManager />}

                    {activeTab === 'qr' && (
                        <div>
                            {currentSession ? (
                                <QRGenerator sessionId={currentSession.id} />
                            ) : renderSessionSelector('qr')}
                        </div>
                    )}

                    {activeTab === 'agendas' && (
                        <div>
                            {currentSession ? (
                                <AgendaList
                                    sessionId={currentSession.id}
                                    onAgendaSelect={() => setActiveTab('control')}
                                />
                            ) : renderSessionSelector('agendas')}
                        </div>
                    )}

                    {activeTab === 'control' && (
                        <div>
                            {currentAgenda && currentSession ? (
                                <div className="space-y-6">
                                    <div className="card">
                                        <h2 className="text-xl font-bold mb-2">
                                            {currentAgenda.title}
                                        </h2>
                                        {currentAgenda.description && (
                                            <p className="text-muted-foreground">
                                                {currentAgenda.description}
                                            </p>
                                        )}
                                    </div>

                                    <StageController
                                        agendaId={currentAgenda.id}
                                        sessionId={currentSession.id}
                                        currentStage={currentAgenda.stage}
                                        onStageChange={(newStage) => {
                                            useSessionStore.getState().updateAgendaStage(
                                                currentAgenda.id,
                                                newStage as any
                                            );
                                        }}
                                        onClose={() => {
                                            // Handle closing agenda control and moving to next agenda
                                            const { agendas, setCurrentAgenda } = useSessionStore.getState();
                                            const currentIndex = agendas.findIndex(a => a.id === currentAgenda.id);

                                            // Find next agenda (if exists)
                                            if (currentIndex !== -1 && currentIndex < agendas.length - 1) {
                                                const nextAgenda = agendas[currentIndex + 1];
                                                setCurrentAgenda(nextAgenda);
                                                // Stay in control tab, but now it's the next agenda
                                            } else {
                                                // If no next agenda, maybe go back to list, or just stay? 
                                                // User requested: "if no next agenda, current agenda"
                                                // But also "Voting control window closes"
                                                // If we interpret "closes" as "go to agenda list", then:
                                                setActiveTab('agendas');
                                            }
                                        }}
                                    />
                                </div>
                            ) : (
                                <div className="card text-center py-12">
                                    <div className="text-muted-foreground mb-4">
                                        {!currentSession
                                            ? renderSessionSelector('control')
                                            : '제어할 안건을 선택해주세요'}
                                    </div>
                                    {currentSession && (
                                        <button
                                            onClick={() => setActiveTab('agendas')}
                                            className="btn btn-primary"
                                        >
                                            안건 관리로 이동
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    {activeTab === 'settings' && <SystemSettings />}
                    {activeTab === 'users' && <UserManager />}
                    {activeTab === 'audit' && <AuditLogViewer />}
                </div>
            </div >
        </div >
    );
}
