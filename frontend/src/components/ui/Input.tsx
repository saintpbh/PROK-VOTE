import { InputHTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helperText?: string;
    icon?: ReactNode;
    fullWidth?: boolean;
}

export default function Input({
    label,
    error,
    helperText,
    icon,
    fullWidth = true,
    className,
    ...props
}: InputProps) {
    return (
        <div className={clsx('flex flex-col gap-2', fullWidth && 'w-full')}>
            {label && (
                <label className="text-sm font-medium text-foreground">
                    {label}
                </label>
            )}

            <div className="relative">
                {icon && (
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {icon}
                    </div>
                )}

                <input
                    className={clsx(
                        'input',
                        icon && 'pl-12',
                        error && 'border-danger focus:ring-danger/50',
                        fullWidth && 'w-full',
                        className
                    )}
                    {...props}
                />
            </div>

            {error && (
                <p className="text-sm text-danger">{error}</p>
            )}

            {helperText && !error && (
                <p className="text-sm text-muted-foreground">{helperText}</p>
            )}
        </div>
    );
}
