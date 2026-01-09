'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Loading from '@/components/ui/Loading';
import GlobalAuthFlow from '@/components/voter/GlobalAuthFlow';
import api from '@/lib/api';
import socketService from '@/lib/socket';
import toast from 'react-hot-toast';

export default function GlobalJoinPage() {
    const params = useParams();
    const sessionId = params.id as string;
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [sessionData, setSessionData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchSession = async () => {
            try {
                const response = await api.getPublicSession(sessionId);
                if (response.success) {
                    setSessionData(response.session);
                } else {
                    setError(response.message || '세션을 찾을 수 없습니다.');
                }
            } catch (err: any) {
                setError(err.message || '세션 정보를 불러오는데 실패했습니다.');
            } finally {
                setLoading(false);
            }
        };

        if (sessionId) {
            fetchSession();

            // Connect to WebSocket for immediate settings updates
            const socket = socketService.connect();
            socketService.joinSession(sessionId, undefined, 'voter');

            socketService.on('session:settings:update', (settings) => {
                console.log('[GlobalJoinPage] session:settings:update received:', settings);
                setSessionData((prev: any) => {
                    if (!prev) return prev;
                    return { ...prev, ...settings };
                });

                if (settings.voterTheme) {
                    document.documentElement.setAttribute('data-theme', settings.voterTheme);
                }
            });

            return () => {
                socketService.off('session:settings:update');
            };
        }
    }, [sessionId]);

    if (loading) return <Loading fullScreen />;

    if (error) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="text-center space-y-4">
                    <div className="text-6xl">⚠️</div>
                    <h1 className="text-2xl font-bold">오류</h1>
                    <p className="text-muted-foreground">{error}</p>
                    <button
                        onClick={() => router.push('/')}
                        className="btn btn-primary"
                    >
                        홈으로 돌아가기
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4 transition-colors duration-500" data-theme={sessionData?.voterTheme || 'classic'}>
            {/* Ambient Background Gradient */}
            <div className="fixed inset-0 bg-gradient-to-br from-primary/10 via-background to-secondary/10 -z-10" />

            <GlobalAuthFlow
                sessionId={sessionId}
                sessionData={sessionData}
                onSuccess={() => {
                    // Redirect to the regular vote page logic will be handled by auth state
                    // For global users, we might need a slightly different page or handle token vs non-token in /vote/[token]
                    // But actually, we can just redirect to /vote/global?s=[sessionId]
                    router.push(`/vote/session?s=${sessionId}`);
                }}
            />
        </div>
    );
}
