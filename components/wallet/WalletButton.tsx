'use client';

import dynamic from 'next/dynamic';

// Dynamically imported with ssr:false to avoid hydration mismatches:
// the wallet-adapter UI reads browser-only wallet state on mount.
export const WalletButton = dynamic(
  () =>
    import('@solana/wallet-adapter-react-ui').then((m) => m.WalletMultiButton),
  { ssr: false },
);
