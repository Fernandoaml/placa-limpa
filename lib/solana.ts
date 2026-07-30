// Camada de acesso à Solana devnet: Connection (web3.js) para leituras e Umi (Metaplex Core)
// para escrever. Sem programa custom — só clientes. Config vem de env NEXT_PUBLIC_*.

import { Connection } from '@solana/web3.js';
import type { Umi } from '@metaplex-foundation/umi';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplCore } from '@metaplex-foundation/mpl-core';
import {
  walletAdapterIdentity,
  type WalletAdapter,
} from '@metaplex-foundation/umi-signer-wallet-adapters';

/** RPC devnet do cliente (escrita/wallet). Fallback público quando a env não está setada. */
export const RPC_URL = process.env.NEXT_PUBLIC_RPC ?? 'https://api.devnet.solana.com';

/**
 * RPC de LEITURA no servidor (`getSignaturesForAddress` da timeline). O devnet público **não**
 * retorna o histórico de assinaturas — precisa de um RPC com índice (ex.: QuickNode). `SOLANA_RPC`
 * é **server-only** (sem prefixo `NEXT_PUBLIC_`), então a chave não vaza no bundle do cliente.
 * Fallback: o RPC do cliente.
 */
export const READ_RPC_URL = process.env.SOLANA_RPC ?? RPC_URL;

/** Endereço da collection Core onde os assets entram — opcional. */
export const COLLECTION: string | undefined = process.env.NEXT_PUBLIC_COLLECTION || undefined;

/** Liga os dados de demonstração (sem tocar a chain). */
export const MOCK = process.env.NEXT_PUBLIC_MOCK === '1';

/** Connection web3.js — usada para ler assinaturas/memos do asset (usa o RPC de leitura). */
export function getConnection(): Connection {
  return new Connection(READ_RPC_URL, 'confirmed');
}

/** Umi com mpl-core; se a carteira vier, assina como identidade (mint/append). */
export function getUmi(walletAdapter?: WalletAdapter): Umi {
  const umi = createUmi(RPC_URL).use(mplCore());
  if (walletAdapter) umi.use(walletAdapterIdentity(walletAdapter));
  return umi;
}
