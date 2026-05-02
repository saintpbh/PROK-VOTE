'use client';

import { useState, useEffect } from 'react';
import Button from '../ui/Button';
import Card from '../ui/Card';
import socketService from '@/lib/socket';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useSessionStore } from '@/store/sessionStore';

interface StageControllerProps {
    agendaId: string;
    sessionId: string;
    currentStage: string;
    onStageChange?: (newStage: string) => void;
    onClose?: () => void;
}

export default function StageController({
    agendaId,
    sessionId,
    currentStage,
    onStageChange,
    onClose,
}: StageControllerProps) {
    // ... existing state ...
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState<any>(null);

    // ... existing stats logic ...
    useEffect(() => {
        const socket = socketService.connect();
        socketService.joinSession(sessionId, undefined, 'admin');

        socketService.on('stats:updated', (data) => {
            if (data.agendaId === agendaId) {
                setStats(data);
            }
        });

        fetchStats();

        return () => {
            socketService.off('stats:updated');
        };
    }, [agendaId, sessionId]);

    const fetchStats = async () => {
        try {
            const response = await api.getVoteStatistics(agendaId);
            setStats((response as any).stats || response);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    };

    // ... handlers ...
    const handleStageChange = async (newStage: string) => {
        setLoading(true);
        try {
            console.log(`[Admin] Emitting stage:update: ${newStage} for agenda ${agendaId}`);
            socketService.emit('stage:update', { agendaId, stage: newStage });
            console.log(`[Admin] Socket event 'stage:update' emitted for agenda ${agendaId}, stage ${newStage}`);
            await api.updateAgendaStage(agendaId, newStage);
            console.log(`[Admin] API call 'updateAgendaStage' successful for agenda ${agendaId}, stage ${newStage}`);
            toast.success(`단계가 변경되었습니다: ${getStageName(newStage)}`);
            onStageChange?.(newStage);
        } catch (error: any) {
            console.error(`[Admin] Failed to change stage for agenda ${agendaId} to ${newStage}:`, error);
            toast.error(error.message || '단계 변경에 실패했습니다');
        } finally {
            setLoading(false);
        }
    };

    const handleEndVoting = async () => {
        setLoading(true);
        try {
            console.log(`[Admin] Emitting vote:end for agenda ${agendaId}`);
            socketService.emit('vote:end', { agendaId });
            console.log(`[Admin] Socket event 'vote:end' emitted for agenda ${agendaId}`);
            await api.updateAgendaStage(agendaId, 'ended');
            console.log(`[Admin] API call 'updateAgendaStage' successful for agenda ${agendaId}, stage 'ended'`);
            toast.success('투표가 종료되었습니다');
            onStageChange?.('ended');
        } catch (error: any) {
            console.error(`[Admin] Failed to end voting for agenda ${agendaId}:`, error);
            toast.error(error.message || '투표 종료에 실패했습니다');
        } finally {
            setLoading(false);
        }
    };

    const handlePublishResults = async () => {
        setLoading(true);
        try {
            console.log(`[Admin] Emitting result:publish for agenda ${agendaId}`);
            socketService.emit('result:publish', { agendaId });
            console.log(`[Admin] Socket event 'result:publish' emitted for agenda ${agendaId}`);
            await api.updateAgendaStage(agendaId, 'announced');
            console.log(`[Admin] API call 'updateAgendaStage' successful for agenda ${agendaId}, stage 'announced'`);
            toast.success('결과가 발표되었습니다');
            onStageChange?.('announced');
        } catch (error: any) {
            console.error(`[Admin] Failed to publish results for agenda ${agendaId}:`, error);
            toast.error(error.message || '결과 발표에 실패했습니다');
        } finally {
            setLoading(false);
        }
    };

    const getStageName = (stage: string) => {
        const names: Record<string, string> = {
            pending: '대기',
            submitted: '상정',
            voting: '투표 중',
            ended: '종료',
            announced: '발표됨',
        };
        return names[stage] || stage;
    };

    const getStageDescription = (stage: string) => {
        const descriptions: Record<string, string> = {
            pending: '안건이 아직 상정되지 않았습니다',
            submitted: '안건이 상정되었으나 투표는 시작되지 않았습니다',
            voting: '현재 투표가 진행 중입니다',
            ended: '투표가 종료되었습니다',
            announced: '결과가 발표되었습니다',
        };
        return descriptions[stage] || '';
    };

    return (
        <div className="space-y-6">
            <Card title="투표 제어" titleClassName="text-xl font-bold text-primary">
                <div className="space-y-6">
                    {/* Live Statistics */}
                    {stats && currentStage !== 'pending' && (
                        <div className="p-4 bg-muted/30 rounded-lg space-y-3">
                            {/* ... stats display ... */}
                            {/* Simplified for brevity in replace helper, but reusing logic */}
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">실시간 투표 현황</span>
                                <span className="text-sm text-muted-foreground">
                                    투표율: {stats.turnoutPercentage?.toFixed(1) || '0.0'}%
                                </span>
                            </div>
                            {/* ... rest of stats content ... */}
                            {(!stats.type || stats.type === 'PROS_CONS') && (
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="text-center p-3 bg-success/20 rounded">
                                        <div className="text-2xl font-bold text-success">{stats.approveCount}</div>
                                        <div className="text-xs text-muted-foreground mt-1">찬성</div>
                                    </div>
                                    <div className="text-center p-3 bg-danger/20 rounded">
                                        <div className="text-2xl font-bold text-danger">{stats.rejectCount}</div>
                                        <div className="text-xs text-muted-foreground mt-1">반대</div>
                                    </div>
                                    <div className="text-center p-3 bg-muted/50 rounded">
                                        <div className="text-2xl font-bold text-foreground">{stats.abstainCount}</div>
                                        <div className="text-xs text-muted-foreground mt-1">기권</div>
                                    </div>
                                </div>
                            )}

                            {stats.type === 'MULTIPLE_CHOICE' && (
                                <div className="space-y-3">
                                    {(stats.options || []).map((option: string) => {
                                        const count = stats.voteCounts?.[option] || 0;
                                        const percent = stats.totalVotes > 0 ? (count / stats.totalVotes) * 100 : 0;
                                        return (
                                            <div key={option} className="space-y-1">
                                                <div className="flex justify-between text-xs">
                                                    <span className="font-medium">{option}</span>
                                                    <span>{count}표 ({percent.toFixed(1)}%)</span>
                                                </div>
                                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                    <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {stats.type === 'INPUT' && (
                                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                    <div className="flex justify-between items-center text-xs text-muted-foreground mb-2">
                                        <span>주관식 응답 목록</span>
                                        <span>총 {stats.totalVotes}건</span>
                                    </div>
                                    {Object.entries(stats.voteCounts || {}).length === 0 ? (
                                        <div className="text-center py-4 text-muted-foreground text-xs">아직 응답이 없습니다</div>
                                    ) : (
                                        Object.entries(stats.voteCounts || {})
                                            .sort(([, a], [, b]) => (b as number) - (a as number))
                                            .map(([text, count]: [string, any]) => (
                                                <div key={text} className="flex justify-between items-center bg-card p-2 rounded border border-border shadow-sm">
                                                    <span className="text-sm truncate max-w-[70%]">{text}</span>
                                                    <span className="px-2 py-0.5 bg-secondary/10 text-secondary rounded text-xs font-bold">{count}</span>
                                                </div>
                                            ))
                                    )}
                                </div>
                            )}

                            <div className="text-xs text-muted-foreground text-center pt-2 border-t border-border/50">
                                총 {stats.totalVotes}표 / {stats.totalParticipants}명 참가
                            </div>
                        </div>
                    )}

                    {/* Current Stage Indicator */}
                    <div className="p-4 bg-primary/10 rounded-lg border-2 border-primary/30">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-primary">현재 단계</span>
                            <span className="text-2xl font-bold text-primary">
                                {getStageName(currentStage)}
                            </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {getStageDescription(currentStage)}
                        </p>
                    </div>

                    {/* Stage Flow */}
                    <div className="grid grid-cols-5 gap-2">
                        {['pending', 'submitted', 'voting', 'ended', 'announced'].map((stage, index) => (
                            <div
                                key={stage}
                                className={`text-center p-2 rounded-lg text-xs font-medium transition-all ${currentStage === stage
                                    ? 'bg-primary text-white scale-110'
                                    : 'bg-muted/50 text-muted-foreground'
                                    }`}
                            >
                                {index + 1}. {getStageName(stage)}
                            </div>
                        ))}
                    </div>

                    {/* Control Buttons */}
                    <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-4">
                            <Button
                                onClick={() => handleStageChange('submitted')}
                                disabled={currentStage !== 'pending' || loading}
                                variant="secondary"
                                fullWidth
                            >
                                상정
                            </Button>

                            <Button
                                onClick={() => handleStageChange('voting')}
                                disabled={loading || (currentStage !== 'submitted' && currentStage !== 'ended' && currentStage !== 'announced')}
                                variant="success"
                                fullWidth
                            >
                                {(currentStage === 'ended' || currentStage === 'announced') ? '투표 재개' : '투표 개시'}
                            </Button>

                            <Button
                                onClick={handleEndVoting}
                                disabled={currentStage !== 'voting' || loading}
                                variant="danger"
                                fullWidth
                            >
                                투표 종료
                            </Button>

                            <Button
                                onClick={handlePublishResults}
                                disabled={currentStage !== 'ended' || loading}
                                variant="primary"
                                fullWidth
                            >
                                결과 발표
                            </Button>
                        </div>

                        {/* Close Agenda Button */}
                        {onClose && (
                            <div className="flex flex-col gap-2 mt-2">
                                {currentStage === 'announced' && (
                                    <Button
                                        onClick={async () => {
                                            const { agendas, updateAgendaStage, setCurrentAgenda } = useSessionStore.getState();
                                            const currentIndex = agendas.findIndex((a: any) => a.id === agendaId);
                                            const next = agendas[currentIndex + 1];

                                            if (next) {
                                                setLoading(true);
                                                try {
                                                    // Automatically move to 'submitted' for the next one
                                                    await api.updateAgendaStage(next.id, 'submitted');
                                                    socketService.emit('stage:update', { agendaId: next.id, stage: 'submitted' });

                                                    // Update store
                                                    updateAgendaStage(next.id, 'submitted');
                                                    setCurrentAgenda(next);
                                                    toast.success('다음 안건으로 이동했습니다');
                                                } catch (err) {
                                                    toast.error('다음 안건 이동 실패');
                                                } finally {
                                                    setLoading(false);
                                                }
                                            }
                                        }
                                        }
                                        disabled={loading || !useSessionStore.getState().agendas[useSessionStore.getState().agendas.findIndex((a: any) => a.id === agendaId) + 1]}
                                        variant="primary"
                                        fullWidth
                                        className="bg-gradient-to-r from-primary to-secondary animate-pulse-slow active:scale-95"
                                    >
                                        다음 안건 (상정/이동)
                                    </Button>
                                )}
                                <Button
                                    onClick={onClose}
                                    disabled={currentStage !== 'announced' && currentStage !== 'ended'}
                                    variant="outline"
                                    fullWidth
                                    className="border-primary/50 hover:bg-primary/5"
                                >
                                    🏁 안건 종료 (창 닫기)
                                </Button>
                            </div>
                        )}
                    </div>


                    {/* Stadium Controls */}
                    <div className="pt-6 border-t border-border/50">
                        <div className="text-sm font-medium mb-3">전광판 제어</div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={async () => {
                                    setLoading(true);
                                    try {
                                        socketService.emit('stadium:control', { sessionId, action: 'reset' });
                                        toast.success('전광판이 리셋되었습니다');
                                    } catch (e) {
                                        toast.error('전광판 리셋 실패');
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                                disabled={loading}
                                className="flex-1"
                            >
                                리셋
                            </Button>

                            <Button
                                variant="outline"
                                onClick={async () => {
                                    setLoading(true);
                                    try {
                                        socketService.emit('stadium:control', { sessionId, action: 'show_logo' });
                                        toast.success('전광판에 로고가 표시됩니다');
                                    } catch (e) {
                                        toast.error('로고 표시 실패');
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                                disabled={loading}
                                className="flex-1"
                            >
                                로고
                            </Button>

                            <div className="relative">
                                <input
                                    type="file"
                                    id="logo-upload-control"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;

                                        try {
                                            const toastId = toast.loading('로고 업로드 중...');
                                            await api.uploadSessionLogo(sessionId, file);
                                            toast.dismiss(toastId);
                                            toast.success('로고가 등록되었습니다');
                                        } catch (err) {
                                            toast.dismiss();
                                            toast.error('업로드 실패');
                                        }
                                    }}
                                />
                                <Button
                                    variant="ghost"
                                    onClick={() => document.getElementById('logo-upload-control')?.click()}
                                    disabled={loading}
                                    title="로고 업로드"
                                    className="px-3"
                                >
                                    📤
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
}
