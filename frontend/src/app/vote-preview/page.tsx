'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import Loading from '@/components/ui/Loading';
import AuthFlow from '@/components/voter/AuthFlow';
import WaitingRoom from '@/components/voter/WaitingRoom';
import VotingPanel from '@/components/voter/VotingPanel';
import CompletedScreen from '@/components/voter/CompletedScreen';
import ResultPanel from '@/components/voter/ResultPanel';

// Mock loading indicator helper to match main Page
function LoadingMessages() {
    const messages = [
        { text: '투표권을 확인하고 있습니다...', icon: '🔍' },
        { text: '보안 환경을 점검하고 있습니다...', icon: '🔒' },
        { text: '투표 시스템에 안전하게 연결 중입니다...', icon: '🛡️' },
        { text: '참여 자격을 확인하고 있습니다...', icon: '✅' },
        { text: '투표 환경을 준비하고 있습니다...', icon: '⚡' },
    ];
    const [index, setIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setIndex((prev) => (prev + 1) % messages.length);
        }, 2000);
        return () => clearInterval(interval);
    }, [messages.length]);

    return (
        <div className="text-center animate-fade-in" key={index}>
            <div className="text-2xl mb-2">{messages[index].icon}</div>
            <p className="text-base font-medium text-white/80">{messages[index].text}</p>
            <p className="text-xs text-muted-foreground mt-2">잠시만 기다려 주세요</p>
        </div>
    );
}

type VoterState = 'loading' | 'auth' | 'standby' | 'waiting' | 'voting' | 'completed' | 'results';
type ThemeType = 'classic' | 'minimal' | 'warm' | 'nature' | 'royal';

export default function VotePreviewPage() {
    const [currentState, setCurrentState] = useState<VoterState>('standby');
    const [currentTheme, setCurrentTheme] = useState<ThemeType>('classic');

    // VotingPanel Configurations
    const [votingAgendaType, setVotingAgendaType] = useState<'PROS_CONS' | 'MULTIPLE_CHOICE' | 'MULTIPLE_CHOICE_MULTI' | 'INPUT'>('PROS_CONS');

    // CompletedScreen Configuration
    const [completedScreenStage, setCompletedScreenStage] = useState<string>('voting');

    // ResultPanel Configuration
    const [resultsAgendaType, setResultsAgendaType] = useState<'PROS_CONS' | 'MULTIPLE_CHOICE' | 'INPUT'>('MULTIPLE_CHOICE');

    // Mock Login Context
    const { login, logout } = useAuthStore();

    useEffect(() => {
        // Authenticate as dummy user in client environment to bypass auth checks in components
        // Use valid UUID formats to avoid backend database cast failures
        login(
            'mock-token', 
            '11111111-1111-1111-1111-111111111111', 
            '22222222-2222-2222-2222-222222222222', 
            '33333333-3333-3333-3333-333333333333'
        );
        return () => {
            logout();
        };
    }, [login, logout]);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', currentTheme);
    }, [currentTheme]);

    // Constructing dynamically mock agendas based on settings
    const mockAgendas = {
        PROS_CONS: {
            id: 'mock-pros-cons',
            title: '제1호 의안: 정관 일부 변경의 건',
            description: '이사회 개최 및 통지 기간을 7일에서 3일로 단축하여 긴급 경영 안건에 기민하게 대응할 수 있도록 하는 정관 개정안입니다.',
            type: 'PROS_CONS',
        },
        MULTIPLE_CHOICE: {
            id: 'mock-single-choice',
            title: '제2호 의안: 차기 사외이사 선임의 건',
            description: '당사 지배구조 개선 및 감사 강화를 위한 사외이사 후보 3인 중 1인을 선택하여 투표해 주십시오.',
            type: 'MULTIPLE_CHOICE',
            options: [
                '홍길동 (한국ESG협회 이사)',
                '성춘향 (가온법률사무소 대표변호사)',
                '이몽룡 (성균관대학교 경제학 교수)',
            ],
        },
        MULTIPLE_CHOICE_MULTI: {
            id: 'mock-multi-choice',
            title: '제3호 의안: 신규 복리후생 항목 도입 선호도 조사 (최대 2개)',
            description: '임직원 근로 의욕 고취를 위한 복리후생 후보군 중 가장 선호하시는 제도들을 최대 2개까지 다중 선택해 주십시오.',
            type: 'MULTIPLE_CHOICE_MULTI',
            options: [
                '정기 종합건강검진 대상 확대',
                '유연 근무제 수당 신설',
                '사내 대출 이자 보전 지원',
                '도서 구입 및 자기개발비 한도 상향',
            ],
        },
        INPUT: {
            id: 'mock-input-choice',
            title: '제4호 의안: 차기 총회 개최 장소에 대한 제안의 건',
            description: '대의원 및 주주 여러분의 이동 편의성을 극대화하기 위해 추천하시는 서울/경인 지역 내 개최 후보 장소를 기재해 주세요.',
            type: 'INPUT',
        },
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-start p-6 transition-colors duration-500">
            {/* Background Gradient */}
            <div className="fixed inset-0 bg-gradient-to-br from-primary/10 via-background to-secondary/10 -z-10" />

            {/* Top Workspace Header */}
            <div className="w-full max-w-6xl mb-8 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-900/40 border border-white/5 p-5 rounded-3xl backdrop-blur-md">
                <div className="space-y-1 text-center md:text-left">
                    <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                        🚀 투표자 화면 통합 프리뷰 보드
                    </h1>
                    <p className="text-xs text-muted-foreground font-light">
                        Voter 앱에서 제공하는 모든 화면 및 상태 컴포넌트들을 실시간으로 체크할 수 있는 Sandbox입니다.
                    </p>
                </div>

                {/* Theme Selector */}
                <div className="flex flex-wrap justify-center gap-1.5 p-1 bg-black/30 rounded-2xl border border-white/5">
                    {(['classic', 'minimal', 'warm', 'nature', 'royal'] as ThemeType[]).map((theme) => (
                        <button
                            key={theme}
                            onClick={() => setCurrentTheme(theme)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase transition-all ${
                                currentTheme === theme
                                    ? 'bg-primary text-white shadow-md'
                                    : 'text-muted-foreground hover:text-white hover:bg-white/5'
                            }`}
                        >
                            {theme}
                        </button>
                    ))}
                </div>
            </div>

            <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* 1. Control Board Dashboard (left 4-columns) */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="p-6 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-2xl space-y-6">
                        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest border-b border-white/5 pb-3">
                            화면 상태 제어판
                        </h2>

                        {/* State Selection */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground">Voter App State</label>
                            <div className="grid grid-cols-1 gap-1.5">
                                {([
                                    { id: 'loading', label: '1. 로딩 화면 (Loading)' },
                                    { id: 'auth', label: '2. 인증 화면 (AuthFlow)' },
                                    { id: 'standby', label: '3. 투표 대기 화면 (Standby)' },
                                    { id: 'waiting', label: '4. 안건 상정 화면 (New Agenda)' },
                                    { id: 'voting', label: '5. 투표 진행 (Voting)' },
                                    { id: 'completed', label: '6. 제출 완료 (Completed)' },
                                    { id: 'results', label: '7. 결과 통계 (Results)' },
                                ] as { id: VoterState; label: string }[]).map((st) => (
                                    <button
                                        key={st.id}
                                        onClick={() => setCurrentState(st.id)}
                                        className={`w-full text-left p-3 rounded-2xl border text-xs font-bold transition-all duration-150 active:scale-[0.98] ${
                                            currentState === st.id
                                                ? 'bg-primary border-primary text-white shadow-[0_4px_12px_rgba(var(--primary),0.2)]'
                                                : `bg-black/20 border-white/5 hover:bg-black/30 text-muted-foreground`
                                        }`}
                                    >
                                        {st.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* State-specific parameters */}
                        <div className="pt-4 border-t border-white/5 space-y-4">
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                                파라미터 세부 튜닝
                            </h3>

                            {/* Options for VOTING */}
                            {currentState === 'voting' && (
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-muted-foreground block">안건 투표 형태</label>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {(['PROS_CONS', 'MULTIPLE_CHOICE', 'MULTIPLE_CHOICE_MULTI', 'INPUT'] as const).map((type) => (
                                            <button
                                                key={type}
                                                onClick={() => setVotingAgendaType(type)}
                                                className={`py-2 px-1.5 rounded-xl border text-[10px] font-bold transition-all ${
                                                    votingAgendaType === type
                                                        ? 'bg-primary/20 border-primary text-primary'
                                                        : 'bg-black/20 border-white/5 text-muted-foreground'
                                                }`}
                                            >
                                                {type === 'PROS_CONS' && '찬반 투표'}
                                                {type === 'MULTIPLE_CHOICE' && '단일 선택'}
                                                {type === 'MULTIPLE_CHOICE_MULTI' && '다중 선택'}
                                                {type === 'INPUT' && '주관식 작성'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Options for COMPLETED */}
                            {currentState === 'completed' && (
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-muted-foreground block">이전 진행 단계</label>
                                    <div className="flex rounded-xl bg-black/20 p-1 border border-white/5 gap-1">
                                        {['voting', 'submitted', 'ended', 'announced'].map((stage) => (
                                            <button
                                                key={stage}
                                                onClick={() => setCompletedScreenStage(stage)}
                                                className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase transition-all ${
                                                    completedScreenStage === stage ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-white'
                                                }`}
                                            >
                                                {stage}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Options for RESULTS */}
                            {currentState === 'results' && (
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-muted-foreground block">결과 차트 형태</label>
                                    <div className="flex rounded-xl bg-black/20 p-1 border border-white/5 gap-1">
                                        {(['PROS_CONS', 'MULTIPLE_CHOICE', 'INPUT'] as const).map((type) => (
                                            <button
                                                key={type}
                                                onClick={() => setResultsAgendaType(type)}
                                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                                                    resultsAgendaType === type ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-white'
                                                }`}
                                            >
                                                {type === 'PROS_CONS' && '찬반결과'}
                                                {type === 'MULTIPLE_CHOICE' && '선택결과'}
                                                {type === 'INPUT' && '주관식의견'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Hint Card */}
                    <div className="p-5 rounded-2xl bg-black/30 border border-white/5 text-xs text-muted-foreground leading-relaxed space-y-1">
                        <p className="font-semibold text-foreground">💡 체크 및 동작 안내</p>
                        <p>프리뷰 페이지에서는 `useAuthStore` 내에 가상의 임시 대의원 인증 키(`mock-voter-id`)를 자동으로 로드하여 화면 렌더링을 시뮬레이션합니다.</p>
                        <p>투표 완료/취소/닫기 이벤트 발생 시 모바일 화면과 연결된 인터랙션을 그대로 체감하실 수 있습니다.</p>
                    </div>
                </div>

                {/* 2. Voter Mobile Canvas Mockup (right 8-columns) */}
                <div className="lg:col-span-8 flex flex-col items-center">
                    
                    {/* Device Frame */}
                    <div className="relative w-full max-w-md bg-slate-950 rounded-[45px] p-4 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] border-[6px] border-slate-800">
                        {/* Speaker Notch */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-5 w-32 bg-slate-800 rounded-b-2xl z-40 flex items-center justify-center">
                            <div className="w-10 h-1 bg-slate-900 rounded-full" />
                        </div>

                        {/* Screen Content Wrapper */}
                        <div className="relative w-full aspect-[9/19] rounded-[36px] overflow-hidden bg-background flex flex-col items-center justify-center p-4">
                            
                            {/* Inner Page Background Grid */}
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-secondary/10 -z-10" />

                            {/* Inner Socket status emulation */}
                            <div className="absolute top-2 right-2 z-40 flex items-center gap-1 px-2 py-0.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-[9px]">
                                <div className="w-1 h-1 rounded-full bg-success animate-pulse" />
                                <span className="text-success/90 font-medium">Live</span>
                            </div>

                            {/* Rendering target based on selected state */}
                            <div className="w-full h-full overflow-y-auto flex items-center justify-center pt-6 pb-2 custom-scrollbar">
                                
                                {currentState === 'loading' && (
                                    <div className="flex flex-col items-center justify-center text-center p-4 w-full">
                                        <div className="mb-6 text-center">
                                            <div className="text-3xl font-black tracking-tight text-white mb-1.5">PROK VOTE</div>
                                            <div className="text-xs text-muted-foreground font-light">안전한 전자투표 시스템</div>
                                        </div>

                                        <div className="relative mb-8">
                                            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse" />
                                            <svg className="relative w-16 h-16 text-primary animate-bounce" style={{ animationDuration: '2s' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                            </svg>
                                        </div>

                                        <div className="w-full max-w-[200px] mb-5">
                                            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                                                <div className="h-full bg-gradient-to-r from-primary to-accent rounded-full animate-progress" 
                                                    style={{ animation: 'progress 3s ease-in-out infinite', width: '60%' }} />
                                            </div>
                                        </div>
                                        <LoadingMessages />
                                    </div>
                                )}

                                {currentState === 'auth' && (
                                    <AuthFlow
                                        tokenId="preview-token-id"
                                        sessionData={{
                                            name: '제76회 임시 의결 주주총회',
                                            requireAccessCode: true,
                                            accessCode: '123456',
                                        }}
                                        onSuccess={() => setCurrentState('waiting')}
                                    />
                                )}

                                {currentState === 'standby' && (
                                    <WaitingRoom
                                        sessionName="제76회 임시 의결 주주총회"
                                    />
                                )}

                                {currentState === 'waiting' && (
                                    <WaitingRoom
                                        sessionName="제76회 임시 의결 주주총회"
                                        agendaTitle="제1호 안건: 차기 모바일 및 현장 전자투표 적극 도입 승인의 건"
                                        agendaDescription="본 안건은 다음 분기 총회부터 모바일과 현장 무선 투표 방식을 도입하여 주주 및 대의원 참여 편의성을 높이기 위한 정관 및 선거 세칙 변경 안건입니다."
                                        onStageChange={(stage) => {
                                            if (stage === 'voting') setCurrentState('voting');
                                        }}
                                    />
                                )}

                                {currentState === 'voting' && (
                                    <VotingPanel
                                        agenda={mockAgendas[votingAgendaType]}
                                        onVoteComplete={() => setCurrentState('completed')}
                                    />
                                )}

                                {currentState === 'completed' && (
                                    <CompletedScreen stage={completedScreenStage} />
                                )}

                                {currentState === 'results' && (
                                    <ResultPanel
                                        agendaId={
                                            resultsAgendaType === 'INPUT' 
                                                ? 'dummy-input' 
                                                : resultsAgendaType === 'PROS_CONS'
                                                ? 'dummy-pros-cons'
                                                : 'dummy-agenda'
                                        }
                                        agendaTitle={
                                            resultsAgendaType === 'INPUT' 
                                                ? '제4호 안건: 대의원(총대) 선출 및 추천 의견 수렴의 건'
                                                : resultsAgendaType === 'PROS_CONS'
                                                ? '제1호 안건: 정관 일부 변경의 건 (찬반 결과)'
                                                : '제2호 안건: 차기 사외이사 선임의 건 (선택 결과)'
                                        }
                                        onClose={() => setCurrentState('waiting')}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
