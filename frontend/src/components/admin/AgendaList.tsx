'use client';

import { useState, useEffect, useRef } from 'react';
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
        type: 'PROS_CONS' | 'MULTIPLE_CHOICE' | 'MULTIPLE_CHOICE_MULTI' | 'INPUT';
        options: string[];
    }>({
        title: '',
        description: '',
        isImportant: false,
        type: 'PROS_CONS',
        options: [''],
    });

    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [showVoteLogModal, setShowVoteLogModal] = useState(false);
    const [voteLogAgendaId, setVoteLogAgendaId] = useState<string | null>(null);
    const [voteLogs, setVoteLogs] = useState<any[]>([]);
    const [logStatus, setLogStatus] = useState<'active' | 'archived' | 'trashed'>('active');
    const fileInputRef = useRef<HTMLInputElement>(null);

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

        if (formData.type === 'MULTIPLE_CHOICE' || formData.type === 'MULTIPLE_CHOICE_MULTI') {
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
                options: (formData.type === 'MULTIPLE_CHOICE' || formData.type === 'MULTIPLE_CHOICE_MULTI') ? formData.options.filter(opt => opt.trim()) : undefined,
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

    // ─── Excel Import/Export ───

    const downloadExcelTemplate = () => {
        const headers = ['제목,설명,유형(PROS_CONS/MULTIPLE_CHOICE/MULTIPLE_CHOICE_MULTI/INPUT),"옵션(콤마구분)",중요안건(Y/N)'];
        const example = ['제1호 안건 승인,안건 설명입니다,PROS_CONS,,Y'];
        const example2 = ['대표이사 선출,후보 중 선택,MULTIPLE_CHOICE,"김철수,이영희,박민수",N'];
        const example3 = ['복수선택 안건,복수 선택 가능,MULTIPLE_CHOICE_MULTI,"옵션A,옵션B,옵션C,옵션D",N'];
        const csv = [headers, example, example2, example3].join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'agenda_template.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    // CSV 행을 따옴표 인식하여 열 분리
    const parseCSVLine = (line: string): string[] => {
        const cols: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                inQuotes = !inQuotes;
            } else if (ch === ',' && !inQuotes) {
                cols.push(current.trim());
                current = '';
            } else {
                current += ch;
            }
        }
        cols.push(current.trim());
        return cols;
    };

    const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const lines = text.split('\n').filter(l => l.trim());
            if (lines.length < 2) {
                toast.error('유효한 데이터가 없습니다');
                return;
            }

            const agendas = lines.slice(1).map(line => {
                const cols = parseCSVLine(line);
                return {
                    title: cols[0] || '',
                    description: cols[1] || '',
                    type: cols[2] || 'PROS_CONS',
                    options: cols[3] ? cols[3].split(',').map(o => o.trim()).filter(Boolean) : undefined,
                    isImportant: cols[4]?.toUpperCase() === 'Y',
                };
            }).filter(a => a.title);

            if (agendas.length === 0) {
                toast.error('가져올 안건이 없습니다');
                return;
            }

            const result = await api.importAgendas(sessionId, agendas);
            toast.success(`${result.imported}건 가져오기 성공${result.failed > 0 ? `, ${result.failed}건 실패` : ''}`);
            fetchAgendas();
        } catch (error: any) {
            toast.error(error.message || '엑셀 가져오기 실패');
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // ─── Vote Logs ───

    const openVoteLogs = async (agendaId: string) => {
        setVoteLogAgendaId(agendaId);
        setLogStatus('active');
        try {
            const res = await api.getVoteLogs(agendaId, 'active');
            setVoteLogs(res.logs || []);
        } catch { toast.error('투표 로그 조회 실패'); }
        setShowVoteLogModal(true);
    };

    const refreshLogs = async () => {
        if (!voteLogAgendaId) return;
        try {
            const res = await api.getVoteLogs(voteLogAgendaId, logStatus);
            setVoteLogs(res.logs || []);
        } catch { toast.error('투표 로그 조회 실패'); }
    };

    const handleExportLogs = async () => {
        if (!voteLogAgendaId) return;
        try {
            const blob = await api.exportVoteLogs(voteLogAgendaId);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `vote_log_${voteLogAgendaId}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch { toast.error('로그 내보내기 실패'); }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-2xl font-bold">안건 목록</h2>
                <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="secondary" onClick={downloadExcelTemplate}>
                        📥 포맷 다운로드
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                        📤 엑셀 업로드
                    </Button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        className="hidden"
                        onChange={handleExcelUpload}
                    />
                    <Button onClick={() => setShowCreateModal(true)} disabled={!sessionId}>
                        + 안건 추가
                    </Button>
                </div>
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

                            <div className="flex flex-col gap-1">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        openVoteLogs(agenda.id);
                                    }}
                                >
                                    📝 로그
                                </Button>
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
                <div className="flex flex-col max-h-[calc(90vh-6rem)]">
                    {/* Scrollable form area */}
                    <div className="flex-1 overflow-y-auto space-y-4 pr-1">
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
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { id: 'PROS_CONS', label: '찬성/반대' },
                                    { id: 'MULTIPLE_CHOICE', label: '다지선다(1개)' },
                                    { id: 'MULTIPLE_CHOICE_MULTI', label: '다지선다(복수)' },
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

                        {(formData.type === 'MULTIPLE_CHOICE' || formData.type === 'MULTIPLE_CHOICE_MULTI') && (
                            <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
                                <label className="text-sm font-medium text-foreground block">
                                    투표 옵션 설정 (최소 2개)
                                    {formData.type === 'MULTIPLE_CHOICE_MULTI' && (
                                        <span className="text-xs text-secondary ml-2">(복수선택 가능)</span>
                                    )}
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
                    </div>

                    {/* Fixed bottom buttons */}
                    <div className="flex gap-3 pt-4 mt-4 border-t border-border/30 flex-shrink-0">
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

            {/* Vote Log Modal */}
            <Modal
                isOpen={showVoteLogModal}
                onClose={() => setShowVoteLogModal(false)}
                title="투표 로그"
                size="lg"
            >
                <div className="space-y-4">
                    <div className="flex gap-2 flex-wrap">
                        {(['active', 'archived', 'trashed'] as const).map(s => (
                            <Button
                                key={s}
                                size="sm"
                                variant={logStatus === s ? 'primary' : 'ghost'}
                                onClick={() => { setLogStatus(s); setTimeout(refreshLogs, 100); }}
                            >
                                {s === 'active' ? '활성' : s === 'archived' ? '보관' : '휴지통'}
                            </Button>
                        ))}
                        <div className="flex-1" />
                        <Button size="sm" variant="secondary" onClick={handleExportLogs}>📥 CSV 내보내기</Button>
                        {logStatus === 'active' && voteLogAgendaId && (
                            <Button size="sm" variant="secondary" onClick={async () => {
                                await api.archiveVoteLogs(voteLogAgendaId);
                                toast.success('보관 완료');
                                refreshLogs();
                            }}>📦 보관으로 이동</Button>
                        )}
                        {logStatus === 'active' && voteLogAgendaId && (
                            <Button size="sm" variant="danger" onClick={async () => {
                                await api.trashVoteLogs(voteLogAgendaId);
                                toast.success('휴지통으로 이동 (3개월 후 자동 삭제)');
                                refreshLogs();
                            }}>🗑️ 휴지통</Button>
                        )}
                        {logStatus === 'trashed' && voteLogAgendaId && (
                            <Button size="sm" variant="secondary" onClick={async () => {
                                await api.restoreVoteLogs(voteLogAgendaId);
                                toast.success('복원 완료');
                                refreshLogs();
                            }}>♻️ 복원</Button>
                        )}
                    </div>

                    {voteLogs.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">로그가 없습니다</p>
                    ) : (
                        <div className="max-h-96 overflow-y-auto border border-border/30 rounded-md">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 sticky top-0">
                                    <tr>
                                        <th className="text-left p-2">안건명</th>
                                        <th className="text-left p-2">투표시간</th>
                                        <th className="text-left p-2">브라우저ID</th>
                                        <th className="text-left p-2">선택내용</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {voteLogs.map((log: any) => (
                                        <tr key={log.id} className="border-t border-border/20">
                                            <td className="p-2">{log.agendaTitle}</td>
                                            <td className="p-2 text-muted-foreground">{new Date(log.votedAt).toLocaleString('ko-KR')}</td>
                                            <td className="p-2 font-mono text-xs text-muted-foreground">{log.voterBrowserId}</td>
                                            <td className="p-2 font-semibold">{log.choice}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
}
