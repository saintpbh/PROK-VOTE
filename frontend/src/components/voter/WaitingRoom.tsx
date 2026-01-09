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

    useEffect(() => {
        const interval = setInterval(() => {
            setDots(prev => prev.length >= 3 ? '' : prev + '.');
        }, 500);
        return () => clearInterval(interval);
    }, []);

    // Agenda Submitted Case
    if (agendaTitle) {
        return (
            <div className="w-full max-w-md p-6">
                <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/10 backdrop-blur-xl shadow-2xl">
                    {/* Decorative header gradient */}
                    <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-primary via-secondary to-accent animate-gradient-x" />

                    <div className="p-8 space-y-8 text-center">
                        <div className="relative">
                            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
                            <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 border border-white/10 shadow-inner">
                                <svg className="w-10 h-10 text-primary animate-bounce-slight" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                                </svg>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h2 className="text-sm font-medium text-primary uppercase tracking-wider">New Agenda</h2>
                            <h1 className="text-3xl font-bold text-foreground leading-tight break-keep drop-shadow-sm">
                                {agendaTitle}
                            </h1>
                        </div>

                        {agendaDescription && (
                            <div className="relative p-6 rounded-xl bg-black/20 border border-white/5 text-left">
                                <p className="text-muted-foreground text-sm leading-relaxed break-keep whitespace-pre-wrap">
                                    {agendaDescription}
                                </p>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="flex items-center justify-center space-x-2 text-sm text-primary bg-primary/10 py-3 px-4 rounded-lg border border-primary/20">
                                <svg className="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>잠시 후 투표가 시작됩니다{dots}</span>
                            </div>

                            <p className="text-xs text-center text-muted-foreground">
                                화면을 켜두고 잠시만 기다려주세요
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Default Waiting Case (Meeting in Progress)
    return (
        <div className="w-full max-w-md p-6">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl">
                {/* Background decorative elements */}
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl opacity-50" />
                <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-secondary/10 rounded-full blur-3xl opacity-50" />

                <div className="relative p-10 space-y-10 text-center">

                    {/* Animated Icon Container */}
                    <div className="relative h-24 w-24 mx-auto">
                        <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-secondary/20 rounded-full blur-xl animate-pulse-slow" />
                        <div className="relative h-full w-full rounded-full bg-gradient-to-b from-white/10 to-transparent border border-white/10 flex items-center justify-center p-6 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                            {/* Hourglass Icon */}
                            <svg className="w-10 h-10 text-foreground/80 animate-spin-slow-reverse" style={{ animationDuration: '30s' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {/* Inner pulsing circle */}
                            <div className="absolute w-2 h-2 bg-primary rounded-full animate-ping top-1/2 left-1/2 -mt-1 -ml-1" />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary via-foreground to-secondary">
                            회의 진행 중
                        </h1>
                        <p className="text-base text-muted-foreground font-light">
                            현재 회의가 진행되고 있습니다.<br />
                            안건 상정 시 투표 화면이 자동으로 표시됩니다.
                        </p>
                    </div>

                    <div className="pt-6 border-t border-white/5">
                        {sessionName && (
                            <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/5 border border-white/5 space-x-2">
                                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                                <span className="text-xs font-medium text-muted-foreground truncate max-w-[150px]">
                                    {sessionName}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Add these to your globals.css if not present, or rely on inline styles for specialized animations
