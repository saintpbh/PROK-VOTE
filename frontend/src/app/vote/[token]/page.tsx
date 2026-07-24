'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Loading from '@/components/ui/Loading';
import AuthFlow from '@/components/voter/AuthFlow';
import WaitingRoom from '@/components/voter/WaitingRoom';
import VotingPanel from '@/components/voter/VotingPanel';
import CompletedScreen from '@/components/voter/CompletedScreen';
import ResultPanel from '@/components/voter/ResultPanel';
import api from '@/lib/api';
import socketService from '@/lib/socket';
import haptic from '@/lib/haptic';
import { useAuthStore } from '@/store/authStore';
import { useSessionStore } from '@/store/sessionStore';
import toast from 'react-hot-toast';

type VoterState = 'loading' | 'auth' | 'waiting' | 'voting' | 'completed' | 'results';

const LOADING_MESSAGES = [
    { text: '투표권을 확인하고 있습니다...', icon: '🔍' },
    { text: '보안 환경을 점검하고 있습니다...', icon: '🔒' },
    { text: '투표 시스템에 안전하게 연결 중입니다...', icon: '🛡️' },
    { text: '참여 자격을 확인하고 있습니다...', icon: '✅' },
    { text: '투표 환경을 준비하고 있습니다...', icon: '⚡' },
];

function LoadingMessages() {
    const [msgIndex, setMsgIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setMsgIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
        }, 2200);
        return () => clearInterval(interval);
    }, []);

    const msg = LOADING_MESSAGES[msgIndex];

    return (
        <div className="text-center animate-fade-in" key={msgIndex}>
            <div className="text-2xl mb-2">{msg.icon}</div>
            <p className="text-base font-medium text-white/80">{msg.text}</p>
            <p className="text-xs text-muted-foreground mt-2">잠시만 기다려 주세요</p>
        </div>
    );
}

export default function VotePage() {
    const params = useParams();
    const tokenId = params.token as string;

    const [state, setState] = useState<VoterState>('loading');
    const [tokenData, setTokenData] = useState<any>(null);
    const [isSocketConnected, setIsSocketConnected] = useState(false);
    const [isTabBlocked, setIsTabBlocked] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { isAuthenticated, voterId, sessionId } = useAuthStore();
    const { currentAgenda, setCurrentAgenda } = useSessionStore();
    const [theme, setTheme] = useState<string>('classic');
    const socketInitialized = useRef(false);
    const [isTokenValidated, setIsTokenValidated] = useState(false);
    
    // Unique tabId to avoid self-blocking in BroadcastChannel loops
    const tabId = useRef(typeof window !== 'undefined' ? Math.random().toString(36).substring(2) + Date.now().toString(36) : 'ssr');

    // Multi-tab prevention: block duplicate tabs for the same QR token
    // BroadcastChannel is not supported on iOS < 15.4 — guard with typeof check
    useEffect(() => {
        if (!tokenId) return;
        if (typeof BroadcastChannel === 'undefined') return; // iOS 15.3 이하 skip

        const channel = new BroadcastChannel(`prok-vote-${tokenId}`);
        // Announce this tab is active
        channel.postMessage({ type: 'TAB_CHECK', senderId: tabId.current });

        channel.onmessage = (e) => {
            // Ignore messages from ourselves to prevent self-collisions or loop-backs
            if (e.data?.senderId === tabId.current) return;

            if (e.data?.type === 'TAB_CHECK') {
                // Another tab is checking — tell it we exist
                channel.postMessage({ type: 'TAB_EXISTS', senderId: tabId.current });
            }
            if (e.data?.type === 'TAB_EXISTS') {
                // This tab is the duplicate — block it
                setIsTabBlocked(true);
                toast.error('다른 탭에서 이미 투표 화면이 열려 있습니다.', { duration: 10000 });
            }
        };

        return () => channel.close();
    }, [tokenId]);


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
                // On refresh, if there is no active voting/submitted agenda, remain in waiting room.
                // Do NOT automatically force pop up old announced results on page refresh.
                const reversedAgendas = [...agendas].reverse();
                const lastAgenda = reversedAgendas.find((a: any) => a.stage === 'announced' || a.stage === 'ended');
                if (lastAgenda) {
                    setCurrentAgenda(lastAgenda);
                } else {
                    setCurrentAgenda(null);
                }
                setState('waiting');
            }
        } catch (error: any) {
            console.error('[VotePage] Failed to check vote status:', error);
            // If the server rejected our token (401), clear stale auth and force re-login
            if (error?.status === 401) {
                console.warn('[VotePage] Token expired — clearing auth and forcing re-login');
                useAuthStore.getState().logout();
                localStorage.removeItem('auth-storage');
                localStorage.removeItem('access_token');
                socketInitialized.current = false;
                setState('auth');
                return;
            }
            setState('waiting');
        }
    }, [voterId, sessionId, setCurrentAgenda]);

    const validateToken = async () => {
        try {
            setError(null);
            const response = await api.getToken(tokenId);

            if (!response.success) {
                setError(response.message || '유효하지 않은 QR 코드입니다');
                toast.error(response.message || '유효하지 않은 QR 코드입니다');
                setState('auth');
                return;
            }

            let fetchedToken = response.token;
            const tokenSessionId = fetchedToken.sessionId || fetchedToken.session?.id;

            // Ensure session name is loaded by fetching public session if missing
            if (tokenSessionId && (!fetchedToken.session || !fetchedToken.session.name)) {
                try {
                    const pubSessionResp = await api.getPublicSession(tokenSessionId);
                    if (pubSessionResp.success && pubSessionResp.session) {
                        fetchedToken = {
                            ...fetchedToken,
                            session: {
                                ...(fetchedToken.session || {}),
                                ...pubSessionResp.session,
                            },
                        };
                    }
                } catch (e) {
                    console.error('[VotePage] Failed to fetch public session details:', e);
                }
            }

            setTokenData(fetchedToken);

            if (fetchedToken.isRevoked) {
                setError('이 토큰은 취소되었습니다. 재인증이 필요합니다.');
                toast.error('이 토큰은 취소되었습니다. 재인증이 필요합니다.');
                setState('auth');
                return;
            }

            // Session mismatch: voter has auth from a different session
            if (isAuthenticated && voterId && sessionId && tokenSessionId && sessionId !== tokenSessionId) {
                console.log('[VotePage] Session mismatch: stored=', sessionId, 'token=', tokenSessionId, '→ forcing re-auth');
                // Clear ALL stale auth data
                useAuthStore.getState().logout();
                localStorage.removeItem('auth-storage');
                localStorage.removeItem('access_token');
                // Disconnect stale socket and reset initialization flag
                socketService.disconnect();
                socketInitialized.current = false;
                setIsSocketConnected(false);
                setState('auth');
                return;
            }

            if (isAuthenticated && voterId) {
                setIsTokenValidated(true);
                checkVoteStatus();
            } else {
                setIsTokenValidated(true); // Still marked as validated so the flow can continue (e.g. showing login page)
                setState('auth');
            }
        } catch (error: any) {
            setIsTokenValidated(false);
            setError(error.message || '토큰 확인에 실패했습니다');
            toast.error(error.message || '토큰 확인에 실패했습니다');
            setState('auth');
        }
    };

    useEffect(() => {
        setIsTokenValidated(false);
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
        if (!isTokenValidated || !isAuthenticated || !sessionId) return;
        if (socketInitialized.current) return;
        socketInitialized.current = true;

        const socket = socketService.connect(true);

        // ── Register ALL event listeners BEFORE joining session ──
        const onConnect = () => {
            console.log(`[VotePage] Socket connected: ${socketService.getSocket()?.id}`);
            setIsSocketConnected(true);
            // Re-join session on reconnect
            socketService.joinSession(sessionId, voterId || undefined, 'voter');
            // Sync state on reconnect — catches missed events while socket was down
            checkVoteStatus();
        };

        const onDisconnect = (reason: string) => {
            console.log('[VotePage] Socket disconnected:', reason);
            setIsSocketConnected(false);
        };

        const onStageChanged = ({ agendaId, stage }: { agendaId: string; stage: string }) => {
            console.log(`[VotePage] stage:changed received: ${stage} for ${agendaId}`);

            if (stage === 'voting') {
                try { haptic('voteStart'); } catch(e) {}
                toast.success('투표가 시작되었습니다!');
                checkVoteStatus();
            } else if (stage === 'submitted') {
                try { haptic('press'); } catch(e) {}
                toast('새 안건이 상정되었습니다', { icon: '📋' });
                checkVoteStatus();
            } else if (stage === 'ended') {
                try { haptic('voteEnd'); } catch(e) {}
                toast('투표가 종료되었습니다', { icon: '🔒' });
                setState('completed');
            } else if (stage === 'announced') {
                try { haptic('success'); } catch(e) {}
                toast('결과가 발표되었습니다', { icon: '📊' });
                setState('results');
            }
        };

        const onVoteEnded = ({ agendaId }: { agendaId: string }) => {
            console.log(`[VotePage] vote:ended received for ${agendaId}`);
            haptic('voteEnd');
            setState('completed');
        };

        const onVoteConfirmed = ({ vote }: { vote: any }) => {
            console.log('[VotePage] vote:confirmed received');
            haptic('confirm');
            setState('completed');
            toast.success('투표가 완료되었습니다!');
        };

        const onAuthRequired = () => {
            console.warn('[VotePage] auth:required received — clearing stale auth and forcing re-login');
            // Clear all stale auth data
            useAuthStore.getState().logout();
            localStorage.removeItem('auth-storage');
            localStorage.removeItem('access_token');
            // Physically disconnect the socket to clean up invalid connections
            socketService.disconnect();
            socketInitialized.current = false;
            setIsSocketConnected(false);
            toast.error('인증이 만료되었습니다. 다시 인증해주세요.');
            setState('auth');
        };

        const onSettingsUpdate = (settings: any) => {
            console.log('[VotePage] session:settings:update received:', settings);

            // If access code was refreshed, force all voters to re-authenticate
            if (settings.accessCode) {
                console.warn('[VotePage] Access code changed — forcing re-authentication');
                haptic('warning');
                toast('참여 코드가 변경되었습니다.\n새 코드로 다시 인증해주세요.', {
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
    }, [isTokenValidated, isAuthenticated, sessionId, voterId, checkVoteStatus]);

    // ── Page Visibility: sync state when screen wakes up from lock ──
    useEffect(() => {
        if (!isAuthenticated || !sessionId) return;

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                console.log('[VotePage] Screen unlocked — syncing vote state');
                // Ensure socket is connected; reconnect if dropped during sleep
                const socket = socketService.getSocket();
                if (!socket?.connected) {
                    socketService.connect();
                    socketService.joinSession(sessionId, voterId || undefined, 'voter');
                }
                // Fetch current agenda state via HTTP — catches missed WebSocket events
                checkVoteStatus();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [isAuthenticated, sessionId, voterId, checkVoteStatus]);

    const handleAuthSuccess = () => {
        checkVoteStatus();
        toast.success('인증이 완료되었습니다!');
    };

    return (
        <div className="min-h-[100dvh] w-full bg-background text-foreground flex flex-col items-center justify-start sm:justify-center p-4 pt-6 pb-40 overflow-y-auto transition-colors duration-500" data-theme={theme}>
            <div className="fixed inset-0 bg-gradient-to-br from-primary/10 via-background to-secondary/10 -z-10" />

            {/* Socket Status Indicator */}
            <div className="fixed top-2 right-2 z-50 flex items-center gap-1.5 px-2 py-0.5 bg-black/20 backdrop-blur-md rounded-full border border-white/10 text-[9px] font-medium">
                <div className={`w-1.5 h-1.5 rounded-full ${isSocketConnected ? 'bg-success animate-pulse' : 'bg-red-500'}`} />
                <span className={isSocketConnected ? 'text-success/80' : 'text-red-500/80'}>
                    {isSocketConnected ? 'Live' : 'Offline'}
                </span>
            </div>

            {/* Error Screen */}
            {error && (
                <div className="fixed inset-0 bg-background flex flex-col items-center justify-center z-[90] p-8">
                    <div className="fixed inset-0 bg-gradient-to-br from-primary/10 via-background to-secondary/10 -z-10" />
                    <div className="text-center space-y-6 max-w-sm w-full p-8 bg-black/20 backdrop-blur-md rounded-2xl border border-white/10">
                        <div className="text-6xl animate-bounce">⚠️</div>
                        <h1 className="text-2xl font-black text-white">QR 코드 오류</h1>
                        <p className="text-muted-foreground text-sm leading-relaxed">{error}</p>
                        <button
                            onClick={() => window.location.href = '/'}
                            className="w-full py-3 px-4 rounded-xl bg-primary hover:bg-primary/80 text-white font-bold transition-all"
                        >
                            홈으로 돌아가기
                        </button>
                    </div>
                </div>
            )}

            {/* Blocked Tab Screen */}
            {isTabBlocked && (
                <div className="fixed inset-0 bg-background flex flex-col items-center justify-center z-[100] p-8">
                    <div className="text-6xl mb-6">🚫</div>
                    <h2 className="text-xl font-bold text-white mb-3">중복 탭 감지</h2>
                    <p className="text-muted-foreground text-center text-sm leading-relaxed">
                        다른 탭에서 이미 투표 화면이 열려 있습니다.<br />
                        이 탭을 닫아주세요.
                    </p>
                </div>
            )}

            {state === 'loading' && (
                <div className="fixed inset-0 bg-background flex flex-col items-center justify-center z-50 p-8">
                    <div className="fixed inset-0 bg-gradient-to-br from-primary/10 via-background to-secondary/10 -z-10" />
                    
                    {/* Logo / Title */}
                    <div className="mb-8 text-center">
                        <div className="text-4xl font-black tracking-tight text-white mb-2">PROK VOTE</div>
                        <div className="text-sm text-muted-foreground">안전한 전자투표 시스템</div>
                    </div>

                    {/* Animated Shield Icon */}
                    <div className="relative mb-10">
                        <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse" />
                        <svg className="relative w-20 h-20 text-primary animate-bounce" style={{ animationDuration: '2s' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full max-w-xs mb-6">
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-primary to-accent rounded-full animate-progress" 
                                style={{ animation: 'progress 3s ease-in-out infinite' }} />
                        </div>
                    </div>

                    {/* Rotating Messages */}
                    <LoadingMessages />

                    <style jsx>{`
                        @keyframes progress {
                            0% { width: 0%; }
                            50% { width: 80%; }
                            100% { width: 100%; }
                        }
                    `}</style>
                </div>
            )}

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
                <CompletedScreen stage={currentAgenda?.stage} />
            )}

            {state === 'results' && currentAgenda && (
                <ResultPanel
                    agendaId={currentAgenda.id}
                    agendaTitle={currentAgenda.title}
                    onClose={() => setState('waiting')}
                />
            )}
        </div>
    );
}
