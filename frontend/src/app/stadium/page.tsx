'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import CountUpDisplay from '@/components/stadium/CountUpDisplay';
import socketService from '@/lib/socket';
import api from '@/lib/api';

type Theme = 'classic' | 'minimal' | 'warm' | 'nature' | 'royal';
type Stage = 'pending' | 'submitted' | 'voting' | 'ended' | 'announced';

const THEMES: { id: Theme; name: string; color: string }[] = [
    { id: 'classic', name: '클래식', color: 'bg-blue-600' },
    { id: 'minimal', name: '미니멀', color: 'bg-neutral-700' },
    { id: 'warm', name: '골드', color: 'bg-amber-600' },
    { id: 'nature', name: '포레스트', color: 'bg-green-700' },
    { id: 'royal', name: '로얄', color: 'bg-purple-700' },
];

function StadiumContent() {
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('session');

    // Theme state
    const [theme, setTheme] = useState<Theme>((searchParams.get('theme') as Theme) || 'classic');
    const [showThemePicker, setShowThemePicker] = useState(false);
    const [fontScale, setFontScale] = useState(1);
    const [showSizePicker, setShowSizePicker] = useState(false);

    // Data state
    const [stats, setStats] = useState<any>(null);
    const [agendaTitle, setAgendaTitle] = useState('');
    const [currentStage, setCurrentStage] = useState<Stage>('pending');
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [accessCode, setAccessCode] = useState<string | null>(null);
    const [sessionName, setSessionName] = useState<string | null>('');

    // UI Control state
    const [forceShowLogo, setForceShowLogo] = useState(false);
    const [forcePending, setForcePending] = useState(false);
    const isResetRef = useRef(false); // Tracks manual reset — survives re-renders and closures

    const refreshState = async () => {
        if (!sessionId) return;
        // Skip restoring old results when manually reset
        if (isResetRef.current) return;

        try {
            const sessionRes = await api.getSession(sessionId);
            if (sessionRes.success) {
                setSessionName(sessionRes.session.title || sessionRes.session.name);
                if (sessionRes.session.logoUrl) {
                    setLogoUrl(sessionRes.session.logoUrl);
                }
                if (sessionRes.session.accessCode) {
                    setAccessCode(sessionRes.session.accessCode);
                }
                if (sessionRes.session.stadiumTheme) {
                    setTheme(sessionRes.session.stadiumTheme as Theme);
                }
            }

            const sessionData = await api.getSessionAgendas(sessionId);
            const agendas = sessionData.agendas || [];

            let activeAgenda = agendas.find((a: any) => a.stage === 'voting');
            if (!activeAgenda) {
                activeAgenda = agendas.find((a: any) => a.stage === 'submitted');
            }
            // Only restore announced/ended agendas if NOT in reset state
            if (!activeAgenda && !isResetRef.current) {
                const reversedAgendas = [...agendas].reverse();
                activeAgenda = reversedAgendas.find((a: any) => a.stage === 'announced' || a.stage === 'ended');
            }

            if (activeAgenda) {
                setAgendaTitle(activeAgenda.title);
                setCurrentStage(activeAgenda.stage as Stage);
                setForcePending(false);

                if (activeAgenda.stage === 'submitted') {
                    setStats({
                        ...activeAgenda,
                        title: activeAgenda.title,
                        description: activeAgenda.description,
                        type: activeAgenda.type,
                    });
                } else {
                    socketService.emit('stats:request', { agendaId: activeAgenda.id });
                }
            } else {
                setAgendaTitle('회의 진행 중');
                setCurrentStage('pending');
                setForcePending(true);
            }
        } catch (error) {
            console.error('Failed to fetch state:', error);
        }
    };

    useEffect(() => {
        if (sessionId) {
            refreshState();

            socketService.connect();
            socketService.joinSession(sessionId, undefined, 'display');

            socketService.on('connect', () => {
                refreshState();
            });

            socketService.on('stats:updated', (data) => {
                // Ignore stats updates during reset
                if (isResetRef.current) return;
                setStats((prev: any) => ({ ...prev, ...data }));
            });

            socketService.on('stats:response', (data) => {
                // Ignore stats responses during reset
                if (isResetRef.current) return;
                setStats((prev: any) => ({ ...prev, ...data }));
                setAgendaTitle(data.title);
            });

            socketService.on('result:published', ({ stats: publishedStats }) => {
                // New result published — exit reset state
                isResetRef.current = false;
                setStats(publishedStats);
                setAgendaTitle(publishedStats.title);
                setCurrentStage('announced');
                setForcePending(false);
            });

            socketService.on('stage:changed', ({ stage, agendaId }) => {
                setCurrentStage(stage as Stage);
                setForcePending(false);
                // New vote started — exit reset state
                isResetRef.current = false;

                if (stage === 'submitted' || stage === 'voting') {
                    socketService.emit('stats:request', { agendaId });
                }
            });

            socketService.on('vote:ended', ({ agendaId }) => {
                setCurrentStage('ended');
            });

            socketService.on('session:settings:update', (settings) => {
                if (settings.stadiumTheme) {
                    setTheme(settings.stadiumTheme as Theme);
                }
                if (settings.accessCode) {
                    setAccessCode(settings.accessCode);
                }
            });

            socketService.on('stadium:control', ({ action }) => {
                if (action === 'show_logo') {
                    setForceShowLogo(true);
                    setForcePending(false);
                } else if (action === 'reset') {
                    isResetRef.current = true; // Lock — prevent old data restoration
                    setForceShowLogo(false);
                    setForcePending(true);
                    setStats(null);
                    setAgendaTitle('회의 진행 중');
                    setCurrentStage('pending');
                }
            });

            return () => {
                socketService.off('connect');
                socketService.off('stats:updated');
                socketService.off('stats:response');
                socketService.off('result:published');
                socketService.off('stage:changed');
                socketService.off('vote:ended');
                socketService.off('session:settings:update');
                socketService.off('stadium:control');
            };
        }
    }, [sessionId]);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    const isPending = forcePending || (currentStage === 'pending' && !stats);

    return (
        <div className="relative min-h-screen w-full overflow-hidden font-sans selection:bg-primary/30" data-theme={theme}
            style={{ backgroundColor: `rgb(var(--background))`, color: `rgb(var(--foreground))` }}>

            {/* Background */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] animate-pulse-slow"
                    style={{ backgroundColor: `rgba(var(--primary), 0.15)` }} />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] animate-pulse-slow"
                    style={{ backgroundColor: `rgba(var(--primary), 0.08)`, animationDelay: '1s' }} />
            </div>

            {/* Top Bar */}
            <header className="relative z-10 w-full px-10 py-6 flex justify-between items-center">
                <div className="flex items-center space-x-4">
                    {logoUrl ? (
                        <img src={`${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3011')}${logoUrl}`}
                            alt="Logo" className="h-14 w-auto object-contain drop-shadow-lg" />
                    ) : (
                        <h1 className="text-2xl font-black tracking-tighter text-white">PROK VOTE</h1>
                    )}
                </div>

                {/* Access Code */}
                {accessCode && (
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-medium opacity-50">참여 코드</span>
                        <div className="px-5 py-2 rounded-lg border border-white/10"
                            style={{ backgroundColor: `rgba(var(--primary), 0.15)` }}>
                            <span className="text-3xl font-mono font-bold tracking-[0.3em]"
                                style={{ color: `rgb(var(--primary))` }}>{accessCode}</span>
                        </div>
                    </div>
                )}
            </header>

            {/* Main Content */}
            <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 w-full mx-auto overflow-hidden"
                style={{ minHeight: 'calc(100vh - 100px)', transform: fontScale > 1 ? `scale(${fontScale})` : undefined, transformOrigin: 'center center' }}>

                {/* ===== PENDING / LOGO ===== */}
                {(isPending || forceShowLogo) && (
                    <div className="flex flex-col items-center justify-center space-y-6 animate-fade-in">
                        {logoUrl && (
                            <div className="relative">
                                <div className="absolute inset-0 bg-white/10 blur-3xl rounded-full" />
                                <img
                                    src={`${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3011')}${logoUrl}`}
                                    alt="Logo"
                                    className="relative max-h-[30vh] object-contain drop-shadow-2xl"
                                />
                            </div>
                        )}
                        <div className="text-center space-y-3">
                            <h2 className="text-8xl font-black text-white tracking-tight drop-shadow-xl">
                                {sessionName || 'PROK VOTE'}
                            </h2>
                            <div className="inline-flex items-center space-x-3 px-5 py-2.5 rounded-full border border-white/10"
                                style={{ backgroundColor: `rgba(var(--surface), 0.5)` }}>
                                <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                                        style={{ backgroundColor: `rgb(var(--success))` }}></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3"
                                        style={{ backgroundColor: `rgb(var(--success))` }}></span>
                                </span>
                                <span className="text-2xl font-light tracking-wide opacity-60">회의 진행 중</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* ===== SUBMITTED (안건 소개) ===== */}
                {(!isPending && !forceShowLogo && currentStage === 'submitted' && stats) && (
                    <div className="w-full max-w-6xl mx-auto flex flex-col items-center text-center animate-slide-in-bottom">
                        <div className="mb-4 px-5 py-2 rounded-full text-lg font-bold tracking-widest"
                            style={{ backgroundColor: `rgba(var(--primary), 0.2)`, color: `rgb(var(--primary))`, border: `1px solid rgba(var(--primary), 0.3)` }}>
                            새 안건
                        </div>
                        <h1 className="text-8xl md:text-9xl font-black text-white leading-tight mb-4 drop-shadow-2xl max-w-6xl break-keep">
                            {stats.title}
                        </h1>
                        <div className="w-full h-px mb-6" style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.15), transparent)' }} />
                        {stats.description && (
                            <div className="p-8 rounded-3xl max-w-5xl w-full shadow-2xl border border-white/10"
                                style={{ backgroundColor: `rgba(var(--surface), 0.5)` }}>
                                <p className="text-4xl leading-relaxed font-light break-keep whitespace-pre-wrap opacity-90">
                                    {stats.description}
                                </p>
                            </div>
                        )}
                        <p className="mt-8 text-3xl animate-pulse font-medium opacity-50">투표 시작 대기 중...</p>
                    </div>
                )}

                {/* ===== VOTING (투표 진행 중) ===== */}
                {(!isPending && !forceShowLogo && currentStage === 'voting' && stats) && (
                    <div className="w-full flex flex-col items-center justify-center animate-fade-in">
                        <div className="absolute top-0 left-0 right-0 h-1.5 animate-gradient-x"
                            style={{ background: `linear-gradient(to right, rgb(var(--success)), rgb(var(--primary)), rgb(var(--accent)))` }} />

                        <h2 className="text-5xl font-semibold mb-8 opacity-60">{stats.title}</h2>

                        <div className="relative">
                            <div className="absolute inset-0 rounded-full blur-[80px] animate-pulse-slow"
                                style={{ backgroundColor: `rgba(var(--primary), 0.25)` }} />
                            <div className="relative w-[380px] h-[380px] rounded-full border-[6px] border-white/5 flex flex-col items-center justify-center shadow-2xl overflow-hidden"
                                style={{ backgroundColor: `rgba(var(--surface), 0.5)` }}>
                                <div className="absolute inset-0 border-[6px] rounded-full animate-spin-slow-reverse opacity-30"
                                    style={{ borderColor: `rgb(var(--primary)) transparent transparent transparent` }} />
                                <div className="text-[10rem] font-black tabular-nums text-white drop-shadow-lg leading-none">
                                    {stats.totalVotes || 0}
                                </div>
                                <div className="text-2xl font-bold mt-2 tracking-widest"
                                    style={{ color: `rgb(var(--primary))` }}>투표 수</div>
                            </div>
                        </div>

                        <div className="mt-8 text-3xl font-light text-white animate-bounce-slight opacity-70">
                            투표가 진행 중입니다
                        </div>
                    </div>
                )}

                {/* ===== ENDED (투표 종료) ===== */}
                {(!isPending && !forceShowLogo && currentStage === 'ended') && (
                    <div className="flex flex-col items-center justify-center animate-scale-in">
                        <div className="rounded-full p-8 mb-8 border"
                            style={{ backgroundColor: `rgba(var(--danger), 0.15)`, borderColor: `rgba(var(--danger), 0.3)` }}>
                            <svg className="w-28 h-28" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                style={{ color: `rgb(var(--danger))` }}>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                            </svg>
                        </div>
                        <h2 className="text-8xl font-black text-white drop-shadow-2xl mb-4">투표 종료</h2>
                        <p className="text-3xl font-light opacity-50">결과 집계 중...</p>
                    </div>
                )}

                {/* ===== ANNOUNCED (결과 발표) ===== */}
                {(!isPending && !forceShowLogo && currentStage === 'announced' && stats) && (
                    <div className="w-full max-w-[95vw] mx-auto animate-slide-in-bottom flex flex-col">
                        <div className="text-center mb-6">
                            <h2 className="text-7xl font-bold text-white mb-2">{stats.title}</h2>
                            <span className="px-5 py-1.5 rounded-full text-lg font-bold tracking-wider border"
                                style={{ backgroundColor: `rgba(var(--success), 0.15)`, color: `rgb(var(--success))`, borderColor: `rgba(var(--success), 0.25)` }}>
                                최종 결과
                            </span>
                        </div>

                        {/* 찬반 결과 */}
                        {(!stats.type || stats.type === 'PROS_CONS') && (
                            <div className="flex-1 flex items-center justify-center gap-8 md:gap-16">
                                <CountUpDisplay title="찬성" value={stats.approveCount || 0} color="from-success/20 to-success/30" borderColor="border-success/50" icon="check" />
                                <CountUpDisplay title="반대" value={stats.rejectCount || 0} color="from-danger/20 to-danger/30" borderColor="border-danger/50" icon="x" />
                                <CountUpDisplay title="기권" value={stats.abstainCount || 0} color="from-muted/20 to-muted/30" borderColor="border-muted/50" icon="minus" />
                            </div>
                        )}

                        {/* 선택형 결과 (단일선택) */}
                        {stats.type === 'MULTIPLE_CHOICE' && (
                            <div className="grid grid-cols-1 gap-6 w-full max-w-5xl mx-auto">
                                {stats.options && stats.options.map((option: string, index: number) => {
                                    const count = stats.voteCounts ? (stats.voteCounts[option] || 0) : 0;
                                    const total = stats.totalVotes || 0;
                                    const percentage = total > 0 ? (count / total) * 100 : 0;
                                    const isWinner = percentage === Math.max(...stats.options.map((o: string) => (total > 0 ? ((stats.voteCounts?.[o] || 0) / total) * 100 : 0)));

                                    return (
                                        <div
                                            key={index}
                                            className={`relative flex items-center p-6 rounded-2xl overflow-hidden border ${isWinner ? 'shadow-lg' : 'border-white/10'}`}
                                            style={{
                                                backgroundColor: isWinner ? `rgba(var(--primary), 0.1)` : `rgba(var(--surface), 0.5)`,
                                                borderColor: isWinner ? `rgba(var(--primary), 0.4)` : undefined,
                                            }}
                                        >
                                            <div
                                                className="absolute left-0 top-0 bottom-0 transition-all duration-1000"
                                                style={{
                                                    width: `${percentage}%`,
                                                    backgroundColor: isWinner ? `rgba(var(--primary), 0.2)` : `rgba(var(--primary), 0.05)`,
                                                }}
                                            />
                                            <div className="relative z-10 flex justify-between items-center w-full">
                                                <div className="flex items-center gap-6">
                                                    <div
                                                        className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold"
                                                        style={{
                                                            backgroundColor: isWinner ? `rgb(var(--primary))` : `rgba(var(--surface), 0.5)`,
                                                            color: isWinner ? 'white' : undefined,
                                                        }}
                                                    >
                                                        {index + 1}
                                                    </div>
                                                    <span className="text-3xl font-medium truncate max-w-2xl">{option}</span>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span className="text-4xl font-black tabular-nums">{count}</span>
                                                    <span className="text-lg font-mono opacity-60">{percentage.toFixed(1)}%</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* 복수선택 결과 (MULTIPLE_CHOICE_MULTI) */}
                        {stats.type === 'MULTIPLE_CHOICE_MULTI' && (() => {
                            // Parse comma-joined voteCounts into per-option counts
                            const optionCounts: Record<string, number> = {};
                            if (stats.options) {
                                stats.options.forEach((opt: string) => { optionCounts[opt] = 0; });
                            }
                            if (stats.voteCounts) {
                                Object.entries(stats.voteCounts).forEach(([key, count]) => {
                                    // Each key may be "옵션A, 옵션B" — split and distribute
                                    const parts = key.split(',').map((s: string) => s.trim());
                                    parts.forEach((part: string) => {
                                        if (part) {
                                            optionCounts[part] = (optionCounts[part] || 0) + (count as number);
                                        }
                                    });
                                });
                            }
                            // Total individual selections (not total voters)
                            const totalSelections = Object.values(optionCounts).reduce((a, b) => a + b, 0);
                            const maxCount = Math.max(...Object.values(optionCounts), 0);

                            return (
                                <div className="grid grid-cols-1 gap-6 w-full max-w-5xl mx-auto">
                                    <div className="text-center mb-2 opacity-50 text-lg">
                                        복수선택 · 총 {stats.totalVotes || 0}명 투표
                                    </div>
                                    {(stats.options || Object.keys(optionCounts)).map((option: string, index: number) => {
                                        const count = optionCounts[option] || 0;
                                        const percentage = totalSelections > 0 ? (count / totalSelections) * 100 : 0;
                                        const isWinner = count > 0 && count === maxCount;

                                        return (
                                            <div
                                                key={index}
                                                className={`relative flex items-center p-6 rounded-2xl overflow-hidden border ${isWinner ? 'shadow-lg' : 'border-white/10'}`}
                                                style={{
                                                    backgroundColor: isWinner ? `rgba(var(--primary), 0.1)` : `rgba(var(--surface), 0.5)`,
                                                    borderColor: isWinner ? `rgba(var(--primary), 0.4)` : undefined,
                                                }}
                                            >
                                                <div
                                                    className="absolute left-0 top-0 bottom-0 transition-all duration-1000"
                                                    style={{
                                                        width: `${percentage}%`,
                                                        backgroundColor: isWinner ? `rgba(var(--primary), 0.2)` : `rgba(var(--primary), 0.05)`,
                                                    }}
                                                />
                                                <div className="relative z-10 flex justify-between items-center w-full">
                                                    <div className="flex items-center gap-6">
                                                        <div
                                                            className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold"
                                                            style={{
                                                                backgroundColor: isWinner ? `rgb(var(--primary))` : `rgba(var(--surface), 0.5)`,
                                                                color: isWinner ? 'white' : undefined,
                                                            }}
                                                        >
                                                            {isWinner ? '👑' : index + 1}
                                                        </div>
                                                        <span className="text-3xl font-medium truncate max-w-2xl">{option}</span>
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-4xl font-black tabular-nums">{count}</span>
                                                        <span className="text-lg font-mono opacity-60">{percentage.toFixed(1)}%</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}

                        {/* 텍스트 입력 결과 */}
                        {stats.type === 'INPUT' && (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 w-full auto-rows-min">
                                {stats.voteCounts && Object.entries(stats.voteCounts)
                                    .sort(([, a], [, b]) => (b as number) - (a as number))
                                    .map(([text, count], index) => (
                                        <div
                                            key={index}
                                            className="rounded-2xl p-6 border border-white/10 flex justify-between items-center"
                                            style={{ backgroundColor: `rgba(var(--surface), 0.5)` }}
                                        >
                                            <div className="text-xl font-medium truncate pr-4 opacity-90" title={text}>{text}</div>
                                            <div className="text-2xl font-bold whitespace-nowrap"
                                                style={{ color: `rgb(var(--primary))` }}>{count as number}</div>
                                        </div>
                                    ))}
                            </div>
                        )}

                        {/* 투표율 & 참여 */}
                        <div className="mt-6 flex justify-center gap-12 opacity-70">
                            <div className="text-center">
                                <div className="text-lg tracking-widest mb-1 opacity-60">투표율</div>
                                <div className="text-4xl font-bold">{(stats.turnoutPercentage || 0).toFixed(1)}%</div>
                            </div>
                            <div className="w-px bg-white/10" />
                            <div className="text-center">
                                <div className="text-lg tracking-widest mb-1 opacity-60">참여 / 전체</div>
                                <div className="text-4xl font-bold">{stats.totalVotes || 0} <span className="text-3xl opacity-50">/ {stats.totalParticipants || 0}</span></div>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Bottom Controls: Font Size + Theme Picker + Fullscreen */}
            <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-3">
                {/* Font Size Picker */}
                <div className="relative">
                    {showSizePicker && (
                        <div className="absolute bottom-14 right-0 p-3 rounded-2xl border border-white/10 shadow-2xl flex gap-2"
                            style={{ backgroundColor: `rgba(var(--card), 0.95)`, backdropFilter: 'blur(20px)' }}>
                            {[{ scale: 1, label: 'x1' }, { scale: 1.25, label: 'x2' }, { scale: 1.5, label: 'x3' }, { scale: 1.75, label: 'x4' }, { scale: 2, label: 'x5' }].map((s) => (
                                <button
                                    key={s.scale}
                                    onClick={() => { setFontScale(s.scale); setShowSizePicker(false); }}
                                    className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${fontScale === s.scale ? 'ring-2 ring-white/50 scale-105' : 'hover:bg-white/10'}`}
                                    title={`글자 크기 ${s.label}`}
                                >
                                    <span className="font-bold" style={{ fontSize: `${10 + s.scale * 5}px` }}>A</span>
                                    <span className="text-[10px] font-medium opacity-70">{s.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                    <button
                        onClick={() => { setShowSizePicker(!showSizePicker); setShowThemePicker(false); }}
                        className="p-3.5 rounded-full transition-all duration-300 border border-white/10 shadow-xl group"
                        style={{ backgroundColor: `rgba(var(--surface), 0.7)`, backdropFilter: 'blur(12px)' }}
                        title="글자 크기"
                    >
                        <svg className="w-5 h-5 text-white opacity-70 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" />
                        </svg>
                    </button>
                </div>

                {/* Theme Picker */}
                <div className="relative">
                    {showThemePicker && (
                        <div className="absolute bottom-14 right-0 p-3 rounded-2xl border border-white/10 shadow-2xl flex gap-2"
                            style={{ backgroundColor: `rgba(var(--card), 0.95)`, backdropFilter: 'blur(20px)' }}>
                            {THEMES.map((t) => (
                                <button
                                    key={t.id}
                                    onClick={() => { setTheme(t.id); setShowThemePicker(false); }}
                                    className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all ${theme === t.id ? 'ring-2 ring-white/50 scale-105' : 'hover:bg-white/10'}`}
                                    title={t.name}
                                >
                                    <div className={`w-8 h-8 rounded-full ${t.color} shadow-inner`} />
                                    <span className="text-[10px] font-medium opacity-70">{t.name}</span>
                                </button>
                            ))}
                        </div>
                    )}
                    <button
                        onClick={() => { setShowThemePicker(!showThemePicker); setShowSizePicker(false); }}
                        className="p-3.5 rounded-full transition-all duration-300 border border-white/10 shadow-xl group"
                        style={{ backgroundColor: `rgba(var(--surface), 0.7)`, backdropFilter: 'blur(12px)' }}
                        title="테마 변경"
                    >
                        <svg className="w-5 h-5 text-white opacity-70 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                        </svg>
                    </button>
                </div>

                {/* Fullscreen */}
                <button
                    onClick={() => {
                        const elem = document.documentElement;
                        if (!document.fullscreenElement) {
                            if (elem.requestFullscreen) elem.requestFullscreen();
                        } else {
                            if (document.exitFullscreen) document.exitFullscreen();
                        }
                    }}
                    className="p-3.5 rounded-full transition-all duration-300 border border-white/10 shadow-xl group"
                    style={{ backgroundColor: `rgba(var(--surface), 0.7)`, backdropFilter: 'blur(12px)' }}
                    title="전체 화면"
                >
                    <svg className="w-5 h-5 text-white opacity-70 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

export default function StadiumPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary"></div>
        </div>}>
            <StadiumContent />
        </Suspense>
    );
}
