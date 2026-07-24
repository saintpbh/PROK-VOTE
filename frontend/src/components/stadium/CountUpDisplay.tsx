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
        config: { duration: 350, tension: 180, friction: 12 },
    });

    useEffect(() => {
        const timer = setTimeout(() => setHasAnimated(true), 100);
        return () => clearTimeout(timer);
    }, [value]);

    const getIcon = () => {
        switch (icon) {
            case 'check':
                return (
                    <svg className="w-14 h-14 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                );
            case 'x':
                return (
                    <svg className="w-14 h-14 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                );
            case 'minus':
                return (
                    <svg className="w-14 h-14 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M20 12H4" />
                    </svg>
                );
            default:
                return <span className="text-5xl">{icon}</span>;
        }
    };

    return (
        <div className={`relative flex flex-col items-center justify-center p-10 rounded-3xl bg-gradient-to-br ${color} border ${borderColor || 'border-white/10'} shadow-2xl overflow-hidden min-w-[220px]`}>
            <div className="mb-4">
                {getIcon()}
            </div>

            <animated.div className="text-9xl font-black mb-3 tabular-nums tracking-tight text-white drop-shadow-md leading-none">
                {number.to((n) => Math.floor(n))}
            </animated.div>

            <div className="text-2xl font-bold tracking-widest text-white/50">
                {title}
            </div>
        </div>
    );
}
