import { ButtonHTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost' | 'outline';
    size?: 'sm' | 'md' | 'lg' | 'xl';
    children: ReactNode;
    loading?: boolean;
    fullWidth?: boolean;
}

export default function Button({
    variant = 'primary',
    size = 'md',
    children,
    className,
    loading = false,
    fullWidth = false,
    disabled,
    ...props
}: ButtonProps) {
    const baseStyles = 'font-semibold rounded-lg transition-all duration-150 inline-flex items-center justify-center gap-2';

    const variants = {
        primary: 'bg-primary text-white hover:bg-primary/90 active:scale-95',
        secondary: 'bg-secondary text-white hover:bg-secondary/90 active:scale-95',
        success: 'bg-success text-white hover:bg-success/90 active:scale-95',
        danger: 'bg-danger text-white hover:bg-danger/90 active:scale-95',
        ghost: 'bg-transparent text-foreground hover:bg-muted/50 active:scale-95',
        outline: 'bg-transparent border border-border text-foreground hover:bg-muted/30 active:scale-95',
    };

    const sizes = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-6 py-3 text-base',
        lg: 'px-8 py-4 text-lg',
        xl: 'px-12 py-6 text-xl',
    };

    return (
        <button
            className={clsx(
                baseStyles,
                variants[variant],
                sizes[size],
                fullWidth && 'w-full',
                (disabled || loading) && 'opacity-50 cursor-not-allowed hover:scale-100',
                className
            )}
            disabled={disabled || loading}
            {...props}
        >
            {loading && (
                <svg
                    className="animate-spin h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                >
                    <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                    />
                    <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                </svg>
            )}
            {children}
        </button>
    );
}
