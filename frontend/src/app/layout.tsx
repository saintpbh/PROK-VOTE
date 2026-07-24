import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import ServiceWorkerCleaner from '@/components/ServiceWorkerCleaner';

const inter = Inter({
    subsets: ['latin'],
    display: 'swap',
});

export const metadata: Metadata = {
    title: 'PROK Vote - Real-Time Voting System',
    description: 'Enterprise-grade on-site electronic voting platform',
    icons: {
        icon: '/favicon.ico',
        apple: '/icon-192.png',
    },
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    themeColor: '#1E3A8A',
    interactiveWidget: 'resizes-content',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ko">
            <body className={inter.className} suppressHydrationWarning>
                <ServiceWorkerCleaner />
                {children}
                <Toaster position="top-center" />
            </body>
        </html>
    );
}
