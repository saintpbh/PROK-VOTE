'use client';

import { useState, useEffect } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Card from '../ui/Card';
import fingerprintService from '@/lib/fingerprint';
import geolocationService from '@/lib/geolocation';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import haptic from '@/lib/haptic';
import toast from 'react-hot-toast';

interface AuthFlowProps {
    tokenId: string;
    sessionData: any;
    onSuccess: () => void;
}

type AuthStep = 'fingerprint' | 'gps' | 'code' | 'processing';

export default function AuthFlow({ tokenId, sessionData, onSuccess }: AuthFlowProps) {
    const [step, setStep] = useState<AuthStep>('fingerprint');
    const [loading, setLoading] = useState(false);
    const { login } = useAuthStore();

    const [authData, setAuthData] = useState({
        fingerprint: '',
        latitude: 0,
        longitude: 0,
        distance: 0,
        accessCode: '',
    });

    useEffect(() => {
        getFingerprint();
    }, []);

    const getFingerprint = async () => {
        try {
            const fp = await fingerprintService.getFingerprint();
            setAuthData((prev) => ({ ...prev, fingerprint: fp }));
            setStep('gps');
            haptic('press');
        } catch (error) {
            toast.error('기기 인식에 실패했습니다');
            console.error(error);
        }
    };

    // Effect to handle step transitions based on session settings
    useEffect(() => {
        if (step === 'gps' && sessionData && !sessionData.gpsEnabled) {
            setStep('code');
        }
    }, [step, sessionData]);

    const getLocation = async () => {
        setLoading(true);
        try {
            const result = await geolocationService.getCurrentPosition();
            let latitude = 37.5665;
            let longitude = 126.9780;
            let usingFallback = false;

            const isLocal = typeof window !== 'undefined' && (
                window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1' ||
                window.location.hostname.startsWith('192.168.') ||
                window.location.hostname.startsWith('10.') ||
                window.location.hostname.startsWith('172.') ||
                process.env.NODE_ENV === 'development'
            );

            if (!result.success || !result.location) {
                if (isLocal) {
                    usingFallback = true;
                    toast.success('로컬 테스트 환경: 모의 위치를 사용합니다.');
                } else {
                    toast.error(result.error || 'GPS 위치를 가져올 수 없습니다. 브라우저 위치 권한을 확인해주세요.');
                    setLoading(false);
                    return;
                }
            } else {
                latitude = result.location.latitude;
                longitude = result.location.longitude;
            }

            // Calculate distance if GPS is enabled
            let distance = 0;
            if (sessionData?.gpsEnabled && sessionData.gpsLat && sessionData.gpsLng) {
                distance = geolocationService.calculateDistance(
                    { latitude, longitude },
                    { latitude: sessionData.gpsLat, longitude: sessionData.gpsLng }
                );
            }

            setAuthData((prev) => ({
                ...prev,
                latitude,
                longitude,
                distance: Math.round(distance),
            }));

            setStep('code');
            haptic('success');
        } catch (error) {
            toast.error('위치 확인에 실패했습니다');
        } finally {
            setLoading(false);
        }
    };

    const handleAccessCodeSubmit = async () => {
        if (authData.accessCode.length !== 4) {
            toast.error('4자리 참여 코드를 입력해주세요');
            return;
        }

        setLoading(true);
        setStep('processing');

        try {
            const response = await api.completeAuth({
                tokenId,
                deviceFingerprint: authData.fingerprint,
                latitude: authData.latitude,
                longitude: authData.longitude,
                accessCode: authData.accessCode,
                skipGPS: !sessionData?.gpsEnabled,
            });

            // Store auth data
            login(
                response.accessToken,
                response.voter.id,
                response.voter.sessionId,
                tokenId
            );

            haptic('success');
            onSuccess();
        } catch (error: any) {
            haptic('error');
            toast.error(error.message || '인증에 실패했습니다');
            setStep('code');
        } finally {
            setLoading(false);
        }
    };

    const [isFocused, setIsFocused] = useState(false);

    return (
        <div className={`w-full max-w-md p-2 sm:p-4 animate-countup transition-all duration-300 ${
            isFocused ? '-translate-y-12 sm:translate-y-0' : ''
        }`}>
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-2xl shadow-[0_0_50px_rgba(0,0,0,0.4)]">
                {/* Decorative glowing backdrops */}
                <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/20 rounded-full blur-3xl opacity-50 animate-pulse-slow" />
                <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-accent/20 rounded-full blur-3xl opacity-50 animate-pulse-slow" />
                
                {/* Top thin aesthetic bar */}
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-primary via-accent to-secondary animate-gradient-x" />

                <div className="p-8 space-y-8 relative z-10">
                    <div className="text-center space-y-3">
                        <div className="text-[11px] font-bold tracking-widest text-primary/80 uppercase">PROK VOTE</div>
                        {sessionData?.name ? (
                            <div className="space-y-1">
                                <h1 className="text-2xl font-black text-foreground tracking-tight break-keep">
                                    {sessionData.name}
                                </h1>
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-bold">
                                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                    <span>현재 접속 세션</span>
                                </div>
                            </div>
                        ) : (
                            <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
                                PROK Vote
                            </h1>
                        )}
                        <p className="text-xs font-light text-muted-foreground tracking-wider uppercase pt-1">
                            투표 참여 인증
                        </p>
                    </div>

                    {/* Sleek Segmented Progress Bar */}
                    <div className="flex items-center justify-between gap-2.5 px-2">
                        <div className={`h-[3px] flex-1 rounded-full transition-all duration-300 ${
                            step !== 'fingerprint' ? 'bg-success' : 'bg-primary animate-pulse'
                        }`} />
                        {sessionData?.gpsEnabled && (
                            <div className={`h-[3px] flex-1 rounded-full transition-all duration-300 ${
                                step === 'gps'
                                    ? 'bg-primary animate-pulse'
                                    : step === 'code' || step === 'processing'
                                    ? 'bg-success'
                                    : 'bg-white/15'
                            }`} />
                        )}
                        <div className={`h-[3px] flex-1 rounded-full transition-all duration-300 ${
                            step === 'code'
                                ? 'bg-primary animate-pulse'
                                : step === 'processing'
                                ? 'bg-success'
                                : 'bg-white/15'
                        }`} />
                    </div>

                    {/* Step: Fingerprint */}
                    {step === 'fingerprint' && (
                        <div className="text-center space-y-6 py-6">
                            <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 shadow-inner">
                                <svg className="w-8 h-8 text-primary animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-xl font-bold text-foreground">기기 식별 중</h2>
                                <p className="text-sm text-muted-foreground font-light leading-relaxed break-keep">
                                    보안을 위해 기기 고유 정보를 확인하고 있습니다.<br />잠시만 기다려주세요.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Step: GPS */}
                    {step === 'gps' && (
                        <div className="space-y-6 py-2">
                            <div className="text-center space-y-3">
                                <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 shadow-inner">
                                    <svg className="w-8 h-8 text-primary animate-bounce-slight" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </div>
                                <h2 className="text-xl font-bold text-foreground">위치 인증</h2>
                                {sessionData?.gpsEnabled ? (
                                    <p className="text-sm text-muted-foreground font-light break-keep">
                                        투표 진행을 위해 회의 장소 기준<br />
                                        <span className="text-primary font-semibold">{sessionData.gpsRadius}m 이내</span> 위치 인증이 필요합니다.
                                    </p>
                                ) : (
                                    <p className="text-sm text-muted-foreground font-light break-keep">
                                        현장 투표 진행을 위한 위치 정보 확인이 필요합니다.
                                    </p>
                                )}
                            </div>

                            <Button onClick={getLocation} loading={loading} fullWidth size="lg" className="rounded-2xl py-4 font-bold shadow-md">
                                위치 확인하기
                            </Button>

                            <p className="text-xs text-muted-foreground/80 text-center font-light">
                                💡 브라우저 상단의 위치 권한 요청을 승인해주세요
                            </p>
                        </div>
                    )}

                    {/* Step: Access Code */}
                    {step === 'code' && (
                        <div className="space-y-4 pt-1">
                            <div className="text-center space-y-2">
                                <div className="relative inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 shadow-inner">
                                    <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                </div>
                                <h2 className="text-lg font-bold text-foreground">참여코드 입력</h2>
                                <p className="text-xs text-muted-foreground font-semibold break-keep">
                                    전광판에 표시된 참여코드를 입력하세요!
                                </p>
                            </div>

                            {sessionData?.gpsEnabled && authData.distance > 0 && (
                                <div className={`p-3 rounded-2xl text-xs font-semibold text-center border transition-colors ${
                                    authData.distance <= sessionData.gpsRadius
                                        ? 'bg-success/5 border-success/20 text-success'
                                        : 'bg-danger/5 border-danger/20 text-danger'
                                }`}>
                                    <span className="inline-block w-1.5 h-1.5 rounded-full mr-2 bg-current animate-pulse" />
                                    현재 위치: 기준지로부터 약 {authData.distance}m
                                    ({authData.distance <= sessionData.gpsRadius ? '승인 범위 내' : '범위 초과'})
                                </div>
                            )}

                            {/* Custom 4-digit input UI */}
                            <div className="relative py-2 space-y-3">
                                <input
                                    type="tel"
                                    pattern="[0-9]*"
                                    inputMode="numeric"
                                    maxLength={4}
                                    value={authData.accessCode}
                                    onChange={(e) => {
                                        const value = e.target.value.replace(/\D/g, '');
                                        setAuthData((prev) => ({ ...prev, accessCode: value }));
                                        if (value.length > authData.accessCode.length) {
                                            try { haptic('tap'); } catch (e) {}
                                        }
                                    }}
                                    onFocus={(e) => {
                                        setIsFocused(true);
                                        const target = e.target;
                                        setTimeout(() => {
                                            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        }, 250);
                                    }}
                                    onBlur={() => setIsFocused(false)}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                                    autoFocus
                                />
                                
                                <div className="flex justify-center gap-3">
                                    {[0, 1, 2, 3].map((index) => {
                                        const char = authData.accessCode[index] || '';
                                        const isCurrent = index === authData.accessCode.length;
                                        const isFilled = index < authData.accessCode.length;
                                        
                                        return (
                                            <div
                                                key={index}
                                                className={`w-14 h-16 sm:w-16 sm:h-20 rounded-2xl flex items-center justify-center text-3xl font-extrabold border-2 transition-all duration-200 select-none ${
                                                    isCurrent && isFocused
                                                        ? 'border-primary bg-primary/5 text-primary shadow-[0_0_15px_rgba(var(--primary),0.25)] scale-105'
                                                        : isFilled
                                                        ? 'border-white/20 bg-white/5 text-foreground'
                                                        : 'border-white/10 bg-black/10 text-muted-foreground/30'
                                                }`}
                                            >
                                                {char}
                                                {isCurrent && isFocused && (
                                                    <span className="w-[2px] h-6 bg-primary animate-pulse ml-0.5" />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="text-center text-xs text-muted-foreground/60 tracking-wider">
                                    참여코드를 입력하세요
                                </div>
                            </div>

                            <Button
                                onClick={handleAccessCodeSubmit}
                                loading={loading}
                                disabled={authData.accessCode.length !== 4}
                                fullWidth
                                size="lg"
                                className="rounded-2xl py-4 font-bold shadow-md active:scale-[0.98]"
                            >
                                인증 후 투표시작
                            </Button>
                        </div>
                    )}

                    {/* Step: Processing */}
                    {step === 'processing' && (
                        <div className="text-center space-y-6 py-8">
                            <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 shadow-inner">
                                <svg className="w-8 h-8 text-primary animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-xl font-bold text-foreground">인증 처리 중</h2>
                                <p className="text-sm text-muted-foreground font-light">잠시만 기다려주세요...</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
