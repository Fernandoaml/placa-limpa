'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'border border-transparent bg-[var(--sc-primary)] text-[var(--sc-primary-foreground)] hover:opacity-90',
  secondary:
    'border border-[var(--sc-border)] bg-[var(--sc-card)] text-[var(--sc-text)] hover:border-[var(--sc-primary)]',
  ghost:
    'border border-transparent bg-transparent text-[var(--sc-text)] hover:bg-[var(--sc-card)]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', className = '', ...props }, ref) => (
    <button
      ref={ref}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2',
        'text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sc-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--sc-bg)]',
        'disabled:pointer-events-none disabled:opacity-50',
        variantClasses[variant],
        className,
      ].join(' ')}
      {...props}
    />
  ),
);

Button.displayName = 'Button';
