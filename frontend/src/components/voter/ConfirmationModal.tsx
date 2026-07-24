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
            찬성: 'text-success drop-shadow-[0_0_15px_rgba(34,197,94,0.3)]',
            반대: 'text-danger drop-shadow-[0_0_15px_rgba(239,68,68,0.3)]',
            기권: 'text-muted-foreground/70',
        };
        return colors[c] || 'text-primary';
    };

    const getChoiceIcon = (c: string) => {
        const icons: Record<string, string> = {
            찬성: '⭕',
            반대: '❌',
            기권: '➖',
        };
        return icons[c] || '🗳️';
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="sm" closeOnBackdrop={false}>
            {/* Custom inner glass card styling */}
            <div className="flex flex-col h-full max-h-[85vh] p-4 text-center space-y-6">
                
                {/* Header Icon */}
                <div className="relative h-20 w-20 mx-auto flex items-center justify-center">
                    <div className="absolute inset-0 bg-primary/10 rounded-full blur-xl animate-pulse" />
                    <div className="relative w-full h-full rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-4xl shadow-inner animate-bounce-slight">
                        {getChoiceIcon(choice)}
                    </div>
                </div>

                <div className="space-y-1">
                    <h2 className="text-xl font-extrabold text-foreground">투표 선택 확인</h2>
                    <p className="text-xs text-muted-foreground font-light">선택하신 내용을 최종 확인해주세요.</p>
                </div>

                {/* Choice display card */}
                <div className="p-6 rounded-2xl bg-black/35 border border-white/5 space-y-1.5 shadow-inner">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">선택한 의견</p>
                    <p className={`text-3xl sm:text-4xl font-extrabold tracking-wide ${getChoiceColor(choice)}`}>
                        {choice}
                    </p>
                </div>

                <div className="space-y-4">
                    <p className="text-sm text-foreground/90 font-light break-keep px-2">
                        의장의 안내에 따라 위 의견으로 투표를 제출하시겠습니까?
                    </p>

                    {/* Security warning banner */}
                    <div className="p-3 rounded-2xl bg-danger/5 border border-danger/15 flex items-center justify-center gap-2 text-danger">
                        <svg className="w-4 h-4 text-danger animate-pulse flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span className="text-[11px] font-bold tracking-wide">한 번 제출한 투표는 수정이 불가능합니다.</span>
                    </div>
                </div>

                {/* Buttons container */}
                <div className="grid grid-cols-2 gap-3 pt-3">
                    <Button 
                        variant="ghost" 
                        onClick={onClose} 
                        disabled={loading} 
                        fullWidth 
                        size="lg"
                        className="rounded-2xl border-white/10 text-muted-foreground hover:text-foreground py-3.5"
                    >
                        취소
                    </Button>
                    <Button 
                        onClick={onConfirm} 
                        loading={loading} 
                        fullWidth 
                        size="lg"
                        className="rounded-2xl py-3.5 font-bold shadow-md bg-gradient-to-r from-primary to-accent"
                    >
                        제출 확정
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
