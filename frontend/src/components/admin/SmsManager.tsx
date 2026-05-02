'use client';

import { useState } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import toast from 'react-hot-toast';
import api from '@/lib/api';

interface SmsManagerProps {
    sessionId: string;
    onUpdate?: () => void;
}

export default function SmsManager({ sessionId, onUpdate }: SmsManagerProps) {
    const [importText, setImportText] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [stats, setStats] = useState<{ imported?: number; failed?: number; sent?: number } | null>(null);

    const handleImport = async () => {
        if (!importText.trim()) {
            toast.error('내용을 입력해주세요');
            return;
        }

        setIsImporting(true);
        setStats(null);

        try {
            // Split by line and then by comma or tab or space
            const lines = importText.split('\n').filter(line => line.trim());
            const voters = lines.map(line => {
                // Try to find separators: tab, comma, or space (if it's a clear part)
                let parts: string[] = [];
                if (line.includes('\t')) {
                    parts = line.split('\t');
                } else if (line.includes(',')) {
                    parts = line.split(',');
                } else {
                    // Fallback to space, but only split once to keep name/phone separate
                    // assuming most names don't have spaces or if they do, the last part is the phone
                    const match = line.trim().match(/^(.+)\s+([\d+-\s]{9,})$/);
                    if (match) {
                        parts = [match[1], match[2]];
                    } else {
                        parts = line.split(/\s+/);
                    }
                }

                const name = parts[0]?.trim() || '';
                // Normalize phone number: remove all non-digits except +
                const phoneNumber = (parts[1] || '').replace(/[^\d+]/g, '');

                return { name, phoneNumber };
            }).filter(v => v.name && v.phoneNumber.length >= 9);

            if (voters.length === 0) {
                toast.error('올바른 형식이 아닙니다 (이름, 전화번호)');
                setIsImporting(false);
                return;
            }

            const res = await api.importVoters(sessionId, voters);
            setStats({ imported: res.imported, failed: res.failed });
            toast.success(`${res.imported}명의 명단을 가져왔습니다`);
            setImportText('');
            if (onUpdate) onUpdate();
        } catch (error: any) {
            toast.error(error.message || '가져오기에 실패했습니다');
        } finally {
            setIsImporting(false);
        }
    };

    const handleSendSms = async () => {
        if (!confirm('아직 문자를 받지 않은 모든 참여자에게 투표 전용 링크를 발송하시겠습니까?')) {
            return;
        }

        setIsSending(true);
        try {
            const res = await api.sendSmsLinks(sessionId);
            setStats(prev => ({ ...prev, sent: res.sent }));
            toast.success(`${res.sent}건의 문자를 발송했습니다`);
            if (onUpdate) onUpdate();
        } catch (error: any) {
            toast.error(error.message || '발송에 실패했습니다');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Card className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <span></span> 문자 투표 관리
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        참여자 명단을 등록하고 고유 투표 링크를 문자로 발송합니다.
                    </p>
                </div>
            </div>

            <div className="space-y-4">
                <div className="bg-muted/30 p-4 rounded-lg border border-border">
                    <label className="text-sm font-semibold mb-2 block">참여자 명단 입력 (이름, 전화번호)</label>
                    <textarea
                        className="w-full h-40 bg-background border border-input rounded-md p-3 text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                        placeholder="홍길동, 01012345678&#10;이순신, 01098765432"
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                    />
                    <div className="mt-3 flex gap-2">
                        <Button
                            onClick={handleImport}
                            loading={isImporting}
                            disabled={!importText.trim()}
                            variant="secondary"
                            size="sm"
                        >
                            명단 등록하기
                        </Button>
                        <p className="text-xs text-muted-foreground flex items-center">
                            * 이름과 전화번호를 컴마(,) 또는 탭으로 구분하여 입력하세요.
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <div>
                        <h4 className="font-semibold text-primary">투표 링크 일괄 발송</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                            등록된 명단 중 아직 문자를 받지 않은 분들에게 발송합니다.
                        </p>
                    </div>
                    <Button
                        onClick={handleSendSms}
                        loading={isSending}
                        variant="primary"
                    >
                        문자 발송 시작
                    </Button>
                </div>

                {stats && (
                    <div className="grid grid-cols-3 gap-4 text-center mt-4">
                        <div className="p-3 bg-muted rounded-lg border border-border">
                            <div className="text-xs text-muted-foreground">가져옴</div>
                            <div className="text-lg font-bold">{stats.imported || 0}</div>
                        </div>
                        <div className="p-3 bg-muted rounded-lg border border-border">
                            <div className="text-xs text-muted-foreground">실패</div>
                            <div className="text-lg font-bold text-destructive">{stats.failed || 0}</div>
                        </div>
                        <div className="p-3 bg-muted rounded-lg border border-border">
                            <div className="text-xs text-muted-foreground">문자 발송</div>
                            <div className="text-lg font-bold text-primary">{stats.sent || 0}</div>
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
}
