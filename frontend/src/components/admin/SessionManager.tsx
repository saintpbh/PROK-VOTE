'use client';

import { useState, useEffect } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Card from '../ui/Card';
import Modal from '../ui/Modal';
import api from '@/lib/api';
import { useSessionStore } from '@/store/sessionStore';
import toast from 'react-hot-toast';
import ThemeSettingsModal from './ThemeSettingsModal';
import SmsManager from './SmsManager';

export default function SessionManager() {
    const [sessions, setSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showThemeModal, setShowThemeModal] = useState(false);
    const [showSmsModal, setShowSmsModal] = useState(false);
    const { currentSession, setCurrentSession } = useSessionStore();

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        gpsLat: '',
        gpsLng: '',
        gpsRadius: '100',
        gpsEnabled: true,
        strictDeviceCheck: true,
    });

    useEffect(() => {
        fetchSessions();
    }, []);

    const fetchSessions = async () => {
        setLoading(true);
        try {
            const response = await api.getAllSessions();
            setSessions(response.sessions || []);
        } catch (error: any) {
            toast.error('세션 목록을 불러오는데 실패했습니다');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!formData.name.trim()) {
            toast.error('세션 이름을 입력해주세요');
            return;
        }

        setLoading(true);
        try {
            const response = await api.createSession({
                name: formData.name,
                description: formData.description || undefined,
                gpsLat: formData.gpsLat ? parseFloat(formData.gpsLat) : undefined,
                gpsLng: formData.gpsLng ? parseFloat(formData.gpsLng) : undefined,
                gpsRadius: parseInt(formData.gpsRadius),
                gpsEnabled: formData.gpsEnabled,
                strictDeviceCheck: formData.strictDeviceCheck,
            });

            toast.success('세션이 생성되었습니다');
            setShowCreateModal(false);
            setFormData({
                name: '',
                description: '',
                gpsLat: '',
                gpsLng: '',
                gpsRadius: '100',
                gpsEnabled: true,
                strictDeviceCheck: true,
            });
            fetchSessions();
        } catch (error: any) {
            toast.error(error.message || '세션 생성에 실패했습니다');
        } finally {
            setLoading(false);
        }
    };

    const handleRefreshAccessCode = async (sessionId: string) => {
        try {
            const response = await api.updateAccessCode(sessionId);
            toast.success(`새 접속 코드: ${response.accessCode}`);
            fetchSessions();
        } catch (error: any) {
            toast.error('접속 코드 갱신에 실패했습니다');
        }
    };

    const [sessionToDelete, setSessionToDelete] = useState<any>(null);

    const getStatusBadge = (status: string) => {
        const badges = {
            pending: 'bg-muted text-muted-foreground',
            active: 'bg-success text-white',
            completed: 'bg-primary text-white',
        };
        return badges[status as keyof typeof badges] || badges.pending;
    };

    const handleDelete = async () => {
        if (!sessionToDelete) return;

        setLoading(true);
        try {
            await api.deleteSession(sessionToDelete.id);
            toast.success('세션이 삭제되었습니다');
            setSessionToDelete(null);

            // If deleted session was selected, deselect it
            if (currentSession?.id === sessionToDelete.id) {
                setCurrentSession(null);
            }

            fetchSessions();
        } catch (error: any) {
            toast.error('세션 삭제에 실패했습니다');
        } finally {
            setLoading(false);
        }
    };

    const [participantCount, setParticipantCount] = useState(0);
    const [showResetParticipantsModal, setShowResetParticipantsModal] = useState(false);

    useEffect(() => {
        if (currentSession) {
            fetchParticipantCount(currentSession.id);
        }
    }, [currentSession]);

    const fetchParticipantCount = async (sessionId: string) => {
        try {
            const res = await api.getParticipantCount(sessionId);
            if (res.success) {
                setParticipantCount(res.count);
            }
        } catch (error) {
            console.error('Failed to fetch participant count', error);
        }
    };

    const handleResetParticipants = async () => {
        if (!currentSession) return;

        setLoading(true);
        try {
            await api.resetParticipants(currentSession.id);
            toast.success('모든 참여자가 초기화되었습니다');
            setShowResetParticipantsModal(false);
            fetchParticipantCount(currentSession.id);
        } catch (error: any) {
            toast.error('참여자 리셋에 실패했습니다');
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async () => {
        if (!currentSession) return;
        try {
            const toastId = toast.loading('결과 내보내는 중...');
            await api.exportSessionResults(currentSession.id);
            toast.dismiss(toastId);
            toast.success('다운로드가 시작되었습니다');
        } catch (error) {
            toast.dismiss();
            toast.error('내보내기 실패');
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">세션 관리</h2>
                <Button onClick={() => setShowCreateModal(true)}>
                    + 새 세션 만들기
                </Button>
            </div>

            {currentSession && (
                <div className="p-4 bg-primary/10 rounded-lg border-2 border-primary/30">
                    <p className="text-sm font-medium text-primary mb-1">현재 선택된 세션</p>
                    <p className="text-lg font-bold">{currentSession.name}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                        <span className="text-xs px-2 py-1 bg-primary text-white rounded">
                            접속 코드: {currentSession.accessCode}
                        </span>
                        <span className="text-xs px-2 py-1 bg-muted text-foreground rounded">
                            GPS: {currentSession.gpsEnabled ? '활성화' : '비활성화'}
                        </span>
                        <span className="text-xs px-2 py-1 bg-muted text-foreground rounded">
                            기기 제한: {currentSession.strictDeviceCheck ? 'O' : 'X'}
                        </span>
                        <span
                            className="text-xs px-2 py-1 bg-secondary text-white rounded cursor-pointer hover:bg-secondary/90 transition-colors"
                            onClick={async () => {
                                try {
                                    const response = await api.generateToken(currentSession.id);
                                    if (response.success && response.token) {
                                        // Clear stale voter auth data to avoid session mismatch
                                        localStorage.removeItem('auth-storage');
                                        localStorage.removeItem('access_token');

                                        window.open(`/vote/${response.token}`, '_blank', 'width=450,height=800,menubar=no,toolbar=no,location=no,status=no');
                                    } else {
                                        toast.error('토큰 생성 실패');
                                    }
                                } catch (e) {
                                    toast.error('토큰 생성 중 오류가 발생했습니다');
                                }
                            }}
                        >
                            🔗 대기방 열기
                        </span>
                        <div className="flex gap-2 ml-auto">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleExport}
                            >
                                📥 결과 내보내기
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setShowThemeModal(true)}
                            >
                                🎨 테마 설정
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setShowSmsModal(true)}
                            >
                                📱 문자 투표 관리
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => window.open(`/stadium?session=${currentSession.id}`, 'stadium_display', 'width=1920,height=1080,menubar=no,toolbar=no,location=no,status=no')}
                            >
                                🏟️ 전광판 보기
                            </Button>
                        </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-primary/20">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            {/* Logo Upload */}
                            <div className="flex items-center gap-4">
                                <span className="text-sm font-medium">전광판 로고 설정:</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;

                                        try {
                                            const toastId = toast.loading('로고 업로드 중...');
                                            const res = await api.uploadSessionLogo(currentSession.id, file);
                                            toast.dismiss(toastId);

                                            if (res.success) {
                                                toast.success('로고가 설정되었습니다');
                                                setCurrentSession({ ...currentSession, logoUrl: res.logoUrl });
                                                fetchSessions();
                                            }
                                        } catch (err) {
                                            toast.dismiss();
                                            toast.error('업로드 실패');
                                        }
                                    }}
                                />
                                {currentSession.logoUrl && (
                                    <div className="text-xs text-muted-foreground">
                                        현재 로고: <a href={`${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3011')}${currentSession.logoUrl}`} target="_blank" rel="noreferrer" className="underline hover:text-primary">보기</a>
                                    </div>
                                )}
                            </div>

                            {/* Participant Management */}
                            <div className="flex items-center gap-4 bg-background/50 p-2 rounded-lg border border-border/50">
                                <div className="text-sm">
                                    <span className="text-muted-foreground mr-2">현재 참여자:</span>
                                    <span className="font-bold text-lg">{participantCount}명</span>
                                </div>
                                <Button
                                    size="sm"
                                    variant="danger"
                                    onClick={() => setShowResetParticipantsModal(true)}
                                >
                                    ⚠️ 참여자 전체 리셋
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sessions.map((session) => (
                    <Card
                        key={session.id}
                        hoverable
                        onClick={() => setCurrentSession(session)}
                        className={currentSession?.id === session.id ? 'ring-2 ring-primary' : ''}
                    >
                        <div className="space-y-3">
                            <div className="flex items-start justify-between">
                                <h3 className="font-semibold text-lg">{session.name}</h3>
                                <span
                                    className={`text-xs px-2 py-1 rounded ${getStatusBadge(
                                        session.status
                                    )}`}
                                >
                                    {session.status}
                                </span>
                            </div>

                            {session.description && (
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                    {session.description}
                                </p>
                            )}

                            <div className="space-y-2 text-sm">
                                <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                                    <span className="text-muted-foreground">접속 코드</span>
                                    <span className="font-mono font-bold text-primary">
                                        {session.accessCode}
                                    </span>
                                </div>

                                {session.gpsEnabled && (
                                    <div className="text-xs text-muted-foreground">
                                        📍 GPS 반경: {session.gpsRadius}m
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2 pt-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        window.open(`/stadium?session=${session.id}`, 'stadium_display', 'width=1920,height=1080,menubar=no,toolbar=no,location=no,status=no');
                                    }}
                                >
                                    🏟️
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRefreshAccessCode(session.id);
                                    }}
                                    fullWidth
                                >
                                    🔄 코드 갱신
                                </Button>
                                <Button
                                    size="sm"
                                    variant="danger"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSessionToDelete(session);
                                    }}
                                >
                                    🗑️ 삭제
                                </Button>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {sessions.length === 0 && !loading && (
                <div className="text-center py-12">
                    <p className="text-muted-foreground mb-4">생성된 세션이 없습니다</p>
                    <Button onClick={() => setShowCreateModal(true)}>
                        첫 세션 만들기
                    </Button>
                </div>
            )}

            <Modal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                title="새 세션 만들기"
                size="lg"
            >
                <div className="space-y-4">
                    <Input
                        label="세션 이름"
                        placeholder="예: 2024년 정기 총회"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />

                    <Input
                        label="설명 (선택사항)"
                        placeholder="세션에 대한 간단한 설명"
                        value={formData.description}
                        onChange={(e) =>
                            setFormData({ ...formData, description: e.target.value })
                        }
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="GPS 위도 (선택사항)"
                            type="number"
                            step="0.000001"
                            placeholder="37.5665"
                            value={formData.gpsLat}
                            onChange={(e) => setFormData({ ...formData, gpsLat: e.target.value })}
                        />

                        <Input
                            label="GPS 경도 (선택사항)"
                            type="number"
                            step="0.000001"
                            placeholder="126.9780"
                            value={formData.gpsLng}
                            onChange={(e) => setFormData({ ...formData, gpsLng: e.target.value })}
                        />
                    </div>

                    <Input
                        label="GPS 반경 (미터)"
                        type="number"
                        value={formData.gpsRadius}
                        onChange={(e) =>
                            setFormData({ ...formData, gpsRadius: e.target.value })
                        }
                        helperText="참가자가 이 반경 내에 있어야 합니다"
                    />

                    <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                        <input
                            type="checkbox"
                            id="gpsEnabled"
                            checked={formData.gpsEnabled}
                            onChange={(e) =>
                                setFormData({ ...formData, gpsEnabled: e.target.checked })
                            }
                            className="w-5 h-5"
                        />
                        <label htmlFor="gpsEnabled" className="text-sm cursor-pointer">
                            GPS 위치 확인 활성화
                        </label>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                        <input
                            type="checkbox"
                            id="strictDeviceCheck"
                            checked={formData.strictDeviceCheck}
                            onChange={(e) =>
                                setFormData({ ...formData, strictDeviceCheck: e.target.checked })
                            }
                            className="w-5 h-5"
                        />
                        <label htmlFor="strictDeviceCheck" className="text-sm cursor-pointer">
                            기기 중복 투표 방지 (Fingerprint 식별)
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
                            생성
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={!!sessionToDelete}
                onClose={() => setSessionToDelete(null)}
                title="⚠️ 세션 삭제 확인"
            >
                <div className="space-y-4">
                    <div className="p-4 bg-danger/10 text-danger rounded-lg">
                        <p className="font-bold">이 작업은 되돌릴 수 없습니다!</p>
                        <p className="text-sm mt-1">
                            세션 <strong>{sessionToDelete?.name}</strong>과(와) 관련된 모든 안건,
                            투표 기록, 참가자 데이터가 영구적으로 삭제됩니다.
                        </p>
                    </div>
                    <p>정말로 삭제하시겠습니까?</p>
                    <div className="flex gap-3 justify-end pt-2">
                        <Button
                            variant="ghost"
                            onClick={() => setSessionToDelete(null)}
                        >
                            취소
                        </Button>
                        <Button
                            variant="danger"
                            onClick={handleDelete}
                            loading={loading}
                        >
                            삭제하기
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Reset Participants Modal */}
            <Modal
                isOpen={showResetParticipantsModal}
                onClose={() => setShowResetParticipantsModal(false)}
                title="⚠️ 참여자 전체 리셋"
            >
                <div className="space-y-4">
                    <div className="p-4 bg-danger/10 text-danger rounded-lg">
                        <p className="font-bold text-lg">주의: 모든 참여자 로그아웃</p>
                        <p className="mt-2 text-sm leading-relaxed">
                            이 작업을 수행하면 <strong>현재 등록된 {participantCount}명의 모든 참여자 정보가 삭제</strong>됩니다.
                            모든 사용자는 다시 QR 코드를 스캔하여 입장해야 합니다.
                            <br /><br />
                            이미 완료된 투표 기록은 유지되지만, 진행 중인 투표에는 영향을 줄 수 있습니다.
                        </p>
                    </div>
                    <div className="flex gap-3 justify-end pt-4">
                        <Button
                            variant="ghost"
                            onClick={() => setShowResetParticipantsModal(false)}
                        >
                            취소
                        </Button>
                        <Button
                            variant="danger"
                            onClick={handleResetParticipants}
                            loading={loading}
                        >
                            전체 리셋 실행
                        </Button>
                    </div>
                </div>
            </Modal>

            {currentSession && (
                <ThemeSettingsModal
                    isOpen={showThemeModal}
                    onClose={() => setShowThemeModal(false)}
                    sessionId={currentSession.id}
                    initialStadiumTheme={currentSession.stadiumTheme}
                    initialVoterTheme={currentSession.voterTheme}
                    initialEntryMode={currentSession.entryMode}
                    initialAllowAnonymous={currentSession.allowAnonymous}
                    initialStrictDeviceCheck={currentSession.strictDeviceCheck}
                    onUpdate={(updatedSession) => {
                        setCurrentSession(updatedSession);
                        fetchSessions();
                    }}
                />
            )}

            {showSmsModal && currentSession && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="relative">
                            <SmsManager
                                sessionId={currentSession.id}
                                onUpdate={() => fetchParticipantCount(currentSession.id)}
                            />
                            <button
                                onClick={() => setShowSmsModal(false)}
                                className="absolute top-4 right-4 p-2 hover:bg-muted rounded-full transition-colors"
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
