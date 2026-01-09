'use client';

import { useState } from 'react';
import Button from '../ui/Button';
import Card from '../ui/Card';
import ConfirmationModal from './ConfirmationModal';
import socketService from '@/lib/socket';
import { useAuthStore } from '@/store/authStore';
import { VoteChoice } from '@/store/votingStore';
import toast from 'react-hot-toast';

interface VotingPanelProps {
    agenda: any;
    onVoteComplete: () => void;
}

export default function VotingPanel({ agenda, onVoteComplete }: VotingPanelProps) {
    // Determine initial choice type based on agenda type
    const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
    const [inputText, setInputText] = useState('');
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [loading, setLoading] = useState(false);
    const { voterId } = useAuthStore();

    const handleChoiceClick = (choice: string) => {
        setSelectedChoice(choice);
        if (agenda.type !== 'INPUT') {
            setShowConfirmation(true);
        }

        // Haptic feedback
        if (navigator.vibrate) {
            navigator.vibrate(200);
        }
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
            // Emit vote via WebSocket
            socketService.emit('vote:cast', {
                voterId,
                agendaId: agenda.id,
                choice: selectedChoice,
            });

            // Wait for confirmation event (handled in parent component)
            // The parent will transition to completed state
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
            찬성: 'bg-gradient-to-br from-success to-success/80 hover:from-success/90 hover:to-success/70',
            반대: 'bg-gradient-to-br from-danger to-danger/80 hover:from-danger/90 hover:to-danger/70',
            기권: 'bg-gradient-to-br from-muted to-muted/80 hover:from-muted/90 hover:to-muted/70',
        };
        // Generate valid class strings instead of using arbitrary strings that might be purged
        return styles[choice] || 'bg-gradient-to-br from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70';
    };

    const getChoiceIcon = (choice: string) => {
        const icons: Record<string, string> = {
            찬성: '✅',
            반대: '❌',
            기권: '⏸️',
        };
        return icons[choice] || '🗳️';
    };

    return (
        <div className="w-full max-w-2xl">
            <Card>
                <div className="space-y-6">
                    {/* Agenda Information */}
                    <div className="text-center space-y-3">
                        <div className="inline-block px-3 py-1 bg-success/20 text-success rounded-full text-sm font-semibold animate-pulse-slow">
                            투표 진행 중
                        </div>
                        <h1 className="text-2xl md:text-3xl font-bold">
                            {agenda.title}
                        </h1>
                        {agenda.description && (
                            <p className="text-muted-foreground">
                                {agenda.description}
                            </p>
                        )}
                    </div>

                    {/* Voting Buttons */}
                    {/* Voting Buttons based on Type */}
                    {(agenda.type === 'PROS_CONS' || !agenda.type) && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-6">
                            <button
                                onClick={() => handleChoiceClick('찬성')}
                                className={`${getChoiceStyle(
                                    '찬성'
                                )} text-white p-8 rounded-2xl shadow-lg transition-all duration-150 hover:scale-105 active:scale-95 flex flex-col items-center justify-center gap-3`}
                            >
                                <span className="text-6xl">{getChoiceIcon('찬성')}</span>
                                <span className="text-2xl font-bold">찬성</span>
                            </button>

                            <button
                                onClick={() => handleChoiceClick('반대')}
                                className={`${getChoiceStyle(
                                    '반대'
                                )} text-white p-8 rounded-2xl shadow-lg transition-all duration-150 hover:scale-105 active:scale-95 flex flex-col items-center justify-center gap-3`}
                            >
                                <span className="text-6xl">{getChoiceIcon('반대')}</span>
                                <span className="text-2xl font-bold">반대</span>
                            </button>

                            <button
                                onClick={() => handleChoiceClick('기권')}
                                className={`${getChoiceStyle(
                                    '기권'
                                )} text-white p-8 rounded-2xl shadow-lg transition-all duration-150 hover:scale-105 active:scale-95 flex flex-col items-center justify-center gap-3`}
                            >
                                <span className="text-6xl">{getChoiceIcon('기권')}</span>
                                <span className="text-2xl font-bold">기권</span>
                            </button>
                        </div>
                    )}

                    {agenda.type === 'MULTIPLE_CHOICE' && (
                        <div className="space-y-3 py-4">
                            {(agenda.options || []).map((option: string, index: number) => (
                                <button
                                    key={index}
                                    onClick={() => handleChoiceClick(option)}
                                    className="w-full p-6 text-left bg-card hover:bg-muted/50 border-2 border-border hover:border-primary rounded-xl transition-all duration-200 flex items-center gap-4 group active:scale-98"
                                >
                                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold group-hover:bg-primary group-hover:text-white transition-colors">
                                        {index + 1}
                                    </div>
                                    <span className="text-xl font-medium">{option}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {agenda.type === 'INPUT' && (
                        <div className="space-y-4 py-6">
                            <div className="relative">
                                <textarea
                                    className="w-full p-4 text-lg border-2 border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background min-h-[150px] resize-none"
                                    placeholder="의견을 자유롭게 입력해주세요..."
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                />
                                <div className="text-right text-xs text-muted-foreground mt-1">
                                    {inputText.length}자
                                </div>
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

                    {/* Instructions */}
                    <div className="bg-muted/30 rounded-lg p-4 text-sm text-muted-foreground">
                        <p className="font-semibold mb-2">💡 투표 안내</p>
                        <ul className="space-y-1">
                            <li>• 한 번 투표하면 변경할 수 없습니다</li>
                            <li>• 신중하게 선택해주세요</li>
                            <li>• 투표 후 결과 발표를 기다려주세요</li>
                        </ul>
                    </div>
                </div>
            </Card>

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
