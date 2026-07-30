import { describe, it, expect, vi, afterEach } from 'vitest';
import { PublicKey } from '@solana/web3.js';

afterEach(() => {
  vi.resetModules();
  delete process.env.NEXT_PUBLIC_RPC;
  delete process.env.NEXT_PUBLIC_COLLECTION;
  delete process.env.NEXT_PUBLIC_MOCK;
  delete process.env.SOLANA_RPC;
});

describe('solana — env padrão (fallbacks)', () => {
  it('getConnection aponta pra devnet e getUmi retorna cliente', async () => {
    const s = await import('@/lib/solana');
    expect(s.getConnection().rpcEndpoint).toContain('devnet');
    expect(s.getUmi().identity).toBeDefined();
    expect(s.COLLECTION).toBeUndefined();
    expect(s.MOCK).toBe(false);
    expect(s.RPC_URL).toContain('devnet');
  });

  it('getUmi(adapter) aplica a identidade da carteira', async () => {
    const s = await import('@/lib/solana');
    const adapter = {
      publicKey: new PublicKey('11111111111111111111111111111111'),
      signMessage: async () => new Uint8Array(),
      signTransaction: async (t: unknown) => t,
      signAllTransactions: async (t: unknown) => t,
    };
    const umi = s.getUmi(adapter as never);
    expect(umi.identity.publicKey.toString()).toBe('11111111111111111111111111111111');
  });
});

describe('solana — env custom', () => {
  it('lê RPC, COLLECTION e MOCK das variáveis', async () => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_RPC = 'https://my-rpc.example/';
    process.env.NEXT_PUBLIC_COLLECTION = 'COLLxxx';
    process.env.NEXT_PUBLIC_MOCK = '1';
    const s = await import('@/lib/solana');
    expect(s.RPC_URL).toBe('https://my-rpc.example/');
    expect(s.COLLECTION).toBe('COLLxxx');
    expect(s.MOCK).toBe(true);
  });

  it('SOLANA_RPC (server-only) tem prioridade na leitura', async () => {
    vi.resetModules();
    process.env.SOLANA_RPC = 'https://read-rpc.example/';
    const s = await import('@/lib/solana');
    expect(s.READ_RPC_URL).toBe('https://read-rpc.example/');
    expect(s.getConnection().rpcEndpoint).toContain('read-rpc.example');
  });
});
