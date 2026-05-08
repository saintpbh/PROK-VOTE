'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Loading from '@/components/ui/Loading';
import AuthFlow from '@/components/voter/AuthFlow';
import WaitingRoom from '@/components/voter/WaitingRoom';
import VotingPanel from '@/components/voter/VotingPanel';
import CompletedScreen from '@/components/voter/CompletedScreen';
import api from '@/lib/api';
import socketService from '@/lib/socket';
import { useAuthStore } from '@/store/authStore';
import { useSessionStore } from '@/store/sessionStore';
import toast from 'react-hot-toast';

type VoterState = 'loading' | 'auth' | 'waiting' | 'voting' | 'completed';

export default function VotePage() {
    const params = useParams();
    const tokenId = params.token as string;

    const [state, setState] = useState<VoterState>('loading');
    const [tokenData, setTokenData] = useState<any>(null);
    const [isSocketConnected, setIsSocketConnected] = useState(false);
    const { isAuthenticated, voterId, sessionId } = useAuthStore();
    const { currentAgenda, setCurrentAgenda } = useSessionStore();
    const [theme, setTheme] = useState<string>('classic');
    const socketInitialized = useRef(false);

    const checkVoteStatus = useCallback(async () => {
        if (!voterId || !sessionId) {
            setState('waiting');
            return;
        }

        try {
            const sessionResponse = await api.getSessionAgendas(sessionId);
            const agendas = sessionResponse.agendas || [];

            let activeAgenda = agendas.find((a: any) => a.stage === 'voting');
            console.log('[VotePage] Agendas found:', agendas.length, 'Active voting agenda:', activeAgenda?.title);

            if (!activeAgenda) {
                activeAgenda = agendas.find((a: any) => a.stage === 'submitted');
            }

            if (!activeAgenda) {
                const reversedAgendas = [...agendas].reverse();
                activeAgenda = reversedAgendas.find((a: any) => a.stage === 'announced' || a.stage === 'ended');
            }

            if (activeAgenda) {
                setCurrentAgenda(activeAgenda);

                let hasVoted = false;
                try {
                    const voteResponse = await api.checkVoted(voterId, activeAgenda.id);
                    hasVoted = voteResponse.hasVoted;
                } catch (e) {
                    console.error("Failed to check vote status", e);
                }

                if (activeAgenda.stage === 'voting') {
                    setState(hasVoted ? 'completed' : 'voting');
                } else {
                    setState('waiting');
                }
            } else {
                setCurrentAgenda(null);
                setState('waiting');
            }
        } catch (error) {
            console.error('[VotePage] Failed to check vote status:', error);
            setState('waiting');
        }
    }, [voterId, sessionId, setCurrentAgenda]);

    const validateToken = async () => {
        try {
            const response = await api.getToken(tokenId);

            if (!response.success) {
                toast.error('유효하지 않은 QR 코드입니다');
                return;
            }

            setTokenData(response.token);

            if (response.token.isRevoked) {
                toast.error('이 토큰은 취소되었습니다. 재인증이 필요합니다.');
                setState('auth');
                return;
            }

            const tokenSessionId = response.token.sessionId || response.token.session?.id;

            // Session mismatch: voter has auth from a different session
            if (isAuthenticated && voterId && sessionId && tokenSessionId && sessionId !== tokenSessionId) {
                console.log('[VotePage] Session mismatch: stored=', sessionId, 'token=', tokenSessionId, '→ forcing re-auth');
                useAuthStore.getState().logout();
                setState('auth');
                return;
            }

            if (isAuthenticated && voterId) {
                checkVoteStatus();
            } else {
                setState('auth');
            }
        } catch (error: any) {
            toast.error(error.message || '토큰 확인에 실패했습니다');
            setState('auth');
        }
    };

    useEffect(() => {
        validateToken();
    }, [tokenId]);

    useEffect(() => {
        if (tokenData?.session?.voterTheme) {
            setTheme(tokenData.session.voterTheme);
        }
    }, [tokenData]);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    // ── Socket connection & event listeners ──
    useEffect(() => {
        if (!isAuthenticated || !sessionId) return;
        if (socketInitialized.current) return;
        socketInitialized.current = true;

        const socket = socketService.connect();

        // ── Register ALL event listeners BEFORE joining session ──
        const onConnect = () => {
            console.log(`[VotePage] Socket connected: ${socketService.getSocket()?.id}`);
            setIsSocketConnected(true);
            // Re-join session on reconnect
            socketService.joinSession(sessionId, voterId || undefined, 'voter');
        };

        const onDisconnect = (reason: string) => {
            console.log('[VotePage] Socket disconnected:', reason);
            setIsSocketConnected(false);
        };

        const onStageChanged = ({ agendaId, stage }: { agendaId: string; stage: string }) => {
            console.log(`[VotePage] stage:changed received: ${stage} for ${agendaId}`);

            if (stage === 'voting') {
                toast.success('투표가 시작되었습니다!');
                setState('voting');
                checkVoteStatus();
            } else if (stage === 'submitted') {
                setState('waiting');
                checkVoteStatus();
            } else if (stage === 'ended' || stage === 'announced') {
                setState(prev => prev === 'voting' ? 'completed' : 'waiting');
                checkVoteStatus();
            }
        };

        const onVoteEnded = ({ agendaId }: { agendaId: string }) => {
            console.log(`[VotePage] vote:ended received for ${agendaId}`);
            setState('completed');
        };

        const onVoteConfirmed = ({ vote }: { vote: any }) => {
            console.log('[VotePage] vote:confirmed received');
            setState('completed');
            toast.success('투표가 완료되었습니다!');
        };

        const onAuthRequired = () => {
            console.warn('[VotePage] auth:required received');
            toast.error('재인증이 필요합니다');
            setState('auth');
        };

        const onSettingsUpdate = (settings: any) => {
            console.log('[VotePage] session:settings:update received:', settings);

            // If access code was refreshed, force all voters to re-authenticate
            if (settings.accessCode) {
                console.warn('[VotePage] Access code changed — forcing re-authentication');
                toast('접속 코드가 변경되었습니다.\n새 코드로 다시 인증해주세요.', {
                    icon: '🔒',
                    duration: 5000,
                });
                // Clear auth state
                useAuthStore.getState().logout();
                localStorage.removeItem('auth-storage');
                localStorage.removeItem('access_token');
                // Reset to auth screen
                setState('auth');
                socketInitialized.current = false;
                return;
            }

            setTokenData((prev: any) => {
                if (!prev || !prev.session) return prev;
                return { ...prev, session: { ...prev.session, ...settings } };
            });
            if (settings.voterTheme) {
                setTheme(settings.voterTheme);
            }
        };

        // Register listeners on the raw socket to ensure they fire
        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('stage:changed', onStageChanged);
        socket.on('vote:ended', onVoteEnded);
        socket.on('vote:confirmed', onVoteConfirmed);
        socket.on('auth:required', onAuthRequired);
        socket.on('session:settings:update', onSettingsUpdate);

        // ── Now join the session ──
        if (socket.connected) {
            setIsSocketConnected(true);
            socketService.joinSession(sessionId, voterId || undefined, 'voter');
            // Immediately check status since we're already connected
            checkVoteStatus();
        }

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('stage:changed', onStageChanged);
            socket.off('vote:ended', onVoteEnded);
            socket.off('vote:confirmed', onVoteConfirmed);
            socket.off('auth:required', onAuthRequired);
            socket.off('session:settings:update', onSettingsUpdate);
            socketInitialized.current = false;
        };
    }, [isAuthenticated, sessionId, voterId, checkVoteStatus]);

    const handleAuthSuccess = () => {
        checkVoteStatus();
        toast.success('인증이 완료되었습니다!');
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4 transition-colors duration-500" data-theme={theme}>
            <div className="fixed inset-0 bg-gradient-to-br from-primary/10 via-background to-secondary/10 -z-10" />

            {/* Socket Status Indicator */}
            <div className="fixed top-2 right-2 z-50 flex items-center gap-1.5 px-2 py-0.5 bg-black/20 backdrop-blur-md rounded-full border border-white/10 text-[9px] font-medium">
                <div className={`w-1.5 h-1.5 rounded-full ${isSocketConnected ? 'bg-success animate-pulse' : 'bg-red-500'}`} />
                <span className={isSocketConnected ? 'text-success/80' : 'text-red-500/80'}>
                    {isSocketConnected ? 'Live' : 'Offline'}
                </span>
            </div>

            {state === 'loading' && <Loading fullScreen />}

            {state === 'auth' && (
                <AuthFlow
                    tokenId={tokenId}
                    sessionData={tokenData?.session}
                    onSuccess={handleAuthSuccess}
                />
            )}

            {state === 'waiting' && (
                <WaitingRoom
                    sessionName={tokenData?.session?.name}
                    agendaTitle={currentAgenda?.stage === 'submitted' ? currentAgenda.title : undefined}
                    agendaDescription={currentAgenda?.stage === 'submitted' ? currentAgenda.description : undefined}
                    onStageChange={(stage) => {
                        if (stage === 'voting') {
                            setState('voting');
                        }
                    }}
                />
            )}

            {state === 'voting' && currentAgenda && (
                <VotingPanel
                    agenda={currentAgenda}
                    onVoteComplete={() => setState('completed')}
                />
            )}

            {state === 'completed' && (
                <CompletedScreen />
            )}
        </div>
    );
}
