'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface ResultPanelProps {
    agendaId: string;
    agendaTitle: string;
    onClose?: () => void;
}

export default function ResultPanel({ agendaId, agendaTitle, onClose }: ResultPanelProps) {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isAnimated, setIsAnimated] = useState(false);

    useEffect(() => {
        const fetchStats = async () => {
            if (agendaId === 'dummy-agenda') {
                setStats({
                    title: agendaTitle,
                    type: 'MULTIPLE_CHOICE',
                    totalVotes: 145,
                    totalParticipants: 150,
                    turnoutPercentage: 96.7,
                    options: [
                        '1. 활용한다 (참여율을 높이기 위해 다음 총회부터 모바일 및 현장 전자투표 방식을 정식 의결 수단으로 인정하고 적극 도입하는 방안)',
                        '2. 반대한다',
                        '3. 기권 및 보류 방안 마련 요구'
                    ],
                    voteCounts: {
                        '1. 활용한다 (참여율을 높이기 위해 다음 총회부터 모바일 및 현장 전자투표 방식을 정식 의결 수단으로 인정하고 적극 도입하는 방안)': 98,
                        '2. 반대한다': 35,
                        '3. 기권 및 보류 방안 마련 요구': 12
                    }
                });
                setLoading(false);
                // Trigger chart animations after data loads
                setTimeout(() => setIsAnimated(true), 150);
                return;
            }

            if (agendaId === 'dummy-input') {
                setStats({
                    title: agendaTitle,
                    type: 'INPUT',
                    totalVotes: 85,
                    totalParticipants: 100,
                    turnoutPercentage: 85.0,
                    voteCounts: {
                        '김독자 (대의원 후보)': 38,
                        '한수영 (대의원 후보)': 24,
                        '유중혁 (대의원 후보)': 15,
                        '유상아 (대의원 후보)': 5,
                        '신유승 (대의원 후보)': 3
                    }
                });
                setLoading(false);
                setTimeout(() => setIsAnimated(true), 150);
                return;
            }

            if (agendaId === 'dummy-pros-cons') {
                setStats({
                    title: agendaTitle,
                    type: 'PROS_CONS',
                    totalVotes: 120,
                    totalParticipants: 130,
                    turnoutPercentage: 92.3,
                    approveCount: 82,
                    rejectCount: 28,
                    abstainCount: 10
                });
                setLoading(false);
                setTimeout(() => setIsAnimated(true), 150);
                return;
            }

            try {
                const response = await api.getVoteStatistics(agendaId);
                setStats(response.stats || response);
                // Trigger chart animations after data loads
                setTimeout(() => setIsAnimated(true), 150);
            } catch (err: any) {
                toast.error('투표 결과를 불러오는데 실패했습니다.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [agendaId, agendaTitle]);

    if (loading) {
        return (
            <div className="w-full max-w-md p-6 flex items-center justify-center min-h-[350px]">
                <div className="text-center space-y-4">
                    <div className="relative h-12 w-12 mx-auto flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                    </div>
                    <p className="text-sm text-muted-foreground font-light animate-pulse">결과를 집계 중입니다...</p>
                </div>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="w-full max-w-md p-6">
                <div className="rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-2xl p-8 text-center text-muted-foreground font-light">
                    결과 데이터를 찾을 수 없습니다.
                </div>
            </div>
        );
    }

    const total = stats.totalVotes || 0;
    const turnout = stats.turnoutPercentage || 0;
    const isProsCons = !stats.type || stats.type === 'PROS_CONS';

    // Helper to calculate percentages
    const getPercentage = (count: number) => {
        if (total === 0) return 0;
        return Math.round((count / total) * 100);
    };

    return (
        <div className="w-full max-w-md p-4 animate-countup">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-2xl shadow-[0_0_50px_rgba(0,0,0,0.4)]">
                {/* Decorative glows */}
                <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/20 rounded-full blur-3xl opacity-50 animate-pulse-slow" />
                <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-accent/20 rounded-full blur-3xl opacity-50 animate-pulse-slow" />
                
                {/* Decorative header line */}
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-success via-primary to-accent animate-gradient-x" />

                {/* Close Button at top right if onClose is provided */}
                {onClose && (
                    <button 
                        onClick={onClose}
                        className="absolute top-5 right-5 z-20 p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 text-muted-foreground hover:text-foreground transition-all duration-150 active:scale-95"
                        aria-label="닫기"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}

                <div className="p-8 space-y-6 relative z-10">
                    
                    {/* Header badge */}
                    <div className="text-center space-y-2 pr-6 pl-6">
                        <div className="relative inline-flex items-center px-4 py-1.5 rounded-full bg-success/10 border border-success/30 text-xs font-semibold uppercase tracking-wider text-success">
                            <span className="w-2 h-2 rounded-full bg-success mr-2 animate-pulse" />
                            최종 투표 결과
                        </div>
                        <h1 className="text-xl font-bold text-foreground leading-snug break-keep pt-2">
                            {agendaTitle}
                        </h1>
                    </div>

                    {/* Turnout details Card */}
                    <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-black/40 border border-white/5 shadow-inner text-center text-xs">
                        <div className="space-y-1">
                            <p className="text-muted-foreground font-light">총 투표수</p>
                            <p className="text-xl font-black text-foreground">
                                {total} <span className="text-xs text-muted-foreground font-normal">명</span>
                            </p>
                        </div>
                        <div className="space-y-1 border-l border-white/5">
                            <p className="text-muted-foreground font-light">투표율</p>
                            <p className="text-xl font-black text-success">
                                {turnout.toFixed(1)} <span className="text-xs text-success font-normal">%</span>
                            </p>
                        </div>
                    </div>

                    {/* Result Charts */}
                    <div className="space-y-5 pt-2">
                        {/* 1. PROS & CONS */}
                        {isProsCons && (
                            <div className="space-y-4">
                                {/* 찬성 */}
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm font-semibold">
                                        <span className="text-success flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                                            찬성
                                        </span>
                                        <span className="text-foreground">
                                            {stats.approveCount || 0}표 ({getPercentage(stats.approveCount || 0)}%)
                                        </span>
                                    </div>
                                    <div className="h-3.5 rounded-full bg-white/5 overflow-hidden border border-white/5 shadow-inner">
                                        <div 
                                            className="h-full bg-gradient-to-r from-success/80 to-success transition-all duration-[1200ms] cubic-bezier(0.1, 0.8, 0.2, 1)"
                                            style={{ width: `${isAnimated ? getPercentage(stats.approveCount || 0) : 0}%` }}
                                        />
                                    </div>
                                </div>

                                {/* 반대 */}
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm font-semibold">
                                        <span className="text-danger flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
                                            반대
                                        </span>
                                        <span className="text-foreground">
                                            {stats.rejectCount || 0}표 ({getPercentage(stats.rejectCount || 0)}%)
                                        </span>
                                    </div>
                                    <div className="h-3.5 rounded-full bg-white/5 overflow-hidden border border-white/5 shadow-inner">
                                        <div 
                                            className="h-full bg-gradient-to-r from-danger/80 to-danger transition-all duration-[1200ms] cubic-bezier(0.1, 0.8, 0.2, 1)"
                                            style={{ width: `${isAnimated ? getPercentage(stats.rejectCount || 0) : 0}%` }}
                                        />
                                    </div>
                                </div>

                                {/* 기권 */}
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm font-semibold">
                                        <span className="text-muted-foreground flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                                            기권
                                        </span>
                                        <span className="text-foreground">
                                            {stats.abstainCount || 0}표 ({getPercentage(stats.abstainCount || 0)}%)
                                        </span>
                                    </div>
                                    <div className="h-3.5 rounded-full bg-white/5 overflow-hidden border border-white/5 shadow-inner">
                                        <div 
                                            className="h-full bg-slate-500/50 transition-all duration-[1200ms] cubic-bezier(0.1, 0.8, 0.2, 1)"
                                            style={{ width: `${isAnimated ? getPercentage(stats.abstainCount || 0) : 0}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 2. MULTIPLE_CHOICE / MULTIPLE_CHOICE_MULTI */}
                        {(stats.type === 'MULTIPLE_CHOICE' || stats.type === 'MULTIPLE_CHOICE_MULTI') && (
                            <div className="space-y-4">
                                {stats.options && stats.options.map((option: string, index: number) => {
                                    const count = stats.voteCounts ? (stats.voteCounts[option] || 0) : 0;
                                    const percent = getPercentage(count);
                                    
                                    // Highlight highest voted choice
                                    const countsArray = stats.options.map((o: string) => stats.voteCounts?.[o] || 0);
                                    const maxCount = Math.max(...countsArray, 1);
                                    const isWinner = count === maxCount && count > 0;

                                    return (
                                        <div key={index} className="space-y-2">
                                            <div className="flex justify-between items-start gap-4 text-sm">
                                                {/* Text block allowing full wrapping */}
                                                <div className={`flex items-start gap-2.5 min-w-0 ${
                                                    isWinner ? 'text-primary font-bold' : 'text-muted-foreground'
                                                }`}>
                                                    <span className={`w-5.5 h-5.5 rounded-full text-[10px] flex items-center justify-center font-bold flex-shrink-0 mt-0.5 ${
                                                        isWinner ? 'bg-primary text-white shadow-[0_0_8px_rgba(var(--primary),0.4)]' : 'bg-white/10 text-muted-foreground border border-white/5'
                                                    }`}>
                                                        {index + 1}
                                                    </span>
                                                    <span className="break-keep leading-snug text-xs sm:text-sm">
                                                        {option}
                                                    </span>
                                                </div>
                                                
                                                {/* Vote details right aligned */}
                                                <span className="text-foreground font-semibold flex-shrink-0 whitespace-nowrap text-right text-xs sm:text-sm pt-0.5">
                                                    {count}표 ({percent}%)
                                                </span>
                                            </div>
                                            <div className="h-3.5 rounded-full bg-white/5 overflow-hidden border border-white/5 shadow-inner">
                                                <div 
                                                    className={`h-full transition-all duration-[1200ms] cubic-bezier(0.1, 0.8, 0.2, 1) ${
                                                        isWinner 
                                                            ? 'bg-gradient-to-r from-primary/80 via-primary to-accent shadow-[0_0_10px_rgba(var(--primary),0.3)]' 
                                                            : 'bg-white/15'
                                                    }`}
                                                    style={{ width: `${isAnimated ? percent : 0}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* 3. INPUT (주관식 의견 제출 - 총대 다득표순 집계 그래프 차트) */}
                        {stats.type === 'INPUT' && (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center pl-1 border-b border-white/5 pb-2">
                                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">후보자 및 의견 집계 (다득표순)</h3>
                                    <span className="text-[10px] text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full font-medium">실시간 정렬</span>
                                </div>
                                <div className="max-h-[280px] overflow-y-auto space-y-4.5 pr-1.5 custom-scrollbar">
                                    {stats.voteCounts && Object.entries(stats.voteCounts).length > 0 ? (
                                        Object.entries(stats.voteCounts)
                                            .sort((a: any, b: any) => b[1] - a[1]) // Sort descending by vote count
                                            .map(([opinion, count]: [string, any], index: number) => {
                                                const percent = getPercentage(count);
                                                const isFirst = index === 0 && count > 0;
                                                const isSecond = index === 1 && count > 0;
                                                const isThird = index === 2 && count > 0;

                                                // Determine styles based on rank
                                                let rankBadgeClass = 'bg-white/10 text-muted-foreground border border-white/5';
                                                let chartBarClass = 'bg-white/15';
                                                let nameClass = 'text-muted-foreground';

                                                if (isFirst) {
                                                    rankBadgeClass = 'bg-amber-400 text-slate-950 font-black shadow-[0_0_10px_rgba(251,191,36,0.5)]';
                                                    chartBarClass = 'bg-gradient-to-r from-amber-500/80 via-amber-400 to-yellow-300 shadow-[0_0_12px_rgba(251,191,36,0.3)]';
                                                    nameClass = 'text-amber-300 font-extrabold';
                                                } else if (isSecond) {
                                                    rankBadgeClass = 'bg-slate-300 text-slate-900 font-bold';
                                                    chartBarClass = 'bg-gradient-to-r from-slate-400/80 to-slate-300';
                                                    nameClass = 'text-slate-200 font-bold';
                                                } else if (isThird) {
                                                    rankBadgeClass = 'bg-amber-700/80 text-amber-50';
                                                    chartBarClass = 'bg-gradient-to-r from-amber-800/80 to-amber-700/50';
                                                    nameClass = 'text-amber-600/90 font-semibold';
                                                }

                                                return (
                                                    <div key={index} className="space-y-2">
                                                        <div className="flex justify-between items-start gap-4 text-sm">
                                                            <div className="flex items-start gap-2.5 min-w-0">
                                                                {/* Rank badge */}
                                                                <span className={`w-5.5 h-5.5 rounded-full text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5 ${rankBadgeClass}`}>
                                                                    {index + 1}
                                                                </span>
                                                                <span className={`break-keep leading-snug text-xs sm:text-sm ${nameClass}`}>
                                                                    {opinion}
                                                                </span>
                                                            </div>
                                                            <span className="text-foreground font-semibold flex-shrink-0 whitespace-nowrap text-right text-xs sm:text-sm pt-0.5">
                                                                {count}표 ({percent}%)
                                                            </span>
                                                        </div>
                                                        {/* Progress bar graph */}
                                                        <div className="h-3 rounded-full bg-white/5 overflow-hidden border border-white/5 shadow-inner">
                                                            <div 
                                                                className={`h-full transition-all duration-[1200ms] cubic-bezier(0.1, 0.8, 0.2, 1) ${chartBarClass}`}
                                                                style={{ width: `${isAnimated ? percent : 0}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })
                                    ) : (
                                        <p className="text-xs text-muted-foreground text-center py-8 font-light">제출된 의견이 없습니다.</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Return to waiting room button or footer notice */}
                    {onClose ? (
                        <div className="pt-6 border-t border-white/5 flex flex-col space-y-3">
                            <button
                                onClick={onClose}
                                className="w-full py-3.5 px-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-foreground font-semibold text-sm transition-all duration-150 active:scale-[0.98] shadow-md flex items-center justify-center gap-2"
                            >
                                <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                </svg>
                                대기실로 돌아가기
                            </button>
                            <p className="text-[10px] text-center text-muted-foreground/60 font-light">
                                회의 주최자가 안건을 다음으로 이동하면 자동으로 동기화됩니다.
                            </p>
                        </div>
                    ) : (
                        <div className="pt-6 border-t border-white/5 text-center">
                            <p className="text-xs text-muted-foreground/75 font-light">
                                회의 주최자가 안건을 종료하면 대기실로 자동 리셋됩니다.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

