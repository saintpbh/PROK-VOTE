'use client';

import { useState, useRef, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ReauthModalProps {
    voterId: string;
    sessionId: string;
    onSuccess: (newToken: string) => void;
}

export default function ReauthModal({ voterId, sessionId, onSuccess }: ReauthModalProps) {
    const [code, setCode] = useState(['', '', '', '']);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [retryCountdown, setRetryCountdown] = useState(0);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const retryCountRef = useRef(0);
    const lastCodeRef = useRef('');

    useEffect(() => {
        inputRefs.current[0]?.focus();
    }, []);

    const handleInput = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return;
        const newCode = [...code];
        newCode[index] = value.slice(-1);
        setCode(newCode);
        setError('');

        if (value && index < 3) {
            inputRefs.current[index + 1]?.focus();
        }

        // Auto-submit when all 4 digits entered
        if (index === 3 && value) {
            const fullCode = [...newCode.slice(0, 3), value.slice(-1)].join('');
            if (fullCode.length === 4) {
                retryCountRef.current = 0;
                handleSubmit(fullCode);
            }
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !code[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleSubmit = async (fullCode?: string) => {
        const accessCode = fullCode || code.join('');
        if (accessCode.length !== 4) {
            setError('4자리 코드를 입력해주세요');
            return;
        }
        lastCodeRef.current = accessCode;

        setLoading(true);
        setError('');

        try {
            const res = await fetch(`${API_URL}/auth/reverify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ voterId, sessionId, accessCode }),
            });

            if (res.status === 429 && retryCountRef.current < 3) {
                // Rate limited — auto retry
                retryCountRef.current++;
                setError(`서버 혼잡 — ${3}초 후 자동 재시도 (${retryCountRef.current}/3)`);
                setLoading(false);
                setRetryCountdown(3);
                const countdownInterval = setInterval(() => {
                    setRetryCountdown(prev => {
                        if (prev <= 1) { clearInterval(countdownInterval); return 0; }
                        return prev - 1;
                    });
                }, 1000);
                setTimeout(() => handleSubmit(lastCodeRef.current), 3000);
                return;
            }

            const data = await res.json();

            if (data.success && data.accessToken) {
                onSuccess(data.accessToken);
            } else {
                setError(data.message || '잘못된 참여 코드입니다');
                setCode(['', '', '', '']);
                inputRefs.current[0]?.focus();
            }
        } catch (e) {
            if (retryCountRef.current < 3) {
                retryCountRef.current++;
                setError(`연결 실패 — ${3}초 후 자동 재시도 (${retryCountRef.current}/3)`);
                setRetryCountdown(3);
                const countdownInterval = setInterval(() => {
                    setRetryCountdown(prev => {
                        if (prev <= 1) { clearInterval(countdownInterval); return 0; }
                        return prev - 1;
                    });
                }, 1000);
                setTimeout(() => handleSubmit(lastCodeRef.current), 3000);
            } else {
                setError('서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-background flex flex-col items-center justify-center z-50 p-8">
            <div className="fixed inset-0 bg-gradient-to-br from-amber-500/10 via-background to-primary/10 -z-10" />
            
            {/* Warning Icon */}
            <div className="relative mb-6">
                <div className="absolute inset-0 bg-amber-500/20 blur-3xl rounded-full animate-pulse" />
                <svg className="relative w-16 h-16 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
            </div>

            <h2 className="text-xl font-bold text-white mb-2">참여 코드가 변경되었습니다</h2>
            <p className="text-muted-foreground text-sm mb-8 text-center">
                새로운 참여 코드를 입력하면<br />투표를 계속할 수 있습니다
            </p>

            {/* Code Input */}
            <div className="flex gap-3 mb-6">
                {code.map((digit, i) => (
                    <input
                        key={i}
                        ref={el => { inputRefs.current[i] = el; }}
                        type="tel"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={e => handleInput(i, e.target.value)}
                        onKeyDown={e => handleKeyDown(i, e)}
                        disabled={loading}
                        className="w-16 h-20 text-center text-3xl font-bold bg-white/10 border-2 border-white/20 rounded-2xl text-white
                            focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30 focus:outline-none
                            transition-all duration-200 disabled:opacity-50"
                    />
                ))}
            </div>

            {error && (
                <p className="text-red-400 text-sm mb-4 animate-fade-in">{error}</p>
            )}

            {loading && (
                <div className="flex items-center gap-2 text-amber-400">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm">인증 중...</span>
                </div>
            )}
        </div>
    );
}
