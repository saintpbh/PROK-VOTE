export default function HomePage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20">
            <div className="card max-w-2xl w-full mx-4">
                <h1 className="text-5xl font-bold text-center mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                    PROK Vote
                </h1>
                <p className="text-xl text-muted-foreground text-center mb-8">
                    실시간 현장 제어형 전자투표 시스템
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <a
                        href="/admin"
                        className="btn btn-primary text-center py-8 flex flex-col items-center gap-2"
                    >
                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-lg font-semibold">관리자</span>
                    </a>

                    <a
                        href="/moderator"
                        className="btn btn-secondary text-center py-8 flex flex-col items-center gap-2"
                    >
                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <span className="text-lg font-semibold">진행자</span>
                    </a>

                    <a
                        href="/stadium"
                        className="btn btn-success text-center py-8 flex flex-col items-center gap-2"
                    >
                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span className="text-lg font-semibold">디스플레이</span>
                    </a>
                </div>

                <div className="mt-8 p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground text-center">
                        투표 참여는 QR 코드를 스캔하세요
                    </p>
                </div>
            </div>
        </div>
    );
}
