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
    const isDummy = searchParams.get('dummy') === 'true';
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Theme & UI Scale state
    const [theme, setTheme] = useState<Theme>((searchParams.get('theme') as Theme) || 'classic');
    const [showThemePicker, setShowThemePicker] = useState(false);
    const [fontScale, setFontScale] = useState(1);
    const [showSizePicker, setShowSizePicker] = useState(false);
    const [codeScale, setCodeScale] = useState<'xl' | 'lg' | 'md' | 'sm' | 'hidden'>('xl');
    const [showCodeScalePicker, setShowCodeScalePicker] = useState(false);

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
    const dummyType = searchParams.get('type') || 'PROS_CONS';

    const dummyStage = searchParams.get('stage') as Stage | null;

    useEffect(() => {
        if (isDummy) {
            setSessionName('제105회 총회 모의 테스트 세션');

            // Support dummy pending/waiting room preview
            if (dummyStage === 'pending') {
                setCurrentStage('pending');
                setForcePending(true);
                setForceShowLogo(false);
                isResetRef.current = false;
                setAccessCode('1234');
                setStats(null);
                return;
            }

            setAgendaTitle(dummyType === 'MULTIPLE_CHOICE' ? '전자투표활용 동의 안건 결과 발표' : '헌법 개정안 제1조 심의 의결 결과 발표');
            setCurrentStage('announced');
            setForcePending(false);
            setForceShowLogo(false);
            isResetRef.current = false;
            
            if (dummyType === 'MULTIPLE_CHOICE') {
                setStats({
                    title: '전자투표활용 동의',
                    type: 'MULTIPLE_CHOICE',
                    totalVotes: 300,
                    options: [
                        '1. 활용한다 (참여율을 높이기 위해 다음 총회부터 모바일 및 현장 전자투표 방식을 정식 의결 수단으로 인정하고 적극 도입하는 방안)',
                        '2. 반대한다',
                        '3. 기권 및 보류 방안 마련 요구'
                    ],
                    voteCounts: {
                        '1. 활용한다 (참여율을 높이기 위해 다음 총회부터 모바일 및 현장 전자투표 방식을 정식 의결 수단으로 인정하고 적극 도입하는 방안)': 220,
                        '2. 반대한다': 50,
                        '3. 기권 및 보류 방안 마련 요구': 30
                    }
                });
            } else {
                setStats({
                    title: '헌법 개정안 제1조 심의 의결',
                    type: 'PROS_CONS',
                    totalVotes: 300,
                    approveCount: 195,
                    rejectCount: 95,
                    abstainCount: 10
                });
            }
        }
    }, [isDummy, dummyType, searchParams]);

    const refreshState = async () => {
        if (isDummy) return;
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
        if (isDummy) return;
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
                if (stage === 'submitted' || stage === 'voting' || stage === 'ended') {
                    isResetRef.current = false;
                    if (agendaId) {
                        socketService.emit('stats:request', { agendaId });
                    }
                }
            });

            socketService.on('vote:ended', ({ agendaId }) => {
                setCurrentStage('ended');
                setForcePending(false);
                isResetRef.current = false;
                if (agendaId) {
                    socketService.emit('stats:request', { agendaId });
                }
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

    const isPending = forcePending || currentStage === 'pending';

    if (!isMounted) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary"></div>
            </div>
        );
    }

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
            <header className="absolute top-0 left-0 right-0 z-20 w-full px-10 py-6 flex justify-between items-start pointer-events-none">
                <div className="flex items-center space-x-4 pointer-events-auto">
                    {logoUrl ? (
                        <img src={`${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3011')}${logoUrl}`}
                            alt="Logo" className="h-14 w-auto object-contain drop-shadow-lg" />
                    ) : (
                        <h1 className="text-2xl font-black tracking-tighter text-white">PROK VOTE</h1>
                    )}
                    {sessionName && (
                        <div className="px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-sm font-bold text-slate-200 shadow-sm backdrop-blur-md">
                            {sessionName}
                        </div>
                    )}
                </div>

                {/* Access Code — scalable on pending, compact on active stages */}
                {accessCode && codeScale !== 'hidden' && (
                    <div className="flex flex-col items-center pointer-events-auto"
                        style={{ gap: isPending ? '0.5rem' : '0.125rem', transition: 'all 0.5s ease' }}>
                        <span className="font-medium opacity-50 tracking-widest uppercase"
                            style={{
                                fontSize: isPending
                                    ? (codeScale === 'xl' ? '1.125rem' : codeScale === 'lg' ? '0.9rem' : codeScale === 'md' ? '0.75rem' : '10px')
                                    : '10px',
                                transition: 'all 0.5s ease'
                            }}>참여 코드</span>
                        <div className="rounded-2xl"
                            style={{
                                padding: isPending
                                    ? (codeScale === 'xl' ? '1.25rem 2.5rem' : codeScale === 'lg' ? '0.8rem 1.8rem' : codeScale === 'md' ? '0.5rem 1.2rem' : '0.3rem 0.8rem')
                                    : '0.25rem 0.75rem',
                                border: isPending ? '2px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.1)',
                                backgroundColor: isPending ? `rgba(var(--primary), 0.15)` : `rgba(255,255,255, 0.08)`,
                                transition: 'all 0.5s ease',
                            }}>
                            <span className="font-mono font-black leading-none"
                                style={{
                                    fontSize: isPending
                                        ? (codeScale === 'xl' ? '10rem' : codeScale === 'lg' ? '6rem' : codeScale === 'md' ? '3.8rem' : '2.2rem')
                                        : '2.5rem',
                                    letterSpacing: isPending ? '0.2em' : '0.15em',
                                    color: isPending ? `rgb(var(--primary))` : 'rgba(255,255,255,0.85)',
                                    transition: 'all 0.5s ease',
                                }}>{accessCode}</span>
                        </div>
                    </div>
                )}
            </header>

            {/* Main Content */}
            <main className={`relative z-10 min-h-screen flex flex-col items-center justify-center pt-24 pb-16 px-6 w-full mx-auto overflow-hidden`}
                style={{ transform: fontScale > 1 ? `scale(${fontScale})` : undefined, transformOrigin: 'center center' }}>

                {/* ===== PENDING / LOGO ===== */}
                {(isPending || forceShowLogo) && (
                    <div className="flex flex-col items-center justify-center space-y-6 animate-fade-in max-w-5xl text-center px-4 my-auto">
                        {logoUrl && (
                            <div className="relative">
                                <div className="absolute inset-0 bg-white/10 blur-3xl rounded-full" />
                                <img
                                    src={`${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3011')}${logoUrl}`}
                                    alt="Logo"
                                    className="relative max-h-[25vh] object-contain drop-shadow-2xl"
                                />
                            </div>
                        )}
                        <div className="text-center space-y-5">
                            <div className="inline-flex items-center space-x-2.5 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-sm font-semibold tracking-wider text-primary">
                                <span className="relative flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
                                </span>
                                <span>[대기 단계] 회의 진행 중</span>
                            </div>
                            <h2 className="text-5xl md:text-7xl font-black text-white tracking-tight drop-shadow-xl break-keep leading-tight max-w-4xl">
                                {agendaTitle && agendaTitle !== '회의 진행 중' ? agendaTitle : '투표 대기 중'}
                            </h2>
                            <p className="text-xl text-white/60 font-light tracking-wide">
                                회의 주최자가 안건을 상정하면 화면이 자동으로 전환됩니다.
                            </p>
                        </div>
                    </div>
                )}

                {/* ===== SUBMITTED (안건 상정 / 준비) ===== */}
                {(!isPending && !forceShowLogo && currentStage === 'submitted' && stats) && (
                    <div className="w-full max-w-5xl mx-auto flex flex-col items-center text-center animate-slide-in-bottom my-auto space-y-6">
                        <div className="px-5 py-2 rounded-full text-base md:text-lg font-bold tracking-widest bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-lg">
                            [안건 상정] 투표 시작 대기
                        </div>
                        <h1 className="text-5xl md:text-7xl font-black text-white leading-tight drop-shadow-2xl max-w-5xl break-keep">
                            {stats.title}
                        </h1>
                        <div className="w-full max-w-3xl h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.2), transparent)' }} />
                        {stats.description && (
                            <div className="p-6 md:p-8 rounded-3xl max-w-4xl w-full shadow-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl">
                                <p className="text-2xl md:text-3xl leading-relaxed font-light break-keep whitespace-pre-wrap opacity-90 text-slate-100">
                                    {stats.description}
                                </p>
                            </div>
                        )}
                        <p className="text-2xl animate-pulse font-medium text-amber-400/80 pt-2">
                            곧 투표가 개시됩니다. 전광판과 연결된 기기를 준비해주세요.
                        </p>
                    </div>
                )}

                {/* ===== VOTING (투표 진행 중) ===== */}
                {(!isPending && !forceShowLogo && currentStage === 'voting' && stats) && (
                    <div className="w-full flex flex-col items-center justify-center animate-fade-in my-auto space-y-6">
                        <div className="absolute top-0 left-0 right-0 h-1.5 animate-gradient-x"
                            style={{ background: `linear-gradient(to right, rgb(var(--success)), rgb(var(--primary)), rgb(var(--accent)))` }} />

                        <div className="px-5 py-2 rounded-full text-base md:text-lg font-bold tracking-widest bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-lg flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-blue-400 animate-ping" />
                            <span>[투표 진행 중] 참여 코드로 인증 후 투표하세요</span>
                        </div>

                        <h2 className="text-4xl md:text-6xl font-black text-white max-w-5xl text-center leading-tight break-keep drop-shadow-lg">
                            {stats.title}
                        </h2>

                        <div className="relative pt-4">
                            <div className="absolute inset-0 rounded-full blur-[80px] animate-pulse-slow"
                                style={{ backgroundColor: `rgba(var(--primary), 0.25)` }} />
                            <div className="relative w-[300px] h-[300px] md:w-[360px] md:h-[360px] rounded-full border-[6px] border-white/10 flex flex-col items-center justify-center shadow-2xl overflow-hidden bg-slate-900/70 backdrop-blur-2xl">
                                <div className="absolute inset-0 border-[6px] rounded-full animate-spin-slow-reverse opacity-30"
                                    style={{ borderColor: `rgb(var(--primary)) transparent transparent transparent` }} />
                                <div className="text-8xl md:text-[9rem] font-black tabular-nums text-white drop-shadow-lg leading-none">
                                    {stats.totalVotes || 0}
                                </div>
                                <div className="text-xl md:text-2xl font-bold mt-2 tracking-widest text-primary">투표 참여 수</div>
                            </div>
                        </div>

                        <div className="text-2xl font-light text-white/80 animate-bounce-slight pt-2">
                            투표가 활발히 진행 중입니다
                        </div>
                    </div>
                )}

                {/* ===== ENDED (투표 종료) ===== */}
                {(!isPending && !forceShowLogo && currentStage === 'ended') && (
                    <div className="w-full max-w-5xl mx-auto flex flex-col items-center justify-center text-center animate-scale-in my-auto space-y-8">
                        {/* 1. 안건 제목 */}
                        {(stats?.title || agendaTitle) && (
                            <div className="space-y-3">
                                <span className="px-5 py-2 rounded-full text-base font-extrabold tracking-widest bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-lg">
                                    [상정 안건]
                                </span>
                                <h1 className="text-4xl md:text-6xl font-black text-white drop-shadow-2xl leading-tight break-keep max-w-4xl pt-2">
                                    {stats?.title || agendaTitle}
                                </h1>
                            </div>
                        )}

                        {/* 2. 대형 투표 종료 안내 카드 */}
                        <div className="p-10 md:p-14 rounded-3xl border-2 border-rose-500 bg-rose-950/60 backdrop-blur-2xl shadow-[0_0_90px_rgba(244,63,94,0.4)] flex flex-col items-center space-y-6 max-w-3xl w-full">
                            <div className="rounded-full p-6 border-2 border-rose-400/60 bg-rose-500/20 animate-pulse">
                                <svg className="w-20 h-20 md:w-28 md:h-28 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            <div className="space-y-4 text-center">
                                <h2 className="text-6xl md:text-8xl font-black text-white tracking-tight drop-shadow-2xl">
                                    투표 종료
                                </h2>
                                <p className="text-2xl md:text-3xl font-extrabold text-rose-300/90 animate-pulse pt-2">
                                    투표가 마감되었습니다. 집계 완료 후 결과를 발표합니다.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ===== ANNOUNCED (결과 발표) ===== */}
                {(!isPending && !forceShowLogo && currentStage === 'announced' && stats) && (
                    <div className="w-full max-w-[95vw] mx-auto animate-slide-in-bottom flex flex-col">
                        <div className="text-center mt-1.5 mb-8">
                            <h2 className="text-7xl font-black text-white mb-2 tracking-tight">{stats.title}</h2>
                            <span className="px-6 py-2 rounded-full text-xl font-bold tracking-wider border shadow-glow"
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
                            <div className="grid grid-cols-1 gap-6 w-full max-w-6xl mx-auto">
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
                                                    <span className="text-4xl font-semibold whitespace-normal break-all pr-4">{option}</span>
                                                </div>
                                                <div className="flex items-baseline gap-2 shrink-0">
                                                    <span className="text-6xl font-black tabular-nums">{count}</span>
                                                    <span className="text-5xl font-mono text-orange-500">
                                                        ({percentage.toFixed(1)}%)
                                                    </span>
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
                                <div className="grid grid-cols-1 gap-6 w-full max-w-6xl mx-auto">
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
                                                        <span className="text-4xl font-semibold whitespace-normal break-all pr-4">{option}</span>
                                                    </div>
                                                    <div className="flex items-baseline gap-2 shrink-0">
                                                        <span className="text-6xl font-black tabular-nums">{count}</span>
                                                        <span className="text-5xl font-mono text-orange-500">
                                                            ({percentage.toFixed(1)}%)
                                                        </span>
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
                        <div className="mt-12 flex justify-center gap-20 p-6 rounded-3xl border border-white/5 shadow-2xl w-full max-w-2xl mx-auto"
                            style={{ backgroundColor: `rgba(var(--surface), 0.3)`, backdropFilter: 'blur(10px)' }}>
                            <div className="text-center">
                                <div className="text-xl tracking-widest mb-2 opacity-60 font-medium">투표율</div>
                                <div className="text-6xl font-black" style={{ color: `rgb(var(--primary))` }}>
                                    {(stats.turnoutPercentage || 0).toFixed(1)}%
                                </div>
                            </div>
                            <div className="w-px bg-white/10" />
                            <div className="text-center">
                                <div className="text-xl tracking-widest mb-2 opacity-60 font-medium">참여 / 전체</div>
                                <div className="text-6xl font-black text-white">
                                    {stats.totalVotes || 0} <span className="text-4xl opacity-40 font-bold">/ {stats.totalParticipants || 0}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Bottom Controls: Font Size + Theme Picker + Access Code Scale + Fullscreen */}
            <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-3">
                {/* Access Code Size Picker */}
                <div className="relative">
                    {showCodeScalePicker && (
                        <div className="absolute bottom-14 right-0 p-3 rounded-2xl border border-white/10 shadow-2xl flex gap-2 z-[110]"
                            style={{ backgroundColor: `rgba(var(--card), 0.95)`, backdropFilter: 'blur(20px)' }}>
                            {[
                                { id: 'xl', label: '100% (매우큼)' },
                                { id: 'lg', label: '70% (크게)' },
                                { id: 'md', label: '40% (보통)' },
                                { id: 'sm', label: '20% (작게)' },
                                { id: 'hidden', label: '숨기기' }
                            ].map((s) => (
                                <button
                                    key={s.id}
                                    onClick={() => { setCodeScale(s.id as any); setShowCodeScalePicker(false); }}
                                    className={`flex flex-col items-center gap-1 px-2.5 py-2 rounded-xl transition-all ${codeScale === s.id ? 'ring-2 ring-white/50 bg-white/15 scale-105' : 'hover:bg-white/10'}`}
                                    title={`참여코드 크기: ${s.label}`}
                                >
                                    <span className="font-mono font-black text-xs text-primary">#8901</span>
                                    <span className="text-[10px] font-medium opacity-80 whitespace-nowrap">{s.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                    <button
                        onClick={() => { setShowCodeScalePicker(!showCodeScalePicker); setShowSizePicker(false); setShowThemePicker(false); }}
                        className={`p-3.5 rounded-full transition-all duration-300 border border-white/10 shadow-xl group ${showCodeScalePicker ? 'ring-2 ring-primary' : ''}`}
                        style={{ backgroundColor: `rgba(var(--surface), 0.7)`, backdropFilter: 'blur(12px)' }}
                        title="참여코드 크기 조절"
                    >
                        <svg className="w-5 h-5 text-white opacity-70 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                        </svg>
                    </button>
                </div>

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
                        onClick={() => { setShowSizePicker(!showSizePicker); setShowThemePicker(false); setShowCodeScalePicker(false); }}
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
