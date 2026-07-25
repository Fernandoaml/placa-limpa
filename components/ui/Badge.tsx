import type { ReactNode } from 'react';

export type BadgeVariant = 'ok' | 'alerta' | 'neutro';

export interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  ok: 'bg-[var(--sc-ok)] text-[var(--sc-ok-foreground)]',
  alerta: 'bg-[var(--sc-alerta)] text-[var(--sc-alerta-foreground)]',
  neutro: 'bg-[var(--sc-neutro)] text-[var(--sc-neutro-foreground)]',
};

export function Badge({ variant = 'neutro', children, className = '' }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2.5 py-0.5',
        'text-xs font-semibold',
        variantClasses[variant],
        className,
      ].join(' ')}
    >
      {children}
    </span>
  );
}
