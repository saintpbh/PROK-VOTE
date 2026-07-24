'use client';

import { useState } from 'react';
import Button from '../ui/Button';
import ConfirmationModal from './ConfirmationModal';
import socketService from '@/lib/socket';
import haptic from '@/lib/haptic';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

interface VotingPanelProps {
    agenda: any;
    onVoteComplete: () => void;
}

export default function VotingPanel({ agenda, onVoteComplete }: VotingPanelProps) {
    const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
    const [selectedMulti, setSelectedMulti] = useState<string[]>([]);
    const [inputText, setInputText] = useState('');
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [loading, setLoading] = useState(false);
    const { voterId } = useAuthStore();

    const isMultiChoice = agenda.type === 'MULTIPLE_CHOICE_MULTI';

    const handleChoiceClick = (choice: string) => {
        setSelectedChoice(choice);
        if (agenda.type !== 'INPUT') {
            setShowConfirmation(true);
        }
        try { haptic('select'); } catch(e) {}
    };

    const handleMultiToggle = (option: string) => {
        setSelectedMulti(prev =>
            prev.includes(option)
                ? prev.filter(o => o !== option)
                : [...prev, option]
        );
        try { haptic('tap'); } catch(e) {}
    };

    const handleMultiSubmit = () => {
        if (selectedMulti.length === 0) {
            toast.error('하나 이상의 항목을 선택해주세요');
            return;
        }
        setSelectedChoice(selectedMulti.join(', '));
        setShowConfirmation(true);
    };

    const handleInputSubmit = () => {
        if (!inputText.trim()) {
            toast.error('내용을 입력해주세요');
            return;
        }
        setSelectedChoice(inputText.trim());
        setShowConfirmation(true);
    };

    const handleConfirmVote = async () => {
        if (!selectedChoice || !voterId) return;

        setLoading(true);
        try {
            socketService.emit('vote:cast', {
                voterId,
                agendaId: agenda.id,
                choice: selectedChoice,
            });

            setTimeout(() => {
                try { haptic('confirm'); } catch(e) {}
                onVoteComplete();
            }, 1000);
        } catch (error: any) {
            toast.error(error.message || '투표에 실패했습니다');
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md p-4 animate-countup">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-2xl shadow-[0_0_50px_rgba(0,0,0,0.4)]">
                {/* Background decorative glows */}
                <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/20 rounded-full blur-3xl opacity-50 animate-pulse-slow" />
                <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-accent/20 rounded-full blur-3xl opacity-50 animate-pulse-slow" />
                
                {/* Decorative header line */}
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-primary via-accent to-secondary animate-gradient-x" />

                <div className="p-8 space-y-6 relative z-10">
                    
                    {/* Header: agenda info */}
                    <div className="text-center space-y-3">
                        <div className="relative inline-flex items-center px-4 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-xs font-semibold uppercase tracking-wider text-primary">
                            <span className="w-2 h-2 rounded-full bg-primary mr-2 animate-ping" />
                            실시간 투표 진행 중
                        </div>
                        <h1 className="text-xl font-extrabold text-foreground leading-snug break-keep">
                            {agenda.title}
                        </h1>
                        {agenda.description && (
                            <div className="p-4 rounded-2xl bg-black/25 border border-white/5 text-left">
                                <p className="text-muted-foreground text-xs leading-relaxed break-keep font-light">
                                    {agenda.description}
                                </p>
                            </div>
                        )}
                        {isMultiChoice && (
                            <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs text-primary font-medium">
                                <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                                복수 선택 가능 · {selectedMulti.length}개 선택됨
                            </div>
                        )}
                    </div>

                    {/* Voting Options Area */}
                    <div className="space-y-4 py-2">
                        {/* 1. PROS_CONS voting */}
                        {(agenda.type === 'PROS_CONS' || !agenda.type) && (
                            <div className="grid grid-cols-3 gap-2.5">
                                {/* 찬성 */}
                                <button
                                    onClick={() => handleChoiceClick('찬성')}
                                    className="bg-success/10 hover:bg-success/20 border border-success/20 hover:border-success text-success shadow-[0_4px_12px_rgba(34,197,94,0.05)] transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] py-6 rounded-2xl flex flex-col items-center justify-center gap-2 group"
                                >
                                    <span className="text-3xl transition-transform group-hover:scale-110">⭕</span>
                                    <span className="text-sm font-bold tracking-wide">찬성</span>
                                </button>

                                {/* 반대 */}
                                <button
                                    onClick={() => handleChoiceClick('반대')}
                                    className="bg-danger/10 hover:bg-danger/20 border border-danger/20 hover:border-danger text-danger shadow-[0_4px_12px_rgba(239,68,68,0.05)] transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] py-6 rounded-2xl flex flex-col items-center justify-center gap-2 group"
                                >
                                    <span className="text-3xl transition-transform group-hover:scale-110">❌</span>
                                    <span className="text-sm font-bold tracking-wide">반대</span>
                                </button>

                                {/* 기권 */}
                                <button
                                    onClick={() => handleChoiceClick('기권')}
                                    className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 text-muted-foreground hover:text-foreground transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] py-6 rounded-2xl flex flex-col items-center justify-center gap-2 group"
                                >
                                    <span className="text-3xl transition-transform group-hover:scale-110">➖</span>
                                    <span className="text-sm font-bold tracking-wide">기권</span>
                                </button>
                            </div>
                        )}

                        {/* 2. MULTIPLE_CHOICE (단일 선택) */}
                        {agenda.type === 'MULTIPLE_CHOICE' && (
                            <div className="space-y-2.5">
                                {(agenda.options || []).map((option: string, index: number) => (
                                    <button
                                        key={index}
                                        onClick={() => handleChoiceClick(option)}
                                        className="w-full p-4 text-left bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary/40 rounded-2xl transition-all duration-200 flex items-center gap-3 active:scale-[0.98] group"
                                    >
                                        <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                                            {index + 1}
                                        </div>
                                        <span className="text-sm font-medium text-foreground tracking-wide">{option}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* 3. MULTIPLE_CHOICE_MULTI (복수 선택) */}
                        {agenda.type === 'MULTIPLE_CHOICE_MULTI' && (
                            <div className="space-y-2.5">
                                {(agenda.options || []).map((option: string, index: number) => {
                                    const isSelected = selectedMulti.includes(option);
                                    return (
                                        <button
                                            key={index}
                                            onClick={() => handleMultiToggle(option)}
                                            className={`w-full p-4 text-left border rounded-2xl transition-all duration-200 flex items-center gap-3 active:scale-[0.98] ${
                                                isSelected
                                                    ? 'bg-primary/10 border-primary shadow-[0_0_12px_rgba(var(--primary),0.15)]'
                                                    : 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-primary/30'
                                            }`}
                                        >
                                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-extrabold text-xs flex-shrink-0 transition-all duration-200 ${
                                                isSelected
                                                    ? 'bg-primary text-white'
                                                    : 'bg-black/20 text-muted-foreground border border-white/10'
                                            }`}>
                                                {isSelected ? '✓' : index + 1}
                                            </div>
                                            <span className={`text-sm font-medium transition-colors ${
                                                isSelected ? 'text-primary font-bold' : 'text-foreground'
                                            }`}>
                                                {option}
                                            </span>
                                            {isSelected && (
                                                <span className="ml-auto text-primary text-xs font-semibold animate-pulse">선택됨</span>
                                            )}
                                        </button>
                                    );
                                })}
                                <div className="pt-3">
                                    <Button
                                        onClick={handleMultiSubmit}
                                        size="lg"
                                        fullWidth
                                        disabled={selectedMulti.length === 0}
                                        className="rounded-2xl py-4 font-bold shadow-md active:scale-[0.98]"
                                    >
                                        {selectedMulti.length > 0
                                            ? `${selectedMulti.length}개 선택 · 투표 제출`
                                            : '항목을 선택해주세요'}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* 4. INPUT (주관식) */}
                        {agenda.type === 'INPUT' && (
                            <div className="space-y-3">
                                <textarea
                                    className="w-full p-4 text-sm border border-white/10 rounded-2xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-black/25 min-h-[120px] resize-none text-foreground placeholder-muted-foreground focus:outline-none transition-all font-light leading-relaxed custom-scrollbar"
                                    placeholder="의견을 자유롭게 입력해주세요..."
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                />
                                <div className="text-right text-xs text-muted-foreground/60 font-light">
                                    {inputText.length}자 입력됨
                                </div>
                                <Button
                                    onClick={handleInputSubmit}
                                    size="lg"
                                    fullWidth
                                    disabled={!inputText.trim()}
                                    className="rounded-2xl py-4 font-bold shadow-md active:scale-[0.98]"
                                >
                                    투표 제출하기
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Bottom hint card */}
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5 text-xs text-muted-foreground/80 font-light space-y-1.5">
                        <p className="font-semibold text-foreground/90 flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            투표 안내
                        </p>
                        <ul className="space-y-1 list-disc pl-4">
                            <li>한 번 투표하면 수정하거나 변경할 수 없습니다.</li>
                            <li>신중하게 선택 후 확인 창에서 제출해주십시오.</li>
                            {isMultiChoice && <li>원하는 항목을 모두 체크한 뒤 최종 투표 제출 버튼을 클릭해 주세요.</li>}
                        </ul>
                    </div>

                </div>
            </div>

            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={showConfirmation}
                onClose={() => {
                    setShowConfirmation(false);
                    setSelectedChoice(null);
                }}
                choice={selectedChoice}
                onConfirm={handleConfirmVote}
                loading={loading}
            />
        </div>
    );
}
