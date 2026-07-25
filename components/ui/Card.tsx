import Link from 'next/link';
import type { ReactNode } from 'react';

export interface CardProps {
  href?: string;
  className?: string;
  children: ReactNode;
}

export function Card({ href, className = '', children }: CardProps) {
  const base = [
    'block rounded-xl border border-[var(--sc-border)] bg-[var(--sc-card)]',
    'p-5 text-[var(--sc-text)]',
    className,
  ].join(' ');

  if (href) {
    return (
      <Link
        href={href}
        className={[
          base,
          'transition-colors hover:border-[var(--sc-primary)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sc-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--sc-bg)]',
        ].join(' ')}
      >
        {children}
      </Link>
    );
  }

  return <div className={base}>{children}</div>;
}
