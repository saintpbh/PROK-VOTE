'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Loading from '@/components/ui/Loading';
import GlobalAuthFlow from '@/components/voter/GlobalAuthFlow';
import WaitingRoom from '@/components/voter/WaitingRoom';
import VotingPanel from '@/components/voter/VotingPanel';
import CompletedScreen from '@/components/voter/CompletedScreen';
import api from '@/lib/api';
import socketService from '@/lib/socket';
import { useAuthStore } from '@/store/authStore';
import { useSessionStore } from '@/store/sessionStore';
import toast from 'react-hot-toast';

type VoterState = 'loading' | 'auth' | 'waiting' | 'voting' | 'completed';

function GlobalVoteContent() {
    const searchParams = useSearchParams();
    const sessionIdFromUrl = searchParams.get('s');

    const [state, setState] = useState<VoterState>('loading');
    const [sessionData, setSessionData] = useState<any>(null);
    const { isAuthenticated, voterId, sessionId: storeSessionId } = useAuthStore();
    const { currentAgenda, setCurrentAgenda } = useSessionStore();
    const [theme, setTheme] = useState<string>('classic');

    const activeSessionId = sessionIdFromUrl || storeSessionId;

    const checkVoteStatus = async () => {
        if (!voterId || !activeSessionId) {
            setState('waiting');
            return;
        }

        try {
            const sessionResponse = await api.getSessionAgendas(activeSessionId);
            const agendas = sessionResponse.agendas || [];

            let activeAgenda = agendas.find((a: any) => a.stage === 'voting');
            if (!activeAgenda) activeAgenda = agendas.find((a: any) => a.stage === 'submitted');
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
                } catch (e) { }

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
            setState('waiting');
        }
    };

    const initPage = async () => {
        if (!activeSessionId) {
            toast.error('세션 정보가 없습니다.');
            return;
        }

        try {
            const response = await api.getPublicSession(activeSessionId);
            if (response.success) {
                setSessionData(response.session);
                setTheme(response.session.voterTheme || 'classic');

                if (isAuthenticated && voterId && storeSessionId === activeSessionId) {
                    checkVoteStatus();
                } else {
                    setState('auth');
                }
            } else {
                toast.error('세션을 찾을 수 없습니다.');
            }
        } catch (err) {
            setState('auth');
        }
    };

    useEffect(() => {
        initPage();
    }, [activeSessionId]);

    useEffect(() => {
        if (isAuthenticated && activeSessionId) {
            socketService.connect();
            socketService.joinSession(activeSessionId, voterId || undefined, 'voter');

            socketService.on('stage:changed', () => checkVoteStatus());
            socketService.on('vote:confirmed', () => {
                setState('completed');
                toast.success('투표가 완료되었습니다!');
            });
            socketService.on('session:settings:update', (settings) => {
                if (settings.voterTheme) setTheme(settings.voterTheme);
            });

            return () => {
                socketService.off('stage:changed');
                socketService.off('vote:confirmed');
            };
        }
    }, [isAuthenticated, activeSessionId, voterId]);

    return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4 transition-colors duration-500" data-theme={theme}>
            <div className="fixed inset-0 bg-gradient-to-br from-primary/10 via-background to-secondary/10 -z-10" />

            {state === 'loading' && <Loading fullScreen />}

            {state === 'auth' && (
                <GlobalAuthFlow
                    sessionId={activeSessionId!}
                    sessionData={sessionData}
                    onSuccess={() => checkVoteStatus()}
                />
            )}

            {state === 'waiting' && (
                <WaitingRoom
                    sessionName={sessionData?.name}
                    agendaTitle={currentAgenda?.stage === 'submitted' ? currentAgenda.title : undefined}
                    onStageChange={(stage) => stage === 'voting' && setState('voting')}
                />
            )}

            {state === 'voting' && currentAgenda && (
                <VotingPanel
                    agenda={currentAgenda}
                    onVoteComplete={() => setState('completed')}
                />
            )}

            {state === 'completed' && <CompletedScreen />}
        </div>
    );
}

export default function GlobalVotePage() {
    return (
        <Suspense fallback={<Loading fullScreen />}>
            <GlobalVoteContent />
        </Suspense>
    );
}
