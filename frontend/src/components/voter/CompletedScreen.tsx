'use client';

import Card from '../ui/Card';

export default function CompletedScreen() {
    return (
        <div className="w-full max-w-md">
            <Card>
                <div className="text-center space-y-6 py-8">
                    {/* Animated Checkmark */}
                    <div className="relative">
                        <div className="w-32 h-32 mx-auto mb-4 rounded-full bg-success/20 flex items-center justify-center animate-countup">
                            <div className="text-8xl text-success">✓</div>
                        </div>
                    </div>

                    <h1 className="text-3xl font-bold text-success">투표 완료!</h1>

                    <p className="text-lg text-muted-foreground">
                        투표가 성공적으로 제출되었습니다
                    </p>

                    <div className="p-6 bg-success/10 rounded-lg border border-success/30 space-y-2">
                        <p className="text-sm text-success font-semibold">
                            ✅ 투표가 정상적으로 기록되었습니다
                        </p>
                        <p className="text-xs text-muted-foreground">
                            결과 발표 시 화면에 자동으로 표시됩니다
                        </p>
                    </div>

                    <div className="text-sm text-muted-foreground space-y-2 pt-4">
                        <p>💡 <strong>다음 단계:</strong></p>
                        <ul className="text-left space-y-1 ml-6">
                            <li>• 화면을 닫지 마세요</li>
                            <li>• 결과 발표를 기다려주세요</li>
                            <li>• 다음 안건이 있으면 자동으로 전환됩니다</li>
                        </ul>
                    </div>

                    {/* Celebration particles animation (optional) */}
                    <div className="flex items-center justify-center gap-3 pt-6">
                        <span className="text-4xl animate-bounce" style={{ animationDelay: '0ms' }}>
                            🎉
                        </span>
                        <span className="text-4xl animate-bounce" style={{ animationDelay: '100ms' }}>
                            ✨
                        </span>
                        <span className="text-4xl animate-bounce" style={{ animationDelay: '200ms' }}>
                            🎊
                        </span>
                    </div>
                </div>
            </Card>
        </div>
    );
}
