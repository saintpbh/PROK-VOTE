'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import socketService from '@/lib/socket';
import api from '@/lib/api';
import { useSessionStore } from '@/store/sessionStore';
import toast from 'react-hot-toast';

export default function ModeratorPage() {
    const [sessionId, setSessionId] = useState('');
    const [agendaId, setAgendaId] = useState('');
    const [stats, setStats] = useState<any>(null);
    const [showReVoteModal, setShowReVoteModal] = useState(false);
    const { currentSession, currentAgenda } = useSessionStore();

    useEffect(() => {
        // Use current session/agenda from store if available
        if (currentSession) {
            setSessionId(currentSession.id);
        }
        if (currentAgenda) {
            setAgendaId(currentAgenda.id);
        }
    }, [currentSession, currentAgenda]);

    useEffect(() => {
        if (sessionId) {
            // Connect to WebSocket
            const socket = socketService.connect();
            socketService.joinSession(sessionId, undefined, 'moderator');

            // Listen for stats updates
            socketService.on('stats:updated', (data) => {
                if (agendaId && data.agendaId === agendaId) {
                    setStats(data);
                }
            });

            return () => {
                socketService.off('stats:updated');
            };
        }
    }, [sessionId, agendaId]);

    useEffect(() => {
        // Hotkey listener for re-vote (R key)
        const handleKeyPress = (e: KeyboardEvent) => {
            if (e.key === 'r' || e.key === 'R') {
                if (currentAgenda?.stage === 'voting') {
                    setShowReVoteModal(true);
                }
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [currentAgenda]);

    useEffect(() => {
        if (agendaId) {
            fetchStats();
        }
    }, [agendaId]);

    const fetchStats = async () => {
        if (!agendaId) return;

        try {
            const response = await api.getVoteStatistics(agendaId);
            setStats(response.stats);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    };

    const handlePublishResults = async () => {
        if (!agendaId) {
            toast.error('안건을 선택해주세요');
            return;
        }

        try {
            socketService.emit('result:publish', { agendaId });
            await api.updateAgendaStage(agendaId, 'announced');
            toast.success('결과가 발표되었습니다');
        } catch (error: any) {
            toast.error(error.message || '결과 발표에 실패했습니다');
        }
    };

    const handleReVote = async () => {
        if (!sessionId) {
            toast.error('세션을 선택해주세요');
            return;
        }

        try {
            // Emit token revocation event
            socketService.emit('tokens:revoke', { sessionId });
            toast.success('재투표 세션이 시작되었습니다. 모든 참가자는 재인증이 필요합니다.');
            setShowReVoteModal(false);
        } catch (error: any) {
            toast.error(error.message || '재투표 시작에 실패했습니다');
        }
    };

    const getTurnoutPercentage = () => {
        if (!stats || stats.totalParticipants === 0) return 0;
        return (stats.totalVotes / stats.totalParticipants) * 100;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-secondary/20 to-primary/20 p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-secondary to-primary bg-clip-text text-transparent">
                        진행자 콘솔
                    </h1>
                    <p className="text-muted-foreground">
                        실시간 투표 모니터링 및 제어
                    </p>
                </div>

                {/* Current Session Info */}
                {currentSession && currentAgenda && (
                    <Card>
                        <div className="space-y-3">
                            <div>
                                <p className="text-sm text-muted-foreground">현재 세션</p>
                                <p className="text-xl font-bold">{currentSession.name}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">현재 안건</p>
                                <p className="text-xl font-bold">{currentAgenda.title}</p>
                            </div>
                            <div className="flex gap-2">
                                <span className="text-xs px-2 py-1 bg-primary/20 text-primary rounded">
                                    {currentAgenda.stage}
                                </span>
                                {currentAgenda.isImportant && (
                                    <span className="text-xs px-2 py-1 bg-danger/20 text-danger rounded">
                                        ⚠️ 중요 투표
                                    </span>
                                )}
                            </div>
                        </div>
                    </Card>
                )}

                {/* Live Voting Rate */}
                {stats && (
                    <Card title="📊 실시간 투표 현황">
                        <div className="space-y-6">
                            {/* Progress Bar */}
                            <div>
                                <div className="flex justify-between mb-2">
                                    <span className="font-semibold">투표율</span>
                                    <span className="text-2xl font-bold text-primary">
                                        {getTurnoutPercentage().toFixed(1)}%
                                    </span>
                                </div>
                                <div className="w-full h-8 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
                                        style={{ width: `${getTurnoutPercentage()}%` }}
                                    />
                                </div>
                                <div className="text-sm text-muted-foreground mt-2">
                                    {stats.totalVotes}표 / {stats.totalParticipants}명 참가
                                </div>
                            </div>

                            {/* Vote Breakdown */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="text-center p-4 bg-success/20 rounded-lg">
                                    <div className="text-3xl font-bold text-success">
                                        {stats.approveCount}
                                    </div>
                                    <div className="text-sm text-muted-foreground mt-1">찬성</div>
                                </div>

                                <div className="text-center p-4 bg-danger/20 rounded-lg">
                                    <div className="text-3xl font-bold text-danger">
                                        {stats.rejectCount}
                                    </div>
                                    <div className="text-sm text-muted-foreground mt-1">반대</div>
                                </div>

                                <div className="text-center p-4 bg-muted/50 rounded-lg">
                                    <div className="text-3xl font-bold text-foreground">
                                        {stats.abstainCount}
                                    </div>
                                    <div className="text-sm text-muted-foreground mt-1">기권</div>
                                </div>
                            </div>
                        </div>
                    </Card>
                )}

                {/* Controls */}
                <Card title="🎮 제어 패널">
                    <div className="space-y-4">
                        <Button
                            onClick={handlePublishResults}
                            variant="primary"
                            size="lg"
                            fullWidth
                            disabled={!currentAgenda || currentAgenda.stage !== 'ended'}
                        >
                            📢 결과 발표하기
                        </Button>

                        <div className="p-4 bg-muted/30 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-semibold">재투표 핫키</span>
                                <kbd className="px-3 py-1 bg-background rounded text-sm font-mono">R</kbd>
                            </div>
                            <p className="text-sm text-muted-foreground mb-3">
                                투표 진행 중 R 키를 누르면 재투표 세션을 시작할 수 있습니다
                            </p>
                            <Button
                                onClick={() => setShowReVoteModal(true)}
                                variant="danger"
                                fullWidth
                                disabled={!currentAgenda || currentAgenda.stage !== 'voting'}
                            >
                                🔄 재투표 시작
                            </Button>
                        </div>
                    </div>
                </Card>

                {/* Re-Vote Modal */}
                {showReVoteModal && (
                    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
                        <Card className="max-w-md w-full">
                            <div className="space-y-6">
                                <div className="text-center">
                                    <div className="text-6xl mb-4">⚠️</div>
                                    <h2 className="text-2xl font-bold mb-2">재투표 확인</h2>
                                    <p className="text-muted-foreground">
                                        재투표를 시작하시겠습니까?
                                    </p>
                                </div>

                                <div className="p-4 bg-danger/10 rounded-lg border border-danger/30">
                                    <p className="text-sm text-danger">
                                        <strong>주의:</strong> 모든 참가자의 토큰이 무효화되며 재인증이
                                        필요합니다.
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <Button
                                        variant="ghost"
                                        onClick={() => setShowReVoteModal(false)}
                                        fullWidth
                                    >
                                        취소
                                    </Button>
                                    <Button
                                        variant="danger"
                                        onClick={handleReVote}
                                        fullWidth
                                    >
                                        재투표 시작
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    </div>
                )}

                {/* Hotkey Guide */}
                <div className="p-4 bg-muted/30 rounded-lg text-sm text-muted-foreground">
                    <p className="font-semibold mb-2">💡 단축키</p>
                    <ul className="space-y-1">
                        <li>• <kbd className="px-2 py-0.5 bg-background rounded font-mono text-xs">R</kbd> - 재투표 시작 (투표 중일 때만)</li>
                    </ul>
                </div>

                {!currentSession && (
                    <div className="text-center p-8 card">
                        <p className="text-muted-foreground mb-4">
                            먼저 관리자 페이지에서 세션과 안건을 선택하세요
                        </p>
                        <Button onClick={() => (window.location.href = '/admin')}>
                            관리자 페이지로 이동
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
