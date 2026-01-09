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
            <div className="text-center space-y-6 py-4">
                <div className="text-8xl mb-4">{getChoiceIcon(choice)}</div>

                <h2 className="text-2xl font-bold">투표 확인</h2>

                <div className="p-8 bg-muted/30 rounded-2xl">
                    <p className="text-muted-foreground mb-3">선택하신 의견은</p>
                    <p className={`text-8xl font-bold ${getChoiceColor(choice)}`}>
                        {choice}
                    </p>
                </div>

                <p className="text-muted-foreground">
                    정말 이 의견으로 투표하시겠습니까?
                </p>

                <div className="p-4 bg-danger/10 rounded-lg border border-danger/30">
                    <p className="text-sm text-danger">
                        ⚠️ 한 번 투표하면 변경할 수 없습니다
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4">
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
