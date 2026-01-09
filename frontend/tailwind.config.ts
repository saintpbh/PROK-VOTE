import type { Config } from 'tailwindcss';

const config: Config = {
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                primary: 'rgb(var(--primary) / <alpha-value>)',
                secondary: 'rgb(var(--secondary) / <alpha-value>)',
                success: 'rgb(var(--success) / <alpha-value>)',
                danger: 'rgb(var(--danger) / <alpha-value>)',
                background: 'rgb(var(--background) / <alpha-value>)',
                foreground: 'rgb(var(--foreground) / <alpha-value>)',
                card: 'rgb(var(--card) / <alpha-value>)',
                'card-foreground': 'rgb(var(--card-foreground) / <alpha-value>)',
                muted: 'rgb(var(--muted) / <alpha-value>)',
                'muted-foreground': 'rgb(var(--muted-foreground) / <alpha-value>)',
                border: 'rgb(var(--border) / <alpha-value>)',
                accent: 'rgb(var(--accent) / <alpha-value>)',
                surface: 'rgb(var(--surface) / <alpha-value>)',
            },
            fontFamily: {
                sans: ['var(--font-inter)', 'Pretendard', 'sans-serif'],
            },
            animation: {
                'countup': 'countup 0.5s ease-out',
                'pulse-slow': 'pulse-slow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'slide-in-bottom': 'slide-in-bottom 0.3s ease-out',
            },
            keyframes: {
                countup: {
                    'from': { opacity: '0', transform: 'translateY(20px)' },
                    'to': { opacity: '1', transform: 'translateY(0)' },
                },
                'pulse-slow': {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.5' },
                },
                'slide-in-bottom': {
                    'from': { transform: 'translateY(100%)', opacity: '0' },
                    'to': { transform: 'translateY(0)', opacity: '1' },
                },
            },
        },
    },
    plugins: [],
};

export default config;
