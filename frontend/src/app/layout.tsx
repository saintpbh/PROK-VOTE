import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'PROK Vote - Real-Time Voting System',
    description: 'Enterprise-grade on-site electronic voting platform',
    manifest: '/manifest.json',
    themeColor: '#8B5CF6',
    viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ko">
            <body className={inter.className} suppressHydrationWarning>
                {children}
                <Toaster position="top-center" />
            </body>
        </html>
    );
}
