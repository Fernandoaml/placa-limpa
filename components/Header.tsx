'use client';

// Header global — navegação (marca → home) + conexão de carteira, em todas as telas.

import Link from 'next/link';
import { WalletButton } from './wallet/WalletButton';

export function Header() {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-[var(--sc-border)] bg-[var(--sc-bg)] px-6 py-3">
      <Link
        href="/"
        className="flex items-center gap-2 text-sm font-semibold text-[var(--sc-text)] transition-opacity hover:opacity-80"
      >
        <span aria-hidden>🚗</span>
        <span>Placa Limpa</span>
      </Link>
      <WalletButton />
    </header>
  );
}
