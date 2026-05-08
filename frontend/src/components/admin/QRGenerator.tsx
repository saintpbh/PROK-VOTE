'use client';

import { useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Card from '../ui/Card';
import api from '@/lib/api';
import qrPDFGenerator from '@/lib/qr-pdf';
import toast from 'react-hot-toast';

interface QRGeneratorProps {
    sessionId: string;
    sessionName?: string;
}

export default function QRGenerator({ sessionId, sessionName }: QRGeneratorProps) {
    const [count, setCount] = useState<number>(20);
    const [loading, setLoading] = useState(false);
    const [generatedTokens, setGeneratedTokens] = useState<string[]>([]);
    const [preview, setPreview] = useState<string | null>(null);
    const [titleColor, setTitleColor] = useState<{ r: number; g: number; b: number; label: string; hex: string }>({
        r: 30, g: 30, b: 45, label: '기본(검정)', hex: '#1e1e2d'
    });

    const TITLE_COLORS = [
        { r: 30,  g: 30,  b: 45,  label: '기본',  hex: '#1e1e2d' },
        { r: 220, g: 38,  b: 38,  label: '빨강',  hex: '#dc2626' },
        { r: 234, g: 88,  b: 12,  label: '주황',  hex: '#ea580c' },
        { r: 202, g: 138, b: 4,   label: '노랑',  hex: '#ca8a04' },
        { r: 22,  g: 163, b: 74,  label: '초록',  hex: '#16a34a' },
        { r: 37,  g: 99,  b: 235, label: '파랑',  hex: '#2563eb' },
        { r: 30,  g: 58,  b: 138, label: '남색',  hex: '#1e3a8a' },
        { r: 147, g: 51,  b: 234, label: '보라',  hex: '#9333ea' },
    ];

    const handleGenerate = async () => {
        if (count < 1 || count > 500) {
            toast.error('QR 코드 개수는 1-500 사이여야 합니다');
            return;
        }

        setLoading(true);
        try {
            // Generate tokens via API
            const response = await api.generateTokens(sessionId, count);
            const tokens = response.tokens as string[];

            setGeneratedTokens(tokens);
            toast.success(`${tokens.length}개의 QR 코드가 생성되었습니다`);

            let baseUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
            
            // Override localhost with real IP for mobile scanning
            if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
                if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                    baseUrl = window.location.origin;
                } else {
                    try {
                        const sysStatus = await api.getSystemStatus();
                        if (sysStatus?.status?.localIp) {
                            const port = window.location.port ? `:${window.location.port}` : '';
                            baseUrl = `http://${sysStatus.status.localIp}${port}`;
                        }
                    } catch(e) {
                        console.error('Failed to get local IP', e);
                    }
                }
            }

            // Generate preview of first QR code
            const previewUrl = `${baseUrl}/vote/${tokens[0]}`;
            const previewDataUrl = await qrPDFGenerator.generateSingleQR(previewUrl);
            setPreview(previewDataUrl);

        } catch (error: any) {
            toast.error(error.message || 'QR 코드 생성에 실패했습니다');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPDF = async () => {
        if (generatedTokens.length === 0) {
            toast.error('먼저 QR 코드를 생성해주세요');
            return;
        }

        setLoading(true);
        try {
            let baseUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
            
            // Override localhost with real IP for mobile scanning
            if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
                if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                    baseUrl = window.location.origin;
                } else {
                    try {
                        const sysStatus = await api.getSystemStatus();
                        if (sysStatus?.status?.localIp) {
                            const port = window.location.port ? `:${window.location.port}` : '';
                            baseUrl = `http://${sysStatus.status.localIp}${port}`;
                        }
                    } catch(e) {
                        console.error('Failed to get local IP', e);
                    }
                }
            }
            
            await qrPDFGenerator.generatePDF(generatedTokens, baseUrl, sessionName, { r: titleColor.r, g: titleColor.g, b: titleColor.b });
            toast.success('PDF 다운로드가 시작되었습니다');
        } catch (error: any) {
            toast.error('PDF 생성에 실패했습니다');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card title="QR 코드 생성">
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                        type="number"
                        label="생성할 QR 코드 개수"
                        value={count}
                        onChange={(e) => setCount(parseInt(e.target.value) || 0)}
                        min={1}
                        max={500}
                        helperText="최대 500개까지 생성 가능합니다"
                    />

                    <div className="flex items-end">
                        <Button
                            onClick={handleGenerate}
                            loading={loading}
                            disabled={!sessionId}
                            fullWidth
                        >
                            QR 코드 생성
                        </Button>
                    </div>
                </div>

                {/* Title Bar Color Selector */}
                <div className="col-span-1 md:col-span-2">
                    <label className="block text-sm font-medium mb-2">타이틀바 색상</label>
                    <div className="flex flex-wrap gap-2">
                        {TITLE_COLORS.map((color) => (
                            <button
                                key={color.hex}
                                onClick={() => setTitleColor(color)}
                                className={`w-10 h-10 rounded-lg border-2 transition-all duration-150 hover:scale-110 ${
                                    titleColor.hex === color.hex
                                        ? 'border-white ring-2 ring-primary scale-110'
                                        : 'border-transparent opacity-70 hover:opacity-100'
                                }`}
                                style={{ backgroundColor: color.hex }}
                                title={color.label}
                            />
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">선택: {titleColor.label}</p>
                </div>

                {generatedTokens.length > 0 && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-success/10 rounded-lg border border-success/30">
                            <div>
                                <p className="font-semibold text-success">
                                    {generatedTokens.length}개의 QR 코드 생성 완료
                                </p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    A4 용지 {Math.ceil(generatedTokens.length / 12)}장에 출력됩니다 (3×4 배열)
                                </p>
                            </div>
                            <Button
                                onClick={handleDownloadPDF}
                                loading={loading}
                                variant="success"
                            >
                                PDF 다운로드
                            </Button>
                        </div>

                        {preview && (
                            <div className="p-4 bg-muted/30 rounded-lg">
                                <p className="text-sm font-medium mb-3">미리보기 (첫 번째 QR 코드)</p>
                                <div className="flex justify-center">
                                    <img
                                        src={preview}
                                        alt="QR Code Preview"
                                        className="w-48 h-48 border-2 border-border rounded-lg"
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground text-center mt-2">
                                    Token: {generatedTokens[0].substring(0, 16)}...
                                </p>
                            </div>
                        )}

                        <div className="text-xs text-muted-foreground space-y-1">
                            <p><strong>사용 방법:</strong></p>
                            <ol className="list-decimal list-inside space-y-0.5 ml-2">
                                <li>PDF를 다운로드하여 A4 용지에 인쇄하세요</li>
                                <li>점선을 따라 QR 코드를 잘라내세요</li>
                                <li>참가자들에게 배포하세요</li>
                                <li>참가자가 QR 코드를 스캔하면 투표 페이지로 이동합니다</li>
                            </ol>
                        </div>
                    </div>
                )}

                {!sessionId && (
                    <div className="text-center p-4 bg-danger/10 rounded-lg border border-danger/30">
                        <p className="text-danger">먼저 세션을 선택해주세요</p>
                    </div>
                )}
            </div>
        </Card>
    );
}
