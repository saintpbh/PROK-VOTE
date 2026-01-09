'use client';

import { useState, useEffect } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Card from '../ui/Card';
import fingerprintService from '@/lib/fingerprint';
import geolocationService from '@/lib/geolocation';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
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
            // TODO: Enable GPS verification later. Disabled for testing purposes as per user request.
            // const result = await geolocationService.getCurrentPosition();

            // if (!result.success) {
            //    toast.error(result.error || 'GPS 위치를 가져올 수 없습니다');
            //    setLoading(false);
            //    return;
            // }

            // Mock location for testing
            const latitude = 37.5665;
            const longitude = 126.9780;

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
        } catch (error) {
            toast.error('위치 확인에 실패했습니다');
        } finally {
            setLoading(false);
        }
    };

    const handleAccessCodeSubmit = async () => {
        if (authData.accessCode.length !== 4) {
            toast.error('4자리 접속 코드를 입력해주세요');
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

            onSuccess();
        } catch (error: any) {
            toast.error(error.message || '인증에 실패했습니다');
            setStep('code');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md">
            <Card>
                <div className="text-center mb-6">
                    <h1 className="text-3xl font-bold mb-2">PROK Vote</h1>
                    <p className="text-muted-foreground">투표 참여 인증</p>
                </div>

                {/* Progress Indicator */}
                <div className="flex items-center justify-center gap-2 mb-8">
                    <div
                        className={`w-3 h-3 rounded-full ${step !== 'fingerprint' ? 'bg-success' : 'bg-primary animate-pulse'
                            }`}
                    />
                    <div
                        className={`w-3 h-3 rounded-full ${step === 'code' || step === 'processing'
                            ? 'bg-success'
                            : step === 'gps'
                                ? 'bg-primary animate-pulse'
                                : 'bg-muted'
                            }`}
                    />
                    <div
                        className={`w-3 h-3 rounded-full ${step === 'code' || step === 'processing'
                            ? 'bg-primary animate-pulse'
                            : 'bg-muted'
                            }`}
                    />
                </div>

                {/* Step: Fingerprint */}
                {step === 'fingerprint' && (
                    <div className="text-center space-y-4">
                        <div className="text-6xl mb-4">🔐</div>
                        <h2 className="text-xl font-semibold">기기 인식 중...</h2>
                        <p className="text-muted-foreground">
                            잠시만 기다려주세요
                        </p>
                    </div>
                )}

                {/* Step: GPS */}
                {step === 'gps' && (
                    <div className="space-y-6">
                        <div className="text-center">
                            <div className="text-6xl mb-4">📍</div>
                            <h2 className="text-xl font-semibold mb-2">위치 확인</h2>
                            {sessionData?.gpsEnabled ? (
                                <p className="text-muted-foreground">
                                    회의 장소에서 {sessionData.gpsRadius}m 이내에 있어야 합니다
                                </p>
                            ) : (
                                <p className="text-muted-foreground">
                                    위치 정보 확인이 필요합니다
                                </p>
                            )}
                        </div>

                        <Button onClick={getLocation} loading={loading} fullWidth size="lg">
                            위치 확인하기
                        </Button>

                        <p className="text-xs text-muted-foreground text-center">
                            💡 브라우저에서 위치 권한을 요청하면 허용해주세요
                        </p>
                    </div>
                )}

                {/* Step: Access Code */}
                {step === 'code' && (
                    <div className="space-y-6">
                        <div className="text-center">
                            <div className="text-6xl mb-4">🔢</div>
                            <h2 className="text-xl font-semibold mb-2">접속 코드 입력</h2>
                            <p className="text-muted-foreground">
                                화면에 표시된 4자리 코드를 입력하세요
                            </p>
                        </div>

                        {sessionData?.gpsEnabled && authData.distance > 0 && (
                            <div
                                className={`p-3 rounded-lg ${authData.distance <= sessionData.gpsRadius
                                    ? 'bg-success/10 border border-success/30'
                                    : 'bg-danger/10 border border-danger/30'
                                    }`}
                            >
                                <p
                                    className={`text-sm text-center ${authData.distance <= sessionData.gpsRadius
                                        ? 'text-success'
                                        : 'text-danger'
                                        }`}
                                >
                                    {authData.distance <= sessionData.gpsRadius ? '✅' : '⚠️'} 현재
                                    위치: 약 {authData.distance}m
                                </p>
                            </div>
                        )}

                        <div>
                            <Input
                                type="text"
                                placeholder="0000"
                                maxLength={4}
                                value={authData.accessCode}
                                onChange={(e) => {
                                    const value = e.target.value.replace(/\D/g, '');
                                    setAuthData((prev) => ({ ...prev, accessCode: value }));

                                    // Auto-submit on 4 digits
                                    if (value.length === 4) {
                                        setTimeout(() => {
                                            setAuthData((prev) => ({ ...prev, accessCode: value }));
                                        }, 100);
                                    }
                                }}
                                className="text-center text-3xl font-bold tracking-widest"
                            />
                        </div>

                        <Button
                            onClick={handleAccessCodeSubmit}
                            loading={loading}
                            disabled={authData.accessCode.length !== 4}
                            fullWidth
                            size="lg"
                        >
                            인증하기
                        </Button>
                    </div>
                )}

                {/* Step: Processing */}
                {step === 'processing' && (
                    <div className="text-center space-y-4 py-8">
                        <div className="text-6xl mb-4 animate-bounce">✨</div>
                        <h2 className="text-xl font-semibold">인증 처리 중...</h2>
                        <p className="text-muted-foreground">잠시만 기다려주세요</p>
                    </div>
                )}
            </Card>
        </div>
    );
}
