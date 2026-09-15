'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Loading from '@/components/ui/Loading';
import AuthFlow from '@/components/voter/AuthFlow';
import WaitingRoom from '@/components/voter/WaitingRoom';
import VotingPanel from '@/components/voter/VotingPanel';
import CompletedScreen from '@/components/voter/CompletedScreen';
import ResultPanel from '@/components/voter/ResultPanel';
import ReauthModal from '@/components/voter/ReauthModal';
import api from '@/lib/api';
// socketService no longer used by voter page (HTTP short-polling instead)
// Socket.IO still used by admin/stadium pages
import haptic from '@/lib/haptic';
import { useAuthStore } from '@/store/authStore';
import { useSessionStore } from '@/store/sessionStore';
import toast from 'react-hot-toast';

type VoterState = 'loading' | 'auth' | 'waiting' | 'voting' | 'completed' | 'results' | 'reauth';

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

                // ── LOCAL-FIRST vote check: prevents state rollback on reconnect ──
                // If user voted locally (optimistic UI saved flag), trust it over server
                const localVoted = localStorage.getItem(`voted_${activeAgenda.id}`);
                if (localVoted) {
                    console.log('[VotePage] Local vote flag found — staying in completed state');
                    if (activeAgenda.stage === 'voting') {
                        setState('completed');
                    } else {
                        setState('waiting');
                    }
                    return;
                }

                let hasVoted = false;
                try {
                    const voteResponse = await api.checkVoted(voterId, activeAgenda.id);
                    hasVoted = voteResponse.hasVoted;
                } catch (e) {
                    console.error("Failed to check vote status", e);
                    // On network error, check if we're already in completed state
                    // If so, don't reset — preserve current state
                    return;
                }

                if (activeAgenda.stage === 'voting') {
                    if (hasVoted) {
                        // Also save to localStorage for future reconnects
                        localStorage.setItem(`voted_${activeAgenda.id}`, 'true');
                        setState('completed');
                    } else {
                        setState('voting');
                    }
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
                setState('auth');
                return;
            }
            // On any other error, don't change state — preserve current state
        }
    }, [voterId, sessionId, setCurrentAgenda]);

    /** Remove pending votes for an agenda when voting ends — stops unnecessary retries */
    const clearPendingVotesForAgenda = (agendaId: string) => {
        try {
            const pending = JSON.parse(localStorage.getItem('pending_votes') || '[]');
            const filtered = pending.filter((p: any) => p.agendaId !== agendaId);
            localStorage.setItem('pending_votes', JSON.stringify(filtered));
            if (pending.length !== filtered.length) {
                console.log(`[VotePage] Cleared pending votes for ended agenda: ${agendaId}`);
            }
        } catch(e) {}
    };

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

    // ── HTTP Short-Polling: replaces Socket.IO for 2000 voter scalability ──
    // Socket.IO long-polling holds 1 GET per client → 2000 concurrent → exceeds Cloud Run limit (1000).
    // HTTP short-polling: 2000 users × 1 req/3s × 50ms each = ~33 concurrent → 97% headroom.
    const previousStageRef = useRef<string | null>(null);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!isTokenValidated || !isAuthenticated || !sessionId) return;

        const API_URL = process.env.NEXT_PUBLIC_API_URL || 
            `${window.location.protocol}//${window.location.hostname}:3001`;

        const retryPendingVotes = async () => {
            try {
                const pending = JSON.parse(localStorage.getItem('pending_votes') || '[]');
                if (pending.length === 0) return;

                console.log(`[VotePage] Retrying ${pending.length} pending votes...`);
                const token = localStorage.getItem('access_token');
                const FIVE_MINUTES = 5 * 60 * 1000;

                for (const vote of pending) {
                    if (vote.timestamp && (Date.now() - vote.timestamp > FIVE_MINUTES)) {
                        console.log(`[VotePage] Expired pending vote (>5min): ${vote.agendaId}`);
                        const remaining = JSON.parse(localStorage.getItem('pending_votes') || '[]');
                        const filtered = remaining.filter((p: any) => 
                            !(p.agendaId === vote.agendaId && p.voterId === vote.voterId)
                        );
                        localStorage.setItem('pending_votes', JSON.stringify(filtered));
                        continue;
                    }
                    try {
                        const res = await fetch(`${API_URL}/votes`, {
                            method: 'POST',
                            headers: { 
                                'Content-Type': 'application/json',
                                ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                            },
                            body: JSON.stringify(vote),
                        });
                        if (res.ok || res.status === 400) {
                            const remaining = JSON.parse(localStorage.getItem('pending_votes') || '[]');
                            const filtered = remaining.filter((p: any) => 
                                !(p.agendaId === vote.agendaId && p.voterId === vote.voterId)
                            );
                            localStorage.setItem('pending_votes', JSON.stringify(filtered));
                            console.log(`[VotePage] ✅ Pending vote submitted: ${vote.agendaId}`);
                        }
                    } catch(e) { /* will retry next poll */ }
                }
            } catch(e) {}
        };

        const pollVoterState = async () => {
            try {
                const token = localStorage.getItem('access_token');
                const res = await fetch(
                    `${API_URL}/sessions/${sessionId}/voter-state?voterId=${voterId || ''}`,
                    {
                        signal: AbortSignal.timeout(8000),
                        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                    }
                );
                if (!res.ok) return;

                const data = await res.json();
                if (!data.success) return;

                // Check if access code was changed → force re-auth
                if (data.requireReauth) {
                    setState('reauth');
                    return;
                }

                const { stage, agendaId, agendaTitle, agendaDescription, agendaType, agendaOptions, hasVoted } = data;
                const prevStage = previousStageRef.current;

                // Update connection indicator
                setIsSocketConnected(true);

                // Update current agenda if we have one
                if (agendaId) {
                    setCurrentAgenda({
                        id: agendaId,
                        title: agendaTitle || '',
                        description: agendaDescription,
                        stage,
                        sessionId: sessionId!,
                        displayOrder: 0,
                        isImportant: false,
                    } as any);
                }

                // ── Stage transition detection ──
                if (prevStage !== stage) {
                    console.log(`[VotePage] Stage transition: ${prevStage} → ${stage}`);

                    if (stage === 'voting') {
                        // Check local vote flag first
                        const localVoted = agendaId ? localStorage.getItem(`voted_${agendaId}`) : null;
                        if (localVoted || hasVoted) {
                            if (agendaId) localStorage.setItem(`voted_${agendaId}`, 'true');
                            setState('completed');
                        } else {
                            if (prevStage !== null) {
                                try { haptic('voteStart'); } catch(e) {}
                                toast.success('투표가 시작되었습니다!');
                            }
                            setState('voting');
                        }
                    } else if (stage === 'submitted') {
                        if (prevStage !== null) {
                            try { haptic('press'); } catch(e) {}
                            toast('새 안건이 상정되었습니다', { icon: '📋' });
                        }
                        setState('waiting');
                    } else if (stage === 'ended') {
                        if (prevStage !== null) {
                            try { haptic('voteEnd'); } catch(e) {}
                            toast('투표가 종료되었습니다', { icon: '🔒' });
                        }
                        if (agendaId) clearPendingVotesForAgenda(agendaId);
                        setState('completed');
                    } else if (stage === 'announced') {
                        if (prevStage !== null) {
                            try { haptic('success'); } catch(e) {}
                            toast('결과가 발표되었습니다', { icon: '📊' });
                        }
                        if (agendaId) clearPendingVotesForAgenda(agendaId);
                        setState('results');
                    } else {
                        // waiting
                        setState('waiting');
                    }

                    previousStageRef.current = stage;
                }
            } catch (err: any) {
                console.warn('[VotePage] Poll failed:', err.message);
                setIsSocketConnected(false);
            }
        };

        // Initial poll immediately
        pollVoterState();
        retryPendingVotes();

        // Poll every 3 seconds
        pollingRef.current = setInterval(pollVoterState, 3000);

        // Visibility change: poll immediately when screen wakes up
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                console.log('[VotePage] Screen unlocked — polling immediately');
                pollVoterState();
                retryPendingVotes();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [isTokenValidated, isAuthenticated, sessionId, voterId, setCurrentAgenda, clearPendingVotesForAgenda]);

    const handleAuthSuccess = () => {
        checkVoteStatus();
        toast.success('인증이 완료되었습니다!');
    };

    return (
        <div className="min-h-[100dvh] w-full bg-background text-foreground flex flex-col items-center justify-start sm:justify-center p-4 pt-6 pb-40 overflow-y-auto transition-colors duration-500" data-theme={theme}>
            <div className="fixed inset-0 bg-gradient-to-br from-primary/10 via-background to-secondary/10 -z-10" />

            {/* Connection Status Indicator */}
            <div className="fixed top-2 right-2 z-50 flex items-center gap-1.5 px-2 py-0.5 bg-black/20 backdrop-blur-md rounded-full border border-white/10 text-[9px] font-medium">
                <div className={`w-1.5 h-1.5 rounded-full ${isSocketConnected ? 'bg-success animate-pulse' : 'bg-red-500'}`} />
                <span className={isSocketConnected ? 'text-success/80' : 'text-red-500/80'}>
                    {isSocketConnected ? 'Connected' : 'Reconnecting'}
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

            {state === 'reauth' && (
                <ReauthModal
                    voterId={voterId!}
                    sessionId={sessionId!}
                    onSuccess={(newToken: string) => {
                        const { login } = useAuthStore.getState();
                        login(newToken, voterId!, sessionId!, tokenId);
                        toast.success('인증이 갱신되었습니다');
                        setState('waiting');
                    }}
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
