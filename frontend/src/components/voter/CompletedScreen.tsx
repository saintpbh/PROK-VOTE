'use client';

import { useEffect } from 'react';
import haptic from '@/lib/haptic';

interface CompletedScreenProps {
    stage?: 'voting' | 'ended' | string;
}

export default function CompletedScreen({ stage = 'voting' }: CompletedScreenProps) {
    const isEnded = stage === 'ended';

    useEffect(() => {
        try {
            if (isEnded) {
                haptic('voteEnd');
            } else {
                haptic('success');
            }
        } catch (e) {}
    }, [isEnded]);

    return (
        <div className="w-full max-w-md p-4 animate-countup">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-2xl shadow-[0_0_50px_rgba(0,0,0,0.4)]">
                {/* Decorative glows */}
                <div className={`absolute -top-24 -left-24 w-48 h-48 rounded-full blur-3xl opacity-50 animate-pulse-slow ${
                    isEnded ? 'bg-amber-500/20' : 'bg-success/20'
                }`} />
                <div className={`absolute -bottom-24 -right-24 w-48 h-48 rounded-full blur-3xl opacity-50 animate-pulse-slow ${
                    isEnded ? 'bg-primary/20' : 'bg-accent/20'
                }`} />
                
                {/* Decorative header line */}
                <div className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${
                    isEnded ? 'from-amber-500 via-primary to-accent' : 'from-success via-primary to-accent'
                } animate-gradient-x`} />

                <div className="p-8 space-y-6 relative z-10 text-center">
                    
                    {/* Animated Icon Container */}
                    <div className="relative h-28 w-28 mx-auto flex items-center justify-center">
                        {isEnded ? (
                            <>
                                <div className="absolute inset-0 bg-amber-500/10 rounded-full blur-xl animate-pulse" />
                                <div className="relative w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shadow-inner">
                                    <svg className="w-12 h-12 text-amber-400 animate-spin" style={{ animationDuration: '4s' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="absolute inset-0 bg-success/15 rounded-full blur-xl animate-pulse" />
                                <div className="relative w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shadow-inner">
                                    <svg className="w-12 h-12 text-success animate-bounce-slight" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Status Title & Description */}
                    <div className="space-y-2">
                        <h1 className={`text-2xl font-extrabold ${isEnded ? 'text-amber-400' : 'text-success'}`}>
                            {isEnded ? '투표 종료' : '투표 완료'}
                        </h1>
                        <p className="text-sm text-muted-foreground font-light px-2 break-keep">
                            {isEnded 
                                ? '현재 안건의 투표가 의장에 의해 종료되었습니다.'
                                : '대의원님의 투표가 정상적으로 제출되었습니다.'
                            }
                        </p>
                    </div>

                    {/* Confirmation Message Box */}
                    <div className={`p-5 rounded-2xl bg-black/35 border text-xs leading-relaxed space-y-1.5 text-left font-light break-keep ${
                        isEnded ? 'border-amber-500/10' : 'border-success/10'
                    }`}>
                        <p className={`font-semibold ${isEnded ? 'text-amber-400' : 'text-success'}`}>
                            {isEnded ? '⚠️ 투표 결과 대기 중' : '✓ 투표 기록 완료'}
                        </p>
                        <p className="text-muted-foreground">
                            {isEnded
                                ? '현재 투표 결과를 수집 및 집계하고 있습니다. 의장의 공식 결과 발표까지 이 화면을 유지한 채로 잠시만 기다려주세요.'
                                : '투표 정보가 보안 서버에 기록되었습니다. 의장이 투표를 마감하고 결과를 발표하면 화면에 자동으로 표시됩니다.'
                            }
                        </p>
                    </div>

                    {/* Next Steps List */}
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5 text-[11px] text-muted-foreground/80 font-light text-left space-y-1.5">
                        <p className="font-semibold text-foreground/90 uppercase tracking-wider">안내 사항</p>
                        <ul className="space-y-1 list-disc pl-4">
                            <li>안정적인 회의 진행을 위해 브라우저 창을 닫거나 새로고침하지 마세요.</li>
                            <li>의장이 다음 안건을 상정하면 대기실 화면으로 자동 전환됩니다.</li>
                            {isEnded ? (
                                <li>결과 집계가 끝나면 대의원 단말기 화면에도 상세 결과 차트가 로드됩니다.</li>
                            ) : (
                                <li>의장이 투표를 마감하기 전까지 잠시 휴식을 취해주십시오.</li>
                            )}
                        </ul>
                    </div>

                </div>
            </div>
        </div>
    );
}
