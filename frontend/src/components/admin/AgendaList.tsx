'use client';

import { useState, useEffect } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Card from '../ui/Card';
import Modal from '../ui/Modal';
import api from '@/lib/api';
import { useSessionStore } from '@/store/sessionStore';
import toast from 'react-hot-toast';

export default function AgendaList({ sessionId, onAgendaSelect }: { sessionId: string; onAgendaSelect?: () => void }) {
    const [agendas, setAgendas] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const { currentAgenda, setCurrentAgenda, setAgendas: setStoreAgendas } = useSessionStore();

    const [formData, setFormData] = useState<{
        title: string;
        description: string;
        isImportant: boolean;
        type: 'PROS_CONS' | 'MULTIPLE_CHOICE' | 'INPUT';
        options: string[];
    }>({
        title: '',
        description: '',
        isImportant: false,
        type: 'PROS_CONS',
        options: [''],
    });

    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

    useEffect(() => {
        if (sessionId) {
            fetchAgendas();
        }
    }, [sessionId]);

    const fetchAgendas = async () => {
        setLoading(true);
        try {
            const response = await api.getSessionAgendas(sessionId);
            const fetchedAgendas = response.agendas || [];
            setAgendas(fetchedAgendas);
            setStoreAgendas(fetchedAgendas);
        } catch (error: any) {
            toast.error('안건 목록을 불러오는데 실패했습니다');
        } finally {
            setLoading(false);
        }
    };

    const confirmDelete = async () => {
        if (!deleteTargetId) return;

        const agendaId = deleteTargetId;
        setLoading(true);
        try {
            await api.deleteAgenda(agendaId);
            toast.success('안건이 삭제되었습니다');

            // Remove from local store and state
            const newAgendas = agendas.filter(a => a.id !== agendaId);
            setAgendas(newAgendas);
            setStoreAgendas(newAgendas);

            // If deleted agenda was selected, deselect it
            const { currentAgenda } = useSessionStore.getState();
            if (currentAgenda?.id === agendaId) {
                setCurrentAgenda(null);
            }
        } catch (error: any) {
            toast.error(error.message || '안건 삭제에 실패했습니다');
        } finally {
            setLoading(false);
            setDeleteTargetId(null);
        }
    };

    const handleCreate = async () => {
        if (!formData.title.trim()) {
            toast.error('안건 제목을 입력해주세요');
            return;
        }

        if (formData.type === 'MULTIPLE_CHOICE') {
            const validOptions = formData.options.filter(opt => opt.trim());
            if (validOptions.length < 2) {
                toast.error('다지선다 투표는 최소 2개의 옵션이 필요합니다');
                return;
            }
        }

        setLoading(true);
        try {
            await api.createAgenda({
                sessionId,
                title: formData.title,
                description: formData.description || undefined,
                displayOrder: agendas.length,
                isImportant: formData.isImportant,
                type: formData.type,
                options: formData.type === 'MULTIPLE_CHOICE' ? formData.options.filter(opt => opt.trim()) : undefined,
            });

            toast.success('안건이 추가되었습니다');
            setShowCreateModal(false);
            setFormData({
                title: '',
                description: '',
                isImportant: false,
                type: 'PROS_CONS',
                options: ['']
            });
            fetchAgendas();
        } catch (error: any) {
            toast.error(error.message || '안건 추가에 실패했습니다');
        } finally {
            setLoading(false);
        }
    };

    const getStageLabel = (stage: string) => {
        const labels: Record<string, string> = {
            pending: '대기',
            submitted: '상정됨',
            voting: '투표 중',
            ended: '종료됨',
            announced: '발표됨',
        };
        return labels[stage] || stage;
    };

    const getStageColor = (stage: string) => {
        const colors: Record<string, string> = {
            pending: 'bg-muted text-muted-foreground',
            submitted: 'bg-secondary text-white',
            voting: 'bg-success text-white animate-pulse-slow',
            ended: 'bg-danger text-white',
            announced: 'bg-primary text-white',
        };
        return colors[stage] || colors.pending;
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">안건 목록</h2>
                <Button onClick={() => setShowCreateModal(true)} disabled={!sessionId}>
                    + 안건 추가
                </Button>
            </div>

            <div className="space-y-3">
                {agendas.map((agenda, index) => (
                    <Card
                        key={agenda.id}
                        hoverable
                        onClick={() => {
                            setCurrentAgenda(agenda);
                            onAgendaSelect?.();
                        }}
                        className={`transition-all ${currentAgenda?.id === agenda.id ? 'ring-2 ring-primary' : ''
                            } ${agenda.stage === 'pending' ? 'border-2 border-blue-400 shadow-md shadow-blue-400/20' : ''}`}
                    >
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary">
                                {index + 1}
                            </div>

                            <div className="flex-1">
                                <div className="flex items-start justify-between mb-2">
                                    <h3 className="font-bold text-lg">{agenda.title}</h3>
                                    <div className="flex gap-2">
                                        {agenda.isImportant && (
                                            <span className="text-xs px-2 py-1 bg-danger/20 text-danger rounded">
                                                중요
                                            </span>
                                        )}
                                        <span
                                            className={`text-xs px-2 py-1 rounded ${getStageColor(
                                                agenda.stage
                                            )}`}
                                        >
                                            {getStageLabel(agenda.stage)}
                                        </span>
                                    </div>
                                </div>

                                {agenda.description && (
                                    <p className="text-sm text-muted-foreground mb-3">
                                        {agenda.description}
                                    </p>
                                )}

                                <div className="flex gap-2 text-xs text-muted-foreground">
                                    {agenda.startedAt && (
                                        <span>
                                            🕐 시작: {new Date(agenda.startedAt).toLocaleTimeString('ko-KR')}
                                        </span>
                                    )}
                                    {agenda.endedAt && (
                                        <span>
                                            🏁 종료: {new Date(agenda.endedAt).toLocaleTimeString('ko-KR')}
                                        </span>
                                    )}
                                </div>

                                {/* Results Display */}
                                {(agenda.stats) && (
                                    <div className="mt-3 pt-3 border-t border-border/50">
                                        <div className="flex flex-wrap gap-4 text-sm">
                                            <div className="font-semibold">
                                                <span className="text-secondary mr-2">투표 결과:</span>
                                                <span className="text-foreground">
                                                    {(agenda.stats.turnout || 0)}% ({agenda.stats.totalVotes}/{agenda.stats.totalParticipants})
                                                </span>
                                            </div>
                                            {(agenda.type === 'PROS_CONS' || !agenda.type) && (
                                                <div className="flex gap-3">
                                                    <span className="text-success">찬성 {agenda.stats.approveCount}</span>
                                                    <span className="text-danger">반대 {agenda.stats.rejectCount}</span>
                                                    <span className="text-muted-foreground">기권 {agenda.stats.abstainCount}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <Button
                                variant="danger"
                                size="sm"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteTargetId(agenda.id);
                                }}
                            >
                                삭제
                            </Button>
                        </div>
                    </Card>
                ))}
            </div>

            {agendas.length === 0 && !loading && (
                <div className="text-center py-12 card">
                    <p className="text-muted-foreground mb-4">등록된 안건이 없습니다</p>
                    <Button onClick={() => setShowCreateModal(true)} disabled={!sessionId}>
                        첫 안건 추가하기
                    </Button>
                </div>
            )}

            {!sessionId && (
                <div className="text-center p-4 bg-danger/10 rounded-lg border border-danger/30">
                    <p className="text-danger">먼저 세션을 선택해주세요</p>
                </div>
            )}

            {/* Create Modal */}
            <Modal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                title="새 안건 추가"
                size="md"
            >
                <div className="space-y-4">
                    <Input
                        label="안건 제목"
                        placeholder="예: 제1호 안건 - 회의록 승인"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    />

                    <div>
                        <label className="text-sm font-medium text-foreground mb-2 block">
                            안건 설명 (선택사항)
                        </label>
                        <textarea
                            className="input min-h-[100px] resize-none"
                            placeholder="안건에 대한 상세 설명을 입력하세요"
                            value={formData.description}
                            onChange={(e) =>
                                setFormData({ ...formData, description: e.target.value })
                            }
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-foreground mb-2 block">
                            투표 방식
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { id: 'PROS_CONS', label: '찬성/반대' },
                                { id: 'MULTIPLE_CHOICE', label: '다지선다' },
                                { id: 'INPUT', label: '입력(주관식)' },
                            ].map((type) => (
                                <div
                                    key={type.id}
                                    onClick={() => setFormData({ ...formData, type: type.id as any })}
                                    className={`cursor-pointer p-3 rounded-lg border-2 text-center transition-all ${formData.type === type.id
                                        ? 'border-primary bg-primary/5 text-primary font-bold'
                                        : 'border-border hover:border-muted-foreground/50'
                                        }`}
                                >
                                    {type.label}
                                </div>
                            ))}
                        </div>
                    </div>

                    {formData.type === 'MULTIPLE_CHOICE' && (
                        <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
                            <label className="text-sm font-medium text-foreground block">
                                투표 옵션 설정 (최소 2개)
                            </label>
                            {formData.options.map((option, index) => (
                                <div key={index} className="flex gap-2">
                                    <Input
                                        placeholder={`옵션 ${index + 1}`}
                                        value={option}
                                        onChange={(e) => {
                                            const newOptions = [...formData.options];
                                            newOptions[index] = e.target.value;
                                            setFormData({ ...formData, options: newOptions });
                                        }}
                                    />
                                    <Button
                                        variant="danger"
                                        size="sm"
                                        onClick={() => {
                                            const newOptions = formData.options.filter((_, i) => i !== index);
                                            setFormData({ ...formData, options: newOptions });
                                        }}
                                        disabled={formData.options.length <= 1}
                                    >
                                        ✕
                                    </Button>
                                </div>
                            ))}
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setFormData({ ...formData, options: [...formData.options, ''] })}
                                fullWidth
                            >
                                + 옵션 추가
                            </Button>
                        </div>
                    )}

                    <div className="flex items-center gap-3 p-3 bg-danger/10 rounded-lg border border-danger/30">
                        <input
                            type="checkbox"
                            id="isImportant"
                            checked={formData.isImportant}
                            onChange={(e) =>
                                setFormData({ ...formData, isImportant: e.target.checked })
                            }
                            className="w-5 h-5"
                        />
                        <label htmlFor="isImportant" className="text-sm cursor-pointer">
                            중요 투표 (재인증 필요)
                        </label>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Button
                            variant="ghost"
                            onClick={() => setShowCreateModal(false)}
                            fullWidth
                        >
                            취소
                        </Button>
                        <Button onClick={handleCreate} loading={loading} fullWidth>
                            추가
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={!!deleteTargetId}
                onClose={() => setDeleteTargetId(null)}
                title="안건 삭제 확인"
                size="sm"
            >
                <div className="space-y-6">
                    <p className="text-muted-foreground">
                        정말로 삭제하시겠습니까? <br />
                        <span className="font-bold text-foreground">
                            {agendas.find(a => a.id === deleteTargetId)?.title}
                        </span>
                        <br />
                        삭제된 안건은 복구할 수 없습니다.
                    </p>
                    <div className="flex gap-3 justify-end">
                        <Button
                            variant="ghost"
                            onClick={() => setDeleteTargetId(null)}
                        >
                            취소
                        </Button>
                        <Button
                            variant="danger"
                            onClick={confirmDelete}
                            loading={loading}
                        >
                            삭제
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
