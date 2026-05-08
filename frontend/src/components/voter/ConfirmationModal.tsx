'use client';

import Modal from '../ui/Modal';
import Button from '../ui/Button';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    choice: string | null;
    onConfirm: () => void;
    loading: boolean;
}

export default function ConfirmationModal({
    isOpen,
    onClose,
    choice,
    onConfirm,
    loading,
}: ConfirmationModalProps) {
    if (!choice) return null;

    const getChoiceColor = (c: string) => {
        const colors: Record<string, string> = {
            찬성: 'text-success',
            반대: 'text-danger',
            기권: 'text-muted-foreground',
        };
        return colors[c] || 'text-primary';
    };

    const getChoiceIcon = (c: string) => {
        const icons: Record<string, string> = {
            찬성: '✅',
            반대: '❌',
            기권: '⏸️',
        };
        return icons[c] || '🗳️';
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="md" closeOnBackdrop={false}>
            {/* Full-height flex container: content scrolls, buttons fixed at bottom */}
            <div className="flex flex-col h-full max-h-[80vh]">
                {/* Scrollable content area */}
                <div className="flex-1 overflow-y-auto text-center space-y-4 py-3 px-1">
                    <div className="text-5xl sm:text-6xl mb-2">{getChoiceIcon(choice)}</div>

                    <h2 className="text-xl font-bold">투표 확인</h2>

                    <div className="p-5 bg-muted/30 rounded-2xl">
                        <p className="text-muted-foreground mb-2 text-sm">선택하신 의견은</p>
                        <p className={`text-4xl sm:text-5xl font-bold ${getChoiceColor(choice)}`}>
                            {choice}
                        </p>
                    </div>

                    <p className="text-muted-foreground text-sm">
                        정말 이 의견으로 투표하시겠습니까?
                    </p>

                    <div className="p-3 bg-danger/10 rounded-lg border border-danger/30">
                        <p className="text-xs text-danger">
                            ⚠️ 한 번 투표하면 변경할 수 없습니다
                        </p>
                    </div>
                </div>

                {/* Fixed bottom buttons — always visible */}
                <div className="flex-shrink-0 grid grid-cols-2 gap-3 pt-3 pb-1 border-t border-border/30 bg-card sticky bottom-0">
                    <Button variant="ghost" onClick={onClose} disabled={loading} fullWidth size="lg">
                        취소
                    </Button>
                    <Button onClick={onConfirm} loading={loading} fullWidth size="lg">
                        확인
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
