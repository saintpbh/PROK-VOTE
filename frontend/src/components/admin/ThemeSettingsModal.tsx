'use client';

import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface ThemeSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    sessionId: string;
    initialStadiumTheme?: string;
    initialVoterTheme?: string;
    initialEntryMode?: 'UNIQUE_QR' | 'GLOBAL_LINK';
    initialAllowAnonymous?: boolean;
    initialStrictDeviceCheck?: boolean;
    onUpdate?: (settings: any) => void;
}

const STADIUM_THEMES = [
    { id: 'classic', name: '🟣 클래식 (기본)', desc: '보라색 기반의 깔끔한 기본 테마', color: '#8B5CF6' },
    { id: 'serious', name: '🌑 진중함 (Serious)', desc: '무게감 있는 네이비와 슬레이트 톤', color: '#1E3A8A' },
    { id: 'trust', name: '🔵 신뢰도 (Trust)', desc: '전문적인 블루와 신뢰감을 주는 색상', color: '#2563EB' },
    { id: 'fancy', name: '✨ 팬시함 (Fancy)', desc: '화려한 그라데이션과 시선을 끄는 테마', color: '#C026D3' },
    { id: 'modern', name: '🟢 세련됨 (Modern)', desc: '에메랄드와 블랙의 미니멀한 구성', color: '#10B981' },
    { id: 'vibrant', name: '🔥 열정 (Vibrant)', desc: '에너지 넘치는 오렌지와 레드 톤', color: '#F97316' },
    { id: 'elegant', name: '🏛️ 품격 (Elegant)', desc: '중후한 레드와 골드의 권위 있는 테마', color: '#991B1B' },
    { id: 'eco', name: '🌿 안정감 (Eco)', desc: '숲을 닮은 그린과 차분한 조화', color: '#15803D' },
];

const VOTER_THEMES = [...STADIUM_THEMES];

export default function ThemeSettingsModal({
    isOpen,
    onClose,
    sessionId,
    initialStadiumTheme = 'classic',
    initialVoterTheme = 'classic',
    initialEntryMode = 'UNIQUE_QR',
    initialAllowAnonymous = true,
    initialStrictDeviceCheck = true,
    onUpdate
}: ThemeSettingsModalProps) {
    const [stadiumTheme, setStadiumTheme] = useState(initialStadiumTheme);
    const [voterTheme, setVoterTheme] = useState(initialVoterTheme);
    const [entryMode, setEntryMode] = useState(initialEntryMode);
    const [allowAnonymous, setAllowAnonymous] = useState(initialAllowAnonymous);
    const [strictDeviceCheck, setStrictDeviceCheck] = useState(initialStrictDeviceCheck);
    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
        setLoading(true);
        try {
            const res = await api.updateSessionSettings(sessionId, {
                stadiumTheme,
                voterTheme,
                entryMode,
                allowAnonymous,
                strictDeviceCheck
            });

            if (res.success) {
                toast.success('테마 설정이 저장 및 적용되었습니다');
                if (onUpdate) onUpdate(res.session);
                onClose();
            }
        } catch (error: any) {
            toast.error('설정 저장에 실패했습니다');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="📽️ 전광판 및 투표 화면 설정" size="xl">
            <div className="space-y-8">
                {/* Entry Mode Settings */}
                <section>
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        🔑 접속 방식 설정
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div
                            className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${entryMode === 'UNIQUE_QR' ? 'border-primary bg-primary/10' : 'border-white/5 bg-white/5 opacity-70'}`}
                            onClick={() => setEntryMode('UNIQUE_QR')}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-xl">🎫</span>
                                <span className="font-bold">개별 QR 코드</span>
                            </div>
                            <p className="text-xs text-muted-foreground">보안이 가장 강력하며, 1인 1개별 QR을 배포합니다.</p>
                        </div>
                        <div
                            className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${entryMode === 'GLOBAL_LINK' ? 'border-primary bg-primary/10' : 'border-white/5 bg-white/5 opacity-70'}`}
                            onClick={() => setEntryMode('GLOBAL_LINK')}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-xl">🔗</span>
                                <span className="font-bold">공용 링크 (대규모용)</span>
                            </div>
                            <p className="text-xs text-muted-foreground">하나의 링크로 수천 명 동시 접속이 가능합니다.</p>
                        </div>
                    </div>

                    {entryMode === 'GLOBAL_LINK' && (
                        <div className="mt-4 p-4 bg-muted/30 rounded-lg border border-dashed border-primary/30">
                            <p className="text-sm font-medium mb-3">📍 공용 접속 정보</p>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between p-2 bg-background rounded border border-border">
                                    <span className="text-xs font-mono break-all pr-4">
                                        {window.location.origin}/join/{sessionId}
                                    </span>
                                    <Button size="sm" variant="ghost" onClick={() => {
                                        navigator.clipboard.writeText(`${window.location.origin}/join/${sessionId}`);
                                        toast.success('링크가 복사되었습니다');
                                    }}>복사</Button>
                                </div>
                                <div className="flex items-center gap-3 mt-4">
                                    <input
                                        type="checkbox"
                                        id="allowAnonymous"
                                        checked={allowAnonymous}
                                        onChange={(e) => setAllowAnonymous(e.target.checked)}
                                        className="w-5 h-5 rounded"
                                    />
                                    <label htmlFor="allowAnonymous" className="text-sm font-medium cursor-pointer">
                                        이름 입력 허용 (익명 투표인 경우 체크)
                                    </label>
                                </div>
                                <div className="flex items-center gap-3 mt-2">
                                    <input
                                        type="checkbox"
                                        id="strictDeviceCheck"
                                        checked={strictDeviceCheck}
                                        onChange={(e) => setStrictDeviceCheck(e.target.checked)}
                                        className="w-5 h-5 rounded"
                                    />
                                    <label htmlFor="strictDeviceCheck" className="text-sm font-medium cursor-pointer">
                                        기기 중복 투표 방지 (Fingerprint 식별)
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}
                </section>

                <div className="h-px bg-white/5" />

                {/* Stadium Themes */}
                <section>
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        🏟️ 전광판 테마 설정
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        {STADIUM_THEMES.map((t) => (
                            <div
                                key={t.id}
                                className={`cursor-pointer p-4 rounded-xl border-2 transition-all hover:scale-[1.02] ${stadiumTheme === t.id
                                    ? 'border-primary bg-primary/10'
                                    : 'border-white/5 bg-white/5 opacity-70'
                                    }`}
                                onClick={() => setStadiumTheme(t.id)}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: t.color }} />
                                    <span className="font-bold text-sm tracking-tight">{t.name}</span>
                                </div>
                                <p className="text-[11px] text-muted-foreground leading-tight">{t.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <div className="h-px bg-white/5" />

                {/* Voter Themes */}
                <section>
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        📱 투표자 화면 테마 설정
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        {VOTER_THEMES.map((t) => (
                            <div
                                key={t.id}
                                className={`cursor-pointer p-4 rounded-xl border-2 transition-all hover:scale-[1.02] ${voterTheme === t.id
                                    ? 'border-primary bg-primary/10'
                                    : 'border-white/5 bg-white/5 opacity-70'
                                    }`}
                                onClick={() => setVoterTheme(t.id)}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: t.color }} />
                                    <span className="font-bold text-sm tracking-tight">{t.name}</span>
                                </div>
                                <p className="text-[11px] text-muted-foreground leading-tight">{t.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <div className="flex gap-3 pt-4">
                    <Button variant="ghost" onClick={onClose} fullWidth>취소</Button>
                    <Button onClick={handleSave} loading={loading} fullWidth>설정 적용하기</Button>
                </div>
            </div>
        </Modal>
    );
}
