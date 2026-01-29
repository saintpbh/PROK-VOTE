'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import SystemMonitor from './SystemMonitor';

export default function SystemSettings() {
    const [settings, setSettings] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await api.getAllSettings();
            setSettings(res.settings || []);
        } catch (error) {
            console.error('Failed to fetch settings:', error);
            toast.error('설정을 불러오지 못했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (key: string, value: string, type: string) => {
        setIsSaving(true);
        try {
            await api.updateSetting(key, value, type);
            toast.success('설정이 저장되었습니다.');
            fetchSettings();
        } catch (error) {
            console.error('Failed to update setting:', error);
            toast.error('저장에 실패했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    const rateLimit = settings.find(s => s.key === 'RATE_LIMIT');

    if (isLoading) {
        return <div className="text-center py-12">로딩 중...</div>;
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                    ⚙️ 시스템 전역 설정
                </h2>

                <div className="mb-10">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                        📊 서버 실시간 모니터링
                    </h3>
                    <SystemMonitor />
                </div>

                <div className="space-y-8">
                    {/* Rate Limit Setting */}
                    <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex-1">
                                <h3 className="text-lg font-semibold mb-1">API 속도 제한 (Rate Limit)</h3>
                                <p className="text-sm text-muted-foreground">
                                    동일 IP당 분당 최대 요청 가능 횟수를 설정합니다.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    defaultValue={rateLimit?.value || '10000'}
                                    className="w-32 p-2 rounded-md border border-input bg-background font-mono text-center"
                                    id="rate_limit_input"
                                />
                                <button
                                    onClick={() => {
                                        const val = (document.getElementById('rate_limit_input') as HTMLInputElement).value;
                                        handleSave('RATE_LIMIT', val, 'number');
                                    }}
                                    disabled={isSaving}
                                    className="btn btn-primary whitespace-nowrap"
                                >
                                    {isSaving ? '저장 중...' : '적용'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* SMS Configuration */}
                    <div className="p-4 bg-muted/30 rounded-lg border border-border/50 space-y-6">
                        <h3 className="text-lg font-semibold border-b border-border pb-2">💬 SMS 문자 발송 설정</h3>

                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">SMS 서비스 제공업체</label>
                                <select
                                    className="w-full p-2 rounded-md border border-input bg-background"
                                    id="sms_provider_select"
                                    defaultValue={settings.find(s => s.key === 'SMS_PROVIDER')?.value || 'mock'}
                                    onChange={(e) => handleSave('SMS_PROVIDER', e.target.value, 'string')}
                                >
                                    <option value="mock">가상 발송 (Console Log)</option>
                                    <option value="aligo">Aligo (알리고)</option>
                                    <option value="coolsms">CoolSMS (쿨에스엠에스)</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">발신 번호 (Sender ID)</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        id="sms_sender_id_input"
                                        defaultValue={settings.find(s => s.key === 'SMS_SENDER_ID')?.value || ''}
                                        className="flex-1 p-2 rounded-md border border-input bg-background font-mono"
                                        placeholder="01012345678"
                                    />
                                    <button
                                        onClick={() => handleSave('SMS_SENDER_ID', (document.getElementById('sms_sender_id_input') as HTMLInputElement).value, 'string')}
                                        className="btn btn-secondary btn-sm"
                                    >적용</button>
                                </div>
                            </div>

                            <div className="md:col-span-2 space-y-2">
                                <label className="text-sm font-medium">API Key / 인증 정보</label>
                                <div className="flex gap-2">
                                    <input
                                        type="password"
                                        id="sms_api_key_input"
                                        defaultValue={settings.find(s => s.key === 'SMS_API_KEY')?.value || ''}
                                        className="flex-1 p-2 rounded-md border border-input bg-background font-mono"
                                        placeholder="API 키를 입력하세요"
                                    />
                                    <button
                                        onClick={() => handleSave('SMS_API_KEY', (document.getElementById('sms_api_key_input') as HTMLInputElement).value, 'string')}
                                        className="btn btn-secondary btn-sm"
                                    >적용</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="text-sm text-center text-muted-foreground pt-4 border-t border-border">
                        시스템 전체에 영향을 미치는 설정입니다. 주의하여 변경해 주세요.
                    </div>
                </div>
            </div>

            <div className="alert alert-info bg-indigo-500/10 border-indigo-500/20 text-indigo-700 p-4 rounded-lg text-sm mt-8">
                <div className="flex gap-3">
                    <span className="text-xl">💡</span>
                    <div className="space-y-1">
                        <p><b>성능 최적화 팁:</b> 1,000명 이상의 대규모 투표가 예정된 경우, <b>API 속도 제한</b>을 10,000 이상으로 상향하고 <b>메모리 사용율</b>을 모니터링하세요.</p>
                        <p className="text-xs opacity-70">* 물리적인 서버 사양(CPU/RAM) 변경은 Railway 대시보드에서 수행해야 하며, 이곳에서는 애플리케이션 레벨의 제한을 제어합니다.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
