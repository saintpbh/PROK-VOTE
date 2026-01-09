'use client';

import { useSpring, animated } from 'react-spring';
import { useEffect, useState } from 'react';

interface CountUpDisplayProps {
    title: string;
    value: number;
    color: string;
    borderColor?: string;
    icon: string;
}

export default function CountUpDisplay({ title, value, color, borderColor, icon }: CountUpDisplayProps) {
    const [hasAnimated, setHasAnimated] = useState(false);

    const { number } = useSpring({
        from: { number: 0 },
        number: hasAnimated ? value : 0,
        config: { duration: 800, tension: 120, friction: 14 },
    });

    useEffect(() => {
        // Trigger animation on mount
        const timer = setTimeout(() => setHasAnimated(true), 100);
        return () => clearTimeout(timer);
    }, [value]);

    const getIcon = () => {
        switch (icon) {
            case 'check':
                return (
                    <svg className="w-16 h-16 text-white/90 drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                );
            case 'x':
                return (
                    <svg className="w-16 h-16 text-white/90 drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                );
            case 'minus':
                return (
                    <svg className="w-16 h-16 text-white/90 drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                    </svg>
                );
            default:
                return <span className="text-6xl">{icon}</span>;
        }
    };

    return (
        <div className={`relative flex flex-col items-center justify-center p-8 rounded-3xl bg-gradient-to-br ${color} border ${borderColor || 'border-white/10'} shadow-2xl backdrop-blur-sm overflow-hidden group`}>
            {/* Background Texture */}
            <div className="absolute inset-0 bg-white/5 skew-y-12 scale-150 translate-y-20 opacity-0 group-hover:opacity-20 transition-opacity duration-500" />

            <div className="mb-6 transform group-hover:scale-110 transition-transform duration-300">
                {getIcon()}
            </div>

            <animated.div className="text-8xl font-black mb-2 tabular-nums tracking-tight text-white drop-shadow-md">
                {number.to((n) => Math.floor(n))}
            </animated.div>

            <div className="text-2xl font-bold uppercase tracking-widest text-white/60">
                {title}
            </div>
        </div>
    );
}
