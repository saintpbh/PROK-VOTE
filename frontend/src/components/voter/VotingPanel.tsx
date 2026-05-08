'use client';

import { useState } from 'react';
import Button from '../ui/Button';
import ConfirmationModal from './ConfirmationModal';
import socketService from '@/lib/socket';
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

    console.log('[VotingPanel] agenda:', JSON.stringify({ type: agenda.type, options: agenda.options, title: agenda.title }));

    const isMultiChoice = agenda.type === 'MULTIPLE_CHOICE_MULTI';

    const handleChoiceClick = (choice: string) => {
        setSelectedChoice(choice);
        if (agenda.type !== 'INPUT') {
            setShowConfirmation(true);
        }
        if (navigator.vibrate) {
            navigator.vibrate(200);
        }
    };

    const handleMultiToggle = (option: string) => {
        setSelectedMulti(prev =>
            prev.includes(option)
                ? prev.filter(o => o !== option)
                : [...prev, option]
        );
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
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
                onVoteComplete();
            }, 1000);
        } catch (error: any) {
            toast.error(error.message || '투표에 실패했습니다');
            setLoading(false);
        }
    };

    const getChoiceStyle = (choice: string) => {
        const styles: Record<string, string> = {
            찬성: 'bg-success hover:bg-success/90 text-white',
            반대: 'bg-danger hover:bg-danger/90 text-white',
            기권: 'bg-secondary hover:bg-secondary/90 text-white',
        };
        return styles[choice] || 'bg-primary hover:bg-primary/90 text-white';
    };

    const getChoiceIcon = (choice: string) => {
        const icons: Record<string, string> = {
            찬성: '⭕',
            반대: '❌',
            기권: '➖',
        };
        return icons[choice] || '🗳️';
    };

    return (
        <div className="w-full max-w-lg mx-auto flex flex-col min-h-[calc(100vh-2rem)]">
            {/* Header: agenda info */}
            <div className="text-center space-y-2 pt-2 pb-3 flex-shrink-0">
                <div className="inline-block px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-semibold animate-pulse-slow border border-primary/20">
                    투표 진행 중
                </div>
                <h1 className="text-lg sm:text-xl font-bold text-foreground leading-snug">
                    {agenda.title}
                </h1>
                {agenda.description && (
                    <p className="text-muted-foreground text-sm leading-relaxed">
                        {agenda.description}
                    </p>
                )}
                {isMultiChoice && (
                    <p className="text-xs text-primary font-medium">
                        ✅ 복수 선택 가능 · {selectedMulti.length}개 선택됨
                    </p>
                )}
            </div>

            {/* Voting area: fills remaining space */}
            <div className="flex-1 flex flex-col justify-center">
                {/* PROS_CONS voting */}
                {(agenda.type === 'PROS_CONS' || !agenda.type) && (
                    <div className="grid grid-cols-3 gap-2 sm:gap-3 py-2">
                        <button
                            onClick={() => handleChoiceClick('찬성')}
                            className={`${getChoiceStyle('찬성')} py-6 sm:py-8 rounded-2xl shadow-sm border border-black/5 transition-all duration-150 active:scale-95 flex flex-col items-center justify-center gap-2`}
                        >
                            <span className="text-3xl sm:text-4xl drop-shadow-sm">{getChoiceIcon('찬성')}</span>
                            <span className="text-lg sm:text-xl font-bold">찬성</span>
                        </button>

                        <button
                            onClick={() => handleChoiceClick('반대')}
                            className={`${getChoiceStyle('반대')} py-6 sm:py-8 rounded-2xl shadow-sm border border-black/5 transition-all duration-150 active:scale-95 flex flex-col items-center justify-center gap-2`}
                        >
                            <span className="text-3xl sm:text-4xl drop-shadow-sm">{getChoiceIcon('반대')}</span>
                            <span className="text-lg sm:text-xl font-bold">반대</span>
                        </button>

                        <button
                            onClick={() => handleChoiceClick('기권')}
                            className={`${getChoiceStyle('기권')} py-6 sm:py-8 rounded-2xl shadow-sm border border-black/5 transition-all duration-150 active:scale-95 flex flex-col items-center justify-center gap-2`}
                        >
                            <span className="text-3xl sm:text-4xl opacity-80">{getChoiceIcon('기권')}</span>
                            <span className="text-lg sm:text-xl font-bold">기권</span>
                        </button>
                    </div>
                )}

                {/* MULTIPLE_CHOICE (단일 선택) */}
                {agenda.type === 'MULTIPLE_CHOICE' && (
                    <div className="space-y-2 py-2">
                        {(agenda.options || []).map((option: string, index: number) => (
                            <button
                                key={index}
                                onClick={() => handleChoiceClick(option)}
                                className="w-full p-4 text-left bg-card hover:bg-muted/50 border-2 border-border hover:border-primary rounded-xl transition-all duration-200 flex items-center gap-3 active:scale-98"
                            >
                                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm flex-shrink-0">
                                    {index + 1}
                                </div>
                                <span className="text-base font-medium">{option}</span>
                            </button>
                        ))}
                    </div>
                )}

                {/* MULTIPLE_CHOICE_MULTI (복수 선택) */}
                {agenda.type === 'MULTIPLE_CHOICE_MULTI' && (
                    <div className="space-y-2 py-2">
                        {(agenda.options || []).map((option: string, index: number) => {
                            const isSelected = selectedMulti.includes(option);
                            return (
                                <button
                                    key={index}
                                    onClick={() => handleMultiToggle(option)}
                                    className={`w-full p-4 text-left border-2 rounded-xl transition-all duration-200 flex items-center gap-3 active:scale-98 ${
                                        isSelected
                                            ? 'bg-primary/10 border-primary shadow-md shadow-primary/10'
                                            : 'bg-card hover:bg-muted/50 border-border hover:border-primary/50'
                                    }`}
                                >
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 transition-all duration-200 ${
                                        isSelected
                                            ? 'bg-primary text-white'
                                            : 'bg-muted/50 text-muted-foreground border border-border'
                                    }`}>
                                        {isSelected ? '✓' : index + 1}
                                    </div>
                                    <span className={`text-base font-medium ${isSelected ? 'text-primary' : ''}`}>
                                        {option}
                                    </span>
                                    {isSelected && (
                                        <span className="ml-auto text-primary text-sm">선택됨</span>
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
                            >
                                {selectedMulti.length > 0
                                    ? `${selectedMulti.length}개 선택 · 투표하기`
                                    : '항목을 선택해주세요'}
                            </Button>
                        </div>
                    </div>
                )}

                {/* INPUT type */}
                {agenda.type === 'INPUT' && (
                    <div className="space-y-3 py-2">
                        <textarea
                            className="w-full p-3 text-base border-2 border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background min-h-[120px] resize-none"
                            placeholder="의견을 자유롭게 입력해주세요..."
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                        />
                        <div className="text-right text-xs text-muted-foreground">
                            {inputText.length}자
                        </div>
                        <Button
                            onClick={handleInputSubmit}
                            size="lg"
                            fullWidth
                            disabled={!inputText.trim()}
                        >
                            투표하기
                        </Button>
                    </div>
                )}
            </div>

            {/* Bottom hint */}
            <div className="flex-shrink-0 bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground mb-2">
                <p className="font-semibold mb-1">💡 투표 안내</p>
                <ul className="space-y-0.5">
                    <li>• 한 번 투표하면 변경할 수 없습니다</li>
                    <li>• 신중하게 선택해주세요</li>
                    {isMultiChoice && <li>• 여러 항목을 선택한 후 투표하기 버튼을 눌러주세요</li>}
                </ul>
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

