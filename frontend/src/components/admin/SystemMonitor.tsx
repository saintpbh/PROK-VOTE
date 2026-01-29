'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';

export default function SystemMonitor() {
    const [status, setStatus] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const interval = setInterval(fetchStatus, 3000);
        fetchStatus();
        return () => clearInterval(interval);
    }, []);

    const fetchStatus = async () => {
        try {
            const res = await api.getSystemStatus();
            if (res.success) {
                setStatus(res.status);
            }
        } catch (error) {
            console.error('Failed to fetch system status:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading && !status) {
        return <div className="text-center py-12">시스템 모니터링 데이터 로딩 중...</div>;
    }

    if (!status) return null;

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatUptime = (seconds: number) => {
        const d = Math.floor(seconds / (3600 * 24));
        const h = Math.floor(seconds % (3600 * 24) / 3600);
        const m = Math.floor(seconds % 3600 / 60);
        const s = Math.floor(seconds % 60);
        return `${d}일 ${h}시간 ${m}분 ${s}초`;
    };

    const memoryUsage = status.memory.usagePercent;
    const memoryColor = memoryUsage > 85 ? 'bg-danger' : memoryUsage > 60 ? 'bg-secondary' : 'bg-success';

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Memory Card */}
                {/* Memory Card */}
                <div className="card p-4 space-y-3">
                    <div className="flex justify-between items-center text-sm font-medium">
                        <span>메모리 (앱 / 전체)</span>
                        <span className="text-muted-foreground">{status.processMemory ? formatBytes(status.processMemory.rss) : 'N/A'}</span>
                    </div>

                    {/* App Memory */}
                    <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>App (RSS)</span>
                            <span>{formatBytes(status.processMemory?.rss || 0)}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: '5%' }}></div>
                        </div>
                    </div>

                    {/* Host Memory */}
                    <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Host ({memoryUsage}%)</span>
                            <span>{formatBytes(status.memory.total)}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                            <div
                                className={`h-full ${memoryColor}`}
                                style={{ width: `${memoryUsage}%` }}
                            ></div>
                        </div>
                    </div>
                </div>

                {/* CPU Load Card */}
                <div className="card p-4 space-y-3">
                    <div className="flex justify-between items-center text-sm font-medium">
                        <span>시스템 부하 (Load Avg)</span>
                        <span className="text-muted-foreground">{status.cpus} Cores</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 bg-muted/30 rounded">
                            <div className="text-xs text-muted-foreground">1m</div>
                            <div className="text-sm font-mono">{status.loadAvg['1m'].toFixed(2)}</div>
                        </div>
                        <div className="p-2 bg-muted/30 rounded">
                            <div className="text-xs text-muted-foreground">5m</div>
                            <div className="text-sm font-mono">{status.loadAvg['5m'].toFixed(2)}</div>
                        </div>
                        <div className="p-2 bg-muted/30 rounded">
                            <div className="text-xs text-muted-foreground">15m</div>
                            <div className="text-sm font-mono">{status.loadAvg['15m'].toFixed(2)}</div>
                        </div>
                    </div>
                </div>

                {/* Server Info */}
                <div className="card p-4 flex flex-col justify-between">
                    <div className="text-sm font-medium mb-2">서버 정보</div>
                    <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">버전</span>
                            <span>{status.nodeVersion}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">OS</span>
                            <span>{status.platform} ({status.arch})</span>
                        </div>
                    </div>
                </div>

                {/* Uptime Card */}
                <div className="card p-4 flex flex-col justify-between">
                    <div className="text-sm font-medium mb-2">가동 시간 (Uptime)</div>
                    <div className="space-y-1">
                        <div className="text-xs flex justify-between">
                            <span className="text-muted-foreground">시스템</span>
                            <span>{formatUptime(status.uptime)}</span>
                        </div>
                        <div className="text-xs flex justify-between">
                            <span className="text-muted-foreground">프로세스</span>
                            <span>{formatUptime(status.processUptime)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Capacity Analysis / Alert */}
            <div className={`p-4 rounded-xl border flex gap-4 items-start ${memoryUsage > 80 ? 'bg-danger/10 border-danger/30' : 'bg-primary/5 border-primary/20'
                }`}>
                <div className="text-2xl pt-1">
                    {memoryUsage > 80 ? '⚠️' : '✅'}
                </div>
                <div>
                    <h4 className="font-bold mb-1">
                        {memoryUsage > 80 ? '리소스 부족 경고' : '현재 서버 상태 안정적'}
                    </h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        {memoryUsage > 90
                            ? '호스트 서버의 메모리 사용량이 매우 높습니다. Railway 공유 서버의 부하일 수 있으니, App Memory(RSS)가 안정적이라면 큰 문제는 없습니다.'
                            : '현재 앱의 메모리 사용량은 안정적입니다. 표시되는 전체 메모리는 공유 호스트 서버의 수치이므로 70% 이상이어도 정상입니다.'}
                    </p>
                </div>
            </div>
        </div>
    );
}
