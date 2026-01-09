'use client';

import { useState, useEffect } from 'react';
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
    const { isAuthenticated, voterId, sessionId } = useAuthStore();
    const { currentAgenda, setCurrentAgenda } = useSessionStore();
    const [theme, setTheme] = useState<string>('classic');

    const checkVoteStatus = async () => {
        if (!voterId || !sessionId) {
            setState('waiting');
            return;
        }

        try {
            // Get current session agendas to find active one
            const sessionResponse = await api.getSessionAgendas(sessionId);
            const agendas = sessionResponse.agendas || [];

            // Find active agenda: Voting > Submitted > Announced > Ended (Newest first)
            let activeAgenda = agendas.find((a: any) => a.stage === 'voting');
            console.log('[VotePage] Agendas found:', agendas.length, 'Active voting agenda:', activeAgenda?.title);

            if (!activeAgenda) {
                activeAgenda = agendas.find((a: any) => a.stage === 'submitted');
            }

            // If no voting or submitted, check for announced or ended (latest one)
            if (!activeAgenda) {
                const reversedAgendas = [...agendas].reverse();
                activeAgenda = reversedAgendas.find((a: any) => a.stage === 'announced' || a.stage === 'ended');
            }

            if (activeAgenda) {
                setCurrentAgenda(activeAgenda);

                // Check if user has already voted on this agenda
                let hasVoted = false;
                try {
                    const voteResponse = await api.checkVoted(voterId, activeAgenda.id);
                    hasVoted = voteResponse.hasVoted;
                } catch (e) {
                    // unexpected error or 404
                    console.error("Failed to check vote status", e);
                }

                if (activeAgenda.stage === 'voting') {
                    if (hasVoted) {
                        setState('completed');
                    } else {
                        setState('voting');
                    }
                } else if (activeAgenda.stage === 'submitted') {
                    setState('waiting');
                } else if (activeAgenda.stage === 'announced' || activeAgenda.stage === 'ended') {
                    // For announced/ended, show waiting screen (as per user request)
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
    };

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

            // Check if already authenticated
            if (isAuthenticated && voterId) {
                // Check vote status
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
        console.log(`[VotePage] Theme changed to: ${theme}`);
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    useEffect(() => {
        if (isAuthenticated && sessionId) {
            // Connect to WebSocket
            const socket = socketService.connect();
            socketService.joinSession(sessionId, voterId || undefined, 'voter');

            // Listeners
            socketService.on('connect', () => {
                console.log(`[VotePage] Socket connected: ${socketService.getSocket()?.id}`);
                console.log(`[VotePage] Current Session ID: ${sessionId}`);
                checkVoteStatus();
            });

            socketService.on('stage:changed', ({ agendaId, stage }) => {
                console.log(`[VotePage] stage:changed received: ${stage} for ${agendaId}`);

                if (stage === 'voting') {
                    // Start voting
                    toast.success('투표가 시작되었습니다!');
                    setState('voting');
                    checkVoteStatus();
                } else if (stage === 'submitted') {
                    // Show new agenda in waiting room
                    setState('waiting');
                    if (agendaId) {
                        checkVoteStatus();
                    }
                } else if (stage === 'ended' || stage === 'announced') {
                    // Voting has finished or results are out
                    // If we were voting, move to completed
                    setState(prev => prev === 'voting' ? 'completed' : 'waiting');

                    if (agendaId) {
                        checkVoteStatus();
                    }
                }
            });

            socketService.on('vote:ended', ({ agendaId }) => {
                console.log(`[VotePage] vote:ended received for ${agendaId}`);
                setState('completed');
            });

            socketService.on('vote:confirmed', ({ vote }) => {
                console.log('[VotePage] vote:confirmed received');
                setState('completed');
                toast.success('투표가 완료되었습니다!');
            });

            socketService.on('auth:required', () => {
                console.warn('[VotePage] auth:required received');
                toast.error('재인증이 필요합니다');
                setState('auth');
            });

            socketService.on('session:settings:update', (settings) => {
                console.log('[VotePage] session:settings:update received:', settings);

                // Update local session data with new settings
                setTokenData((prev: any) => {
                    if (!prev || !prev.session) return prev;
                    return {
                        ...prev,
                        session: {
                            ...prev.session,
                            ...settings
                        }
                    };
                });

                if (settings.voterTheme) {
                    console.log(`[VotePage] Applying new theme: ${settings.voterTheme}`);
                    setTheme(settings.voterTheme);
                }
            });

            // If we are already connected but not in the session (e.g. navigation), join now
            if (socket.connected) {
                socketService.joinSession(sessionId, voterId || undefined, 'voter');
            }

            return () => {
                socketService.off('connect');
                socketService.off('stage:changed');
                socketService.off('vote:ended');
                socketService.off('vote:confirmed');
                socketService.off('auth:required');
            };
        }
    }, [isAuthenticated, sessionId, voterId]);

    const handleAuthSuccess = () => {
        checkVoteStatus(); // Check status after auth
        toast.success('인증이 완료되었습니다!');
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4 transition-colors duration-500" data-theme={theme}>
            {/* Ambient Background Gradient for modern look */}
            <div className="fixed inset-0 bg-gradient-to-br from-primary/10 via-background to-secondary/10 -z-10" />
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
