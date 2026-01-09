import { ReactNode } from 'react';
import { clsx } from 'clsx';

interface CardProps {
    children: ReactNode;
    className?: string;
    title?: string;
    titleClassName?: string;
    footer?: ReactNode;
    hoverable?: boolean;
    onClick?: () => void;
}

export default function Card({
    children,
    className,
    title,
    titleClassName,
    footer,
    hoverable = false,
    onClick,
}: CardProps) {
    return (
        <div
            className={clsx(
                'card',
                hoverable && 'hover:shadow-2xl hover:scale-[1.02] cursor-pointer transition-all',
                onClick && 'cursor-pointer',
                className
            )}
            onClick={onClick}
        >
            {title && (
                <h3 className={clsx("text-xl font-bold mb-4", titleClassName)}>{title}</h3>
            )}

            <div className="flex-1">{children}</div>

            {footer && (
                <div className="mt-6 pt-4 border-t border-border">
                    {footer}
                </div>
            )}
        </div>
    );
}
