import { describe, it, expect, vi } from 'vitest';

// Faz o banco lançar → exercita os blocos catch (500) das rotas.
vi.mock('@/lib/db', () => {
  const boom = () => {
    throw new Error('db fail');
  };
  return {
    getDado: () => null,
    saveDado: boom,
    shredDado: boom,
    listEmissores: () => [],
    upsertEmissor: boom,
    listVeiculos: () => [],
    getAssetByCommit: () => null,
    saveVeiculo: boom,
  };
});

const post = (body: unknown) =>
  new Request('http://t/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('rotas — erro do banco vira 500', () => {
  it('dados POST', async () => {
    const { POST } = await import('@/app/api/dados/route');
    expect((await POST(post({ hash: 'H', asset: 'A', ct: 'c', iv: 'i' }))).status).toBe(500);
  });

  it('dados DELETE', async () => {
    const { DELETE } = await import('@/app/api/dados/route');
    expect((await DELETE(new Request('http://t/?hash=H', { method: 'DELETE' }))).status).toBe(500);
  });

  it('emissores POST', async () => {
    const { POST } = await import('@/app/api/emissores/route');
    expect((await POST(post({ pubkey: 'P', cnpj: '1', nome: 'n', escopo: 'oficina' }))).status).toBe(500);
  });

  it('veiculos POST', async () => {
    const { POST } = await import('@/app/api/veiculos/route');
    expect((await POST(post({ vinCommit: 'V', asset: 'A' }))).status).toBe(500);
  });
});
