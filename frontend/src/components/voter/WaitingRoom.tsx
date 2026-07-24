'use client';

import { useEffect, useState } from 'react';

interface WaitingRoomProps {
    sessionName?: string;
    agendaTitle?: string;
    agendaDescription?: string;
    onStageChange?: (stage: string) => void;
}

export default function WaitingRoom({ sessionName, agendaTitle, agendaDescription }: WaitingRoomProps) {
    const [dots, setDots] = useState('');
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
        const interval = setInterval(() => {
            setDots(prev => prev.length >= 3 ? '' : prev + '.');
        }, 500);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        setIsOnline(navigator.onLine);
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Agenda Submitted Case (Waiting for voting to start)
    if (agendaTitle) {
        return (
            <div className="w-full max-w-md p-6 animate-countup">
                <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-2xl shadow-[0_0_50px_rgba(0,0,0,0.4)]">
                    {/* Background glows */}
                    <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/20 rounded-full blur-3xl opacity-60 mix-blend-screen animate-pulse-slow" />
                    <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-accent/20 rounded-full blur-3xl opacity-60 mix-blend-screen animate-pulse-slow" />
                    
                    {/* Decorative header line */}
                    <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-primary via-accent to-secondary animate-gradient-x" />

                    <div className="p-8 space-y-8 text-center relative z-10">
                        {/* Session Name Banner */}
                        {sessionName && (
                            <div className="inline-flex items-center px-4 py-2 rounded-2xl bg-primary/15 border border-primary/30 text-primary font-bold text-sm shadow-sm gap-2 max-w-full truncate">
                                <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse flex-shrink-0" />
                                <span className="truncate">접속 세션: {sessionName}</span>
                            </div>
                        )}

                        {/* New Agenda Indicator */}
                        <div className="relative inline-block">
                            <span className="absolute inset-0 bg-primary/30 rounded-full blur-md animate-pulse" />
                            <div className="relative inline-flex items-center px-4 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-xs font-semibold uppercase tracking-wider text-primary">
                                <span className="w-2.5 h-2.5 rounded-full bg-primary animate-ping mr-2" />
                                신규 안건 상정
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Next Agenda</h2>
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground leading-snug break-keep drop-shadow-md">
                                {agendaTitle}
                            </h1>
                        </div>

                        {agendaDescription && (
                            <div className="relative max-h-40 overflow-y-auto p-5 rounded-2xl bg-black/35 border border-white/5 text-left custom-scrollbar">
                                <p className="text-muted-foreground text-sm leading-relaxed break-keep whitespace-pre-wrap font-light">
                                    {agendaDescription}
                                </p>
                            </div>
                        )}

                        <div className="space-y-4 pt-2">
                            <div className="flex items-center justify-center space-x-3 text-sm text-primary bg-primary/10 py-3.5 px-5 rounded-xl border border-primary/20 shadow-[0_4px_12px_rgba(var(--primary),0.05)]">
                                <svg className="w-5 h-5 animate-pulse text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="font-semibold tracking-wide">잠시 후 투표가 시작됩니다{dots}</span>
                            </div>

                            <p className="text-xs text-center text-muted-foreground/80 font-light">
                                화면을 끄지 마시고 잠시만 기다려주세요
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Default Waiting Case (Meeting in Progress)
    return (
        <div className="w-full max-w-md p-6 animate-countup">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-2xl shadow-[0_0_50px_rgba(0,0,0,0.4)]">
                {/* Background decorative elements */}
                <div className="absolute -top-20 -right-20 w-44 h-44 bg-success/10 rounded-full blur-3xl opacity-60 mix-blend-screen animate-pulse-slow" />
                <div className="absolute -bottom-20 -left-20 w-44 h-44 bg-primary/10 rounded-full blur-3xl opacity-60 mix-blend-screen animate-pulse-slow" />

                {/* Glass Card Header Line */}
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-success via-primary to-accent" />

                <div className="relative p-8 sm:p-10 space-y-6 text-center z-10">

                    {/* Prominent Session Name Display (Prevent Human Error) */}
                    {sessionName && (
                        <div className="inline-flex items-center px-4 py-2 rounded-2xl bg-primary/15 border border-primary/30 text-primary font-bold text-sm shadow-md gap-2 max-w-full">
                            <span className="w-2.5 h-2.5 rounded-full bg-success animate-pulse flex-shrink-0" />
                            <span className="truncate">접속 세션: {sessionName}</span>
                        </div>
                    )}

                    {/* Prominent Glowing Connection Indicator */}
                    <div className="relative h-28 w-28 mx-auto flex items-center justify-center">
                        {/* Outer pulsating glow rings */}
                        <div className={`absolute inset-0 rounded-full bg-success/10 border-2 border-success/30 animate-pulse shadow-[0_0_40px_rgba(34,197,94,0.25)]`} />
                        <div className="absolute inset-3 rounded-full border border-dashed border-success/40 animate-spin" style={{ animationDuration: '6s' }} />
                        
                        {/* Inner glowing green core orb */}
                        <div className="absolute inset-6 rounded-full bg-gradient-to-br from-success/80 to-success/40 border border-success flex items-center justify-center shadow-[0_0_30px_rgba(34,197,94,0.6),inset_0_2px_8px_rgba(255,255,255,0.4)] animate-pulse-slow">
                            {/* Inner core check/online icon */}
                            <svg className="w-7 h-7 text-white drop-shadow-[0_2px_5px_rgba(0,0,0,0.3)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1">
                            <span className="text-xs font-semibold text-success tracking-widest uppercase bg-success/10 border border-success/20 px-3 py-1 rounded-full">
                                실시간 연결됨 (Online)
                            </span>
                            <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300 tracking-tight pt-3">
                                투표 대기 중
                            </h1>
                        </div>
                        <div className="space-y-2 text-sm text-muted-foreground font-light leading-relaxed break-keep">
                            <p className="font-semibold text-foreground/95">
                                안건이 상정되면 안건 화면으로 자동으로 넘어갑니다.
                            </p>
                            <p className="text-xs text-muted-foreground/80">
                                자동으로 넘어가지 않으면, 아래의 새로고침 버튼을 눌러주세요.
                            </p>
                        </div>
                    </div>

                    {/* Refactored Refresh & Diagnostics Section */}
                    <div className="pt-4 border-t border-white/5 space-y-4">
                        
                        {/* Explicit Browser Refresh Button */}
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full py-3.5 px-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-foreground font-semibold text-sm transition-all duration-150 active:scale-[0.98] shadow-md flex items-center justify-center gap-2 group"
                        >
                            <svg className="w-4 h-4 text-muted-foreground group-hover:rotate-180 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.21" />
                            </svg>
                            새로고침
                        </button>

                        {/* Stethoscope minimal status */}
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground/60 px-2">
                            <span>수신 대기 채널: WebSockets Live</span>
                            <span>의결권 인증 완료</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Add these to your globals.css if not present, or rely on inline styles for specialized animations
