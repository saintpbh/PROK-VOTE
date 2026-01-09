'use client';

import { useState, useEffect } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Card from '../ui/Card';
import fingerprintService from '@/lib/fingerprint';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

interface GlobalAuthFlowProps {
    sessionId: string;
    sessionData: any;
    onSuccess: () => void;
}

type AuthStep = 'name' | 'fingerprint' | 'gps' | 'code' | 'processing';

export default function GlobalAuthFlow({ sessionId, sessionData, onSuccess }: GlobalAuthFlowProps) {
    const [step, setStep] = useState<AuthStep>('name');
    const [loading, setLoading] = useState(false);
    const { login } = useAuthStore();

    const [authData, setAuthData] = useState({
        name: '',
        fingerprint: '',
        latitude: 0,
        longitude: 0,
        accessCode: '',
    });

    const handleNameSubmit = () => {
        if (authData.name.trim().length < 2) {
            toast.error('이름을 2자 이상 입력해주세요');
            return;
        }
        setStep('fingerprint');
        getFingerprint();
    };

    const getFingerprint = async () => {
        try {
            const fp = await fingerprintService.getFingerprint();
            setAuthData((prev) => ({ ...prev, fingerprint: fp }));
            if (sessionData?.gpsEnabled) {
                setStep('gps');
            } else {
                setStep('code');
            }
        } catch (error) {
            toast.error('기기 인식에 실패했습니다');
            setStep('code');
        }
    };

    const getLocation = async () => {
        setLoading(true);
        try {
            // Mock location for testing as per user request
            const latitude = 37.5665;
            const longitude = 126.9780;

            setAuthData((prev) => ({
                ...prev,
                latitude,
                longitude,
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
            const response = await api.completeGlobalAuth({
                sessionId,
                name: authData.name,
                deviceFingerprint: authData.fingerprint,
                latitude: authData.latitude,
                longitude: authData.longitude,
                accessCode: authData.accessCode,
                skipGPS: !sessionData?.gpsEnabled,
            });

            // Store auth data (Reuse existing login but pass empty/global tokenId)
            login(
                response.accessToken,
                response.voter.id,
                response.voter.sessionId,
                'GLOBAL'
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
                    <h1 className="text-3xl font-bold mb-2">{sessionData?.name || 'PROK Vote'}</h1>
                    <p className="text-muted-foreground">투표 참여 인증</p>
                </div>

                {/* Step Content */}
                <div className="space-y-6">
                    {step === 'name' && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className="text-6xl mb-4">👤</div>
                                <h2 className="text-xl font-semibold mb-2">이름 입력</h2>
                                <p className="text-muted-foreground">본인 확인을 위해 성함을 입력해주세요</p>
                            </div>
                            <Input
                                type="text"
                                placeholder="이름을 입력하세요"
                                value={authData.name}
                                onChange={(e) => setAuthData(prev => ({ ...prev, name: e.target.value }))}
                                className="text-center text-xl font-bold"
                            />
                            <Button onClick={handleNameSubmit} fullWidth size="lg">
                                다음 단계
                            </Button>
                        </div>
                    )}

                    {step === 'fingerprint' && (
                        <div className="text-center space-y-4 py-8">
                            <div className="text-6xl mb-4">🔐</div>
                            <h2 className="text-xl font-semibold animate-pulse">기속 기기 인식 중...</h2>
                        </div>
                    )}

                    {step === 'gps' && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className="text-6xl mb-4">📍</div>
                                <h2 className="text-xl font-semibold mb-2">위치 확인</h2>
                                <p className="text-muted-foreground">회의 장소 내에 있는지 확인합니다</p>
                            </div>
                            <Button onClick={getLocation} loading={loading} fullWidth size="lg">
                                위치 확인하기
                            </Button>
                        </div>
                    )}

                    {step === 'code' && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className="text-6xl mb-4">🔢</div>
                                <h2 className="text-xl font-semibold mb-2">접속 코드 입력</h2>
                                <p className="text-muted-foreground">화면의 4자리 코드를 입력하세요</p>
                            </div>
                            <Input
                                type="text"
                                maxLength={4}
                                value={authData.accessCode}
                                onChange={(e) => setAuthData(prev => ({ ...prev, accessCode: e.target.value.replace(/\D/g, '') }))}
                                className="text-center text-3xl font-bold tracking-widest"
                                placeholder="0000"
                            />
                            <Button onClick={handleAccessCodeSubmit} loading={loading} disabled={authData.accessCode.length !== 4} fullWidth size="lg">
                                인증 및 시작
                            </Button>
                        </div>
                    )}

                    {step === 'processing' && (
                        <div className="text-center space-y-4 py-8">
                            <div className="text-6xl mb-4 animate-bounce">✨</div>
                            <h2 className="text-xl font-semibold">인증 처리 중...</h2>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
}
