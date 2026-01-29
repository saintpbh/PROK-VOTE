'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import CountUpDisplay from '@/components/stadium/CountUpDisplay';
import socketService from '@/lib/socket';
import api from '@/lib/api';

type Theme = 'classic' | 'serious' | 'trust' | 'fancy' | 'modern' | 'vibrant' | 'elegant' | 'eco';
type Stage = 'pending' | 'submitted' | 'voting' | 'ended' | 'announced';

function StadiumContent() {
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('session');

    // Theme state
    const [theme, setTheme] = useState<Theme>((searchParams.get('theme') as Theme) || 'classic');

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

    const refreshState = async () => {
        if (!sessionId) return;

        try {
            // Fetch session details
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

            // Priority: voting > submitted > announced (newest) > ended (newest)
            let activeAgenda = agendas.find((a: any) => a.stage === 'voting');

            if (!activeAgenda) {
                activeAgenda = agendas.find((a: any) => a.stage === 'submitted');
            }

            if (!activeAgenda) {
                const reversedAgendas = [...agendas].reverse();
                activeAgenda = reversedAgendas.find((a: any) => a.stage === 'announced' || a.stage === 'ended');
            }

            if (activeAgenda) {
                console.log('[Stadium] Active agenda found:', activeAgenda.title, activeAgenda.stage);
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
                console.log('[Stadium] No active agenda found');
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

            // Connect to WebSocket
            // Important: Call joinSession AFTER ensuring connection or letting the service handle queueing
            socketService.connect();
            socketService.joinSession(sessionId, undefined, 'display');

            // Listeners
            socketService.on('connect', () => {
                console.log('[Stadium] Socket connected/reconnected. Refreshing state...');
                refreshState();
            });

            socketService.on('stats:updated', (data) => {
                console.log('[Stadium] stats:updated received');
                setStats(data);
            });

            socketService.on('stats:response', (data) => {
                console.log('[Stadium] stats:response received:', data.title);
                setStats(data);
                setAgendaTitle(data.title);
            });

            socketService.on('result:published', ({ stats: publishedStats }) => {
                console.log('[Stadium] result:published received');
                setStats(publishedStats);
                setAgendaTitle(publishedStats.title);
                setCurrentStage('announced');
                setForcePending(false);
            });

            socketService.on('stage:changed', ({ stage, agendaId }) => {
                // Ensure we handle stage updates instantly
                console.log('[Stadium] stage:changed received:', stage, agendaId);
                setCurrentStage(stage as Stage);
                setForcePending(false);

                if (stage === 'submitted' || stage === 'voting') {
                    console.log('[Stadium] Requesting stats for:', agendaId);
                    socketService.emit('stats:request', { agendaId });
                }
            });

            socketService.on('vote:ended', ({ agendaId }) => {
                console.log('[Stadium] vote:ended received');
                setCurrentStage('ended');
            });

            socketService.on('session:settings:update', (settings) => {
                console.log('[Stadium] session:settings:update received:', settings);
                if (settings.stadiumTheme) {
                    console.log(`[Stadium] Applying new theme: ${settings.stadiumTheme}`);
                    setTheme(settings.stadiumTheme as Theme);
                }
            });

            socketService.on('stadium:control', ({ action }) => {
                if (action === 'show_logo') {
                    setForceShowLogo(true);
                    setForcePending(false);
                } else if (action === 'reset') {
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
                socketService.off('stadium:control');
            };
        }
    }, [sessionId]);

    useEffect(() => {
        console.log(`[Stadium] Theme changed to: ${theme}`);
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    // Renders
    const isPending = forcePending || (currentStage === 'pending' && !stats);

    return (
        <div className="relative min-h-screen w-full overflow-hidden bg-background text-foreground font-sans selection:bg-primary/30" data-theme={theme}>
            {/* Background Effects */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px] animate-pulse-slow" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-secondary/20 rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: '1s' }} />
                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
            </div>

            {/* Top Bar: Session Info & Access Code */}
            <header className="relative z-10 w-full p-8 flex justify-between items-start">
                <div className="flex items-center space-x-4">
                    {logoUrl ? (
                        <img src={`${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3011')}${logoUrl}`}
                            alt="Logo" className="h-16 w-auto object-contain drop-shadow-lg" />
                    ) : (
                        <div className="flex flex-col">
                            <h1 className="text-3xl font-black tracking-tighter bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                                PROK VOTE
                            </h1>
                            <span className="text-sm text-slate-400 font-medium tracking-widest uppercase">Real-time Voting System</span>
                        </div>
                    )}
                </div>

                {/* Access Code Badge */}
                {accessCode && (
                    <div className="flex flex-col items-end">
                        <div className="text-xs text-muted-foreground font-bold uppercase tracking-widest mb-1">Access Code</div>
                        <div className="bg-white/10 backdrop-blur-md border border-white/10 px-6 py-2 rounded-lg">
                            <span className="text-4xl font-mono font-bold tracking-widest text-primary shadow-glow">{accessCode}</span>
                        </div>
                    </div>
                )}
            </header>

            {/* Main Content Area */}
            <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-8 w-full max-w-[90rem] mx-auto min-h-[70vh]">

                {/* PENDING / SHOW LOGO STATE */}
                {(isPending || forceShowLogo) && (
                    <div className="flex flex-col items-center justify-center space-y-12 animate-fade-in">
                        {logoUrl && (
                            <div className="relative">
                                <div className="absolute inset-0 bg-white/20 blur-3xl rounded-full" />
                                <img
                                    src={`${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3011')}${logoUrl}`}
                                    alt="Session Logo Big"
                                    className="relative max-h-[40vh] object-contain drop-shadow-2xl animate-bounce-slight"
                                />
                            </div>
                        )}
                        <div className="text-center space-y-4">
                            <h2 className="text-6xl font-black text-white tracking-tight drop-shadow-xl">
                                {sessionName || 'PROK VOTE'}
                            </h2>
                            <div className="inline-flex items-center space-x-3 px-6 py-3 rounded-full bg-slate-900/50 border border-white/10 backdrop-blur-sm">
                                <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                                </span>
                                <span className="text-xl text-slate-300 font-light tracking-wide uppercase">Meeting in Progress</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* SUBMITTED STATE (Agenda Intro) */}
                {(!isPending && !forceShowLogo && currentStage === 'submitted' && stats) && (
                    <div className="w-full max-w-5xl mx-auto flex flex-col items-center text-center animate-slide-in-bottom">
                        <div className="mb-6 px-4 py-1.5 rounded-full bg-primary/20 border border-primary/30 text-primary font-bold tracking-widest uppercase text-sm">
                            New Agenda
                        </div>
                        <h1 className="text-7xl md:text-8xl font-black text-white leading-tight mb-8 drop-shadow-2xl max-w-6xl break-keep">
                            {stats.title}
                        </h1>
                        <div className="w-full h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent mb-10" />
                        {stats.description && (
                            <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-10 rounded-3xl max-w-4xl w-full shadow-2xl">
                                <p className="text-3xl text-slate-200 leading-relaxed font-light break-keep whitespace-pre-wrap">
                                    {stats.description}
                                </p>
                            </div>
                        )}
                        <p className="mt-12 text-2xl text-slate-400 animate-pulse font-medium">Waiting for voting to start...</p>
                    </div>
                )}

                {/* VOTING STATE */}
                {(!isPending && !forceShowLogo && currentStage === 'voting' && stats) && (
                    <div className="w-full flex flex-col items-center justify-center animate-fade-in">
                        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-green-400 via-blue-500 to-purple-500 animate-gradient-x" />

                        <h2 className="text-4xl font-bold text-slate-300 mb-12 opacity-80">{stats.title}</h2>

                        <div className="relative group">
                            <div className="absolute inset-0 bg-primary/30 blur-[60px] rounded-full animate-pulse-slow" />
                            <div className="relative w-[500px] h-[500px] rounded-full border-[10px] border-white/5 bg-slate-900/50 backdrop-blur-sm flex flex-col items-center justify-center shadow-2xl overflow-hidden">
                                {/* Timer/Progress Ring Effect (Simplified as rotating border or similar if needed, keeping it clean for now) */}
                                <div className="absolute inset-0 border-[10px] border-t-primary border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin-slow-reverse opacity-50" />

                                <div className="text-9xl font-black tabular-nums text-white drop-shadow-lg scale-110">
                                    {stats.totalVotes || 0}
                                </div>
                                <div className="text-3xl text-primary font-bold mt-4 uppercase tracking-widest">Votes Cast</div>
                            </div>
                        </div>

                        <div className="mt-16 text-3xl font-light text-white animate-bounce-slight">
                            Voting is now open
                        </div>
                    </div>
                )}

                {/* ENDED STATE */}
                {(!isPending && !forceShowLogo && currentStage === 'ended') && (
                    <div className="flex flex-col items-center justify-center animate-scale-in">
                        <div className="rounded-full bg-red-500/20 p-8 mb-8 backdrop-blur-md border border-red-500/30">
                            <svg className="w-32 h-32 text-red-500 shadow-glow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                            </svg>
                        </div>
                        <h2 className="text-8xl font-black text-white drop-shadow-2xl mb-4">VOTE CLOSED</h2>
                        <p className="text-3xl text-slate-400 font-light">Tallying results...</p>
                    </div>
                )}

                {/* ANNOUNCED (RESULTS) STATE */}
                {(!isPending && !forceShowLogo && currentStage === 'announced' && stats) && (
                    <div className="w-full max-w-7xl mx-auto animate-slide-in-bottom flex flex-col h-full">
                        <div className="text-center mb-12">
                            <h2 className="text-5xl font-bold text-white mb-2">{stats.title}</h2>
                            <span className="px-4 py-1 rounded-full bg-green-500/20 text-green-400 text-sm font-bold uppercase tracking-wider border border-green-500/20">Official Results</span>
                        </div>

                        {/* Pros/Cons Result */}
                        {(!stats.type || stats.type === 'PROS_CONS') && (
                            <div className="flex-1 flex items-center justify-center gap-8 md:gap-16">
                                <CountUpDisplay title="Approve" value={stats.approveCount || 0} color="from-success/20 to-success/30" borderColor="border-success/50" icon="check" />
                                <CountUpDisplay title="Reject" value={stats.rejectCount || 0} color="from-danger/20 to-danger/30" borderColor="border-danger/50" icon="x" />
                                <CountUpDisplay title="Abstain" value={stats.abstainCount || 0} color="from-muted/20 to-muted/30" borderColor="border-muted/50" icon="minus" />
                            </div>
                        )}

                        {/* Multiple Choice Result */}
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
                                            className={`relative flex items-center p-6 rounded-2xl overflow-hidden border ${isWinner ? 'border-primary shadow-[0_0_30px_rgba(var(--primary),0.2)]' : 'border-white/10 backdrop-blur-md'}`}
                                            style={{
                                                backgroundColor: isWinner ? 'rgba(var(--primary), 0.1)' : 'rgba(var(--surface), 0.5)'
                                            }}
                                        >
                                            {/* Progress Bar Background */}
                                            <div
                                                className={`absolute left-0 top-0 bottom-0 transition-all duration-1000 ${isWinner ? 'bg-primary/20' : 'bg-primary/5'}`}
                                                style={{ width: `${percentage}%` }}
                                            />

                                            <div className="relative z-10 flex justify-between items-center w-full">
                                                <div className="flex items-center gap-6">
                                                    <div
                                                        className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold ${isWinner ? 'bg-primary text-white' : 'text-muted-foreground border border-white/10'}`}
                                                        style={!isWinner ? { backgroundColor: 'rgba(var(--surface), 0.5)' } : {}}
                                                    >
                                                        {index + 1}
                                                    </div>
                                                    <span className="text-3xl font-medium truncate max-w-2xl">{option}</span>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span className="text-4xl font-black tabular-nums text-foreground">{count}</span>
                                                    <span className="text-lg text-muted-foreground font-mono">{percentage.toFixed(1)}%</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Text Input Result */}
                        {stats.type === 'INPUT' && (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 w-full auto-rows-min">
                                {stats.voteCounts && Object.entries(stats.voteCounts)
                                    .sort(([, a], [, b]) => (b as number) - (a as number))
                                    .map(([text, count], index) => (
                                        <div
                                            key={index}
                                            className="backdrop-blur-md rounded-2xl p-6 border border-white/10 flex justify-between items-center"
                                            style={{ backgroundColor: 'rgba(var(--surface), 0.5)' }}
                                        >
                                            <div className="text-xl font-medium truncate pr-4 text-foreground/90" title={text}>{text}</div>
                                            <div className="text-2xl font-bold text-primary whitespace-nowrap">{count as number}</div>
                                        </div>
                                    ))}
                            </div>
                        )}

                        <div className="mt-12 flex justify-center gap-12 text-muted-foreground">
                            <div className="text-center">
                                <div className="text-sm uppercase tracking-widest mb-1">Turnout</div>
                                <div className="text-3xl font-bold text-foreground">{(stats.turnoutPercentage || 0).toFixed(1)}%</div>
                            </div>
                            <div className="w-px bg-white/10" />
                            <div className="text-center">
                                <div className="text-sm uppercase tracking-widest mb-1">Votes / Total</div>
                                <div className="text-3xl font-bold text-foreground">{stats.totalVotes || 0} <span className="text-muted-foreground text-2xl">/ {stats.totalParticipants || 0}</span></div>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Footer Control Info */}
            <div className="fixed bottom-8 right-8 z-[100]">
                <button
                    onClick={() => {
                        const elem = document.documentElement;
                        if (!document.fullscreenElement) {
                            if (elem.requestFullscreen) {
                                elem.requestFullscreen();
                            }
                        } else {
                            if (document.exitFullscreen) {
                                document.exitFullscreen();
                            }
                        }
                    }}
                    className="p-4 bg-white/10 hover:bg-white/20 rounded-full transition-all duration-300 backdrop-blur-md border border-white/20 shadow-2xl group"
                    title="Toggle Fullscreen"
                >
                    <svg className="w-6 h-6 text-white group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
