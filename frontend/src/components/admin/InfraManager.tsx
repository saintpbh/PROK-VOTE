'use client';

import { useState, useEffect } from 'react';
import Button from '../ui/Button';
import Card from '../ui/Card';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface PresetConfig {
    minInstances: number;
    maxInstances: number;
    memory: string;
    cpu: string;
}

const PRESET_INFO: Record<string, { label: string; description: string; icon: string; color: string }> = {
    standby: {
        label: '대기 모드',
        description: '비용 최소화 · 최소 0대 · 최대 2대',
        icon: '🌙',
        color: 'border-muted-foreground/30 bg-muted/10',
    },
    small: {
        label: '소규모 (100명)',
        description: '소규모 총회 · 최소 1대 · 최대 4대',
        icon: '👥',
        color: 'border-secondary/50 bg-secondary/5',
    },
    medium: {
        label: '중규모 (400명)',
        description: '중규모 총회 · 최소 2대 · 최대 8대 · 메모리 1GiB',
        icon: '🏟️',
        color: 'border-primary/50 bg-primary/5',
    },
    max: {
        label: '최대 (1000명+)',
        description: '대규모 총회 · 최소 4대 · 최대 16대 · 메모리 2GiB · CPU 4코어',
        icon: '🚀',
        color: 'border-success/50 bg-success/5',
    },
};

export default function InfraManager() {
    const [currentPreset, setCurrentPreset] = useState<string>('standby');
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);

    useEffect(() => {
        fetchCurrentPreset();
    }, []);

    const fetchCurrentPreset = async () => {
        setFetching(true);
        try {
            const res = await api.getInfraPreset();
            setCurrentPreset(res.preset || 'standby');
        } catch {
            // Ignore – defaults to standby
        } finally {
            setFetching(false);
        }
    };

    const handlePresetChange = async (preset: string) => {
        if (preset === currentPreset) return;

        setLoading(true);
        try {
            const res = await api.updateInfraPreset(preset as any);
            if (res.success) {
                setCurrentPreset(preset);
                toast.success(res.message || `인프라 프리셋이 '${preset}'(으)로 변경되었습니다`);
            } else {
                toast.error(res.message || '변경 실패');
            }
        } catch (error: any) {
            toast.error(error.message || '인프라 설정 변경 실패');
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return (
            <Card>
                <div className="p-8 text-center text-muted-foreground animate-pulse">
                    인프라 설정 로딩 중...
                </div>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">🖥️ 인프라 성능 관리</h2>
                <span className="text-sm text-muted-foreground">
                    현재: <span className="font-bold text-foreground">{PRESET_INFO[currentPreset]?.label || currentPreset}</span>
                </span>
            </div>

            <p className="text-sm text-muted-foreground">
                총회 규모에 따라 GCP Cloud Run 인스턴스 수와 리소스를 조절합니다.
                비용 절감을 위해 총회 종료 후 &apos;대기 모드&apos;로 전환하세요.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(PRESET_INFO).map(([key, info]) => (
                    <div
                        key={key}
                        onClick={() => !loading && handlePresetChange(key)}
                        className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${
                            currentPreset === key
                                ? `${info.color} ring-2 ring-primary shadow-lg`
                                : `border-border hover:border-muted-foreground/50 hover:bg-muted/20`
                        } ${loading ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-3xl">{info.icon}</span>
                            <div className="flex-1">
                                <div className="font-bold text-lg flex items-center gap-2">
                                    {info.label}
                                    {currentPreset === key && (
                                        <span className="text-xs px-2 py-0.5 bg-primary text-white rounded-full">활성</span>
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground mt-0.5">{info.description}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-3 bg-muted/30 rounded-lg border border-border/50 text-xs text-muted-foreground">
                ⚠️ 프리셋 변경은 즉시 설정이 저장되며, 실제 Cloud Run 인스턴스 조절은 GCP 콘솔에서 적용됩니다.
                비용은 활성 인스턴스 수에 비례합니다.
            </div>
        </div>
    );
}
