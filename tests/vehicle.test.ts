import { describe, it, expect, vi, afterEach } from 'vitest';

// Mocks das libs de chain — testamos a LÓGICA (parse de memo, retry, montagem de atributos,
// integridade), não as chamadas cruas ao Metaplex Core/umi/web3 (casca de I/O).

interface Sig {
  memo: string | null;
  signature: string;
  blockTime: number | null;
}

async function loadVehicle(opts: {
  COLLECTION?: string;
  MOCK?: boolean;
  sigs?: Sig[];
  fetchAsset?: (...a: unknown[]) => unknown;
} = {}) {
  vi.resetModules();
  vi.doMock('@solana/web3.js', () => ({
    PublicKey: class {
      constructor(public v: string) {}
      toString() {
        return this.v;
      }
    },
  }));
  vi.doMock('@/lib/solana', () => ({
    COLLECTION: opts.COLLECTION,
    MOCK: opts.MOCK ?? false,
    getConnection: () => ({ getSignaturesForAddress: async () => opts.sigs ?? [] }),
    getUmi: () => ({}),
  }));
  vi.doMock('@/lib/mock', () => ({
    getMockVehicle: (c?: string) =>
      c === 'nao' ? null : { asset: 'MOCKASSET', vinCommit: 'v', kmAtual: 0, nEventos: 0, events: [] },
  }));
  vi.doMock('@metaplex-foundation/umi', () => ({
    publicKey: (x: string) => x,
    generateSigner: () => ({ publicKey: 'NEWASSET' }),
  }));
  vi.doMock('@metaplex-foundation/umi/serializers', () => ({
    base58: { deserialize: () => ['SIG'] },
  }));
  vi.doMock('@metaplex-foundation/mpl-core', () => ({
    create: () => ({ sendAndConfirm: async () => ({ signature: new Uint8Array([1]) }) }),
    updatePlugin: () => ({
      add: () => ({ sendAndConfirm: async () => ({ signature: new Uint8Array([1]) }) }),
    }),
    fetchAsset:
      opts.fetchAsset ??
      (async () => ({
        attributes: {
          attributeList: [
            { key: 'vin_commit', value: 'vc' },
            { key: 'km_atual', value: '80000' },
            { key: 'n_eventos', value: '4' },
          ],
        },
        updateAuthority: { type: 'Address' },
      })),
    fetchCollection: async () => ({ collection: true }),
  }));
  return import('@/lib/vehicle');
}

afterEach(() => {
  vi.resetModules();
});

const ASSET = 'GEEb1wEHnxoNhJrbDSKVyejPJCNXQBP59yLHgYVGBmZn';

describe('listEvents (parse de memo)', () => {
  it('extrai só memos válidos, aceita prefixo "[N] {json}" e ordena por blockTime', async () => {
    const sigs: Sig[] = [
      { memo: JSON.stringify({ v: 1, kind: 'revisao', km: 15000, hash: 'h1' }), signature: 's1', blockTime: 100 },
      { memo: `[36] ${JSON.stringify({ v: 1, kind: 'vistoria', km: 38000, hash: 'h2' })}`, signature: 's2', blockTime: 200 },
      { memo: 'nao é json', signature: 's3', blockTime: 300 },
      { memo: JSON.stringify({ v: 1, kind: 'x', km: 'nan', hash: 'h' }), signature: 's4', blockTime: 50 },
      { memo: null, signature: 's5', blockTime: null },
      { memo: '{quebrado}', signature: 's6', blockTime: 500 }, // tem chaves mas JSON inválido → catch
      { memo: JSON.stringify({ v: 1, kind: 'revisao', km: 99000, hash: 'h9' }), signature: 's7', blockTime: null }, // válido, sem blockTime
      { memo: JSON.stringify({ v: 1, kind: 'revisao', km: 98000, hash: 'h8' }), signature: 's8', blockTime: null }, // idem (2º sem ts)
    ];
    const v = await loadVehicle({ sigs });
    const events = await v.listEvents(ASSET);
    // os sem blockTime (ts indefinido) ordenam como 0, antes dos datados (sort estável)
    expect(events.map((e) => e.km)).toEqual([99000, 98000, 15000, 38000]);
  });
});

describe('mintVehicle', () => {
  it('sem collection retorna asset gerado e sig', async () => {
    const v = await loadVehicle({});
    expect(await v.mintVehicle({} as never, { vinCommit: 'vc', km: 0 })).toEqual({ asset: 'NEWASSET', sig: 'SIG' });
  });

  it('com collection usa fetchCollection (e nome default)', async () => {
    const v = await loadVehicle({ COLLECTION: 'COLL' });
    expect((await v.mintVehicle({} as never, { vinCommit: 'vc', km: 0, name: 'Gol' })).asset).toBe('NEWASSET');
  });
});

describe('appendEvent', () => {
  it('atualiza atributos + memo (asset sem collection)', async () => {
    const v = await loadVehicle({});
    const r = await v.appendEvent({} as never, ASSET, { v: 1, kind: 'revisao', km: 90000, hash: 'h' });
    expect(r.sig).toBe('SIG');
  });

  it('asset em collection passa a collection no update; atributos ausentes usam defaults', async () => {
    const v = await loadVehicle({
      fetchAsset: async () => ({ attributes: undefined, updateAuthority: { type: 'Collection', address: 'COLLADDR' } }),
    });
    expect((await v.appendEvent({} as never, ASSET, { v: 1, kind: 'revisao', km: 10, hash: 'h' })).sig).toBe('SIG');
  });
});

describe('getVehicle', () => {
  it('MOCK=true usa o mock; commit desconhecido = null', async () => {
    const v = await loadVehicle({ MOCK: true });
    expect((await v.getVehicle('qualquer'))?.asset).toBe('MOCKASSET');
    expect(await v.getVehicle('nao')).toBeNull();
  });

  it('MOCK=false lê atributos on-chain + eventos', async () => {
    const sigs: Sig[] = [
      { memo: JSON.stringify({ v: 1, kind: 'revisao', km: 15000, hash: 'h1' }), signature: 's1', blockTime: 100 },
    ];
    const v = await loadVehicle({ sigs });
    const veic = await v.getVehicle(ASSET);
    expect(veic).toMatchObject({ vinCommit: 'vc', kmAtual: 80000, nEventos: 1 });
  });

  it('atributos ausentes: vinCommit vazio e kmAtual cai pro último evento', async () => {
    const sigs: Sig[] = [
      { memo: JSON.stringify({ v: 1, kind: 'revisao', km: 15000, hash: 'h1' }), signature: 's1', blockTime: 100 },
    ];
    const v = await loadVehicle({
      sigs,
      fetchAsset: async () => ({ attributes: undefined, updateAuthority: { type: 'Address' } }),
    });
    const veic = await v.getVehicle(ASSET);
    expect(veic).toMatchObject({ vinCommit: '', kmAtual: 15000, nEventos: 1 });
  });

  it('asset inexistente (fetchAsset sempre falha) retorna null após o retry', async () => {
    const v = await loadVehicle({ fetchAsset: async () => { throw new Error('not found'); } });
    expect(await v.getVehicle(ASSET)).toBeNull();
  }, 10000);

  it('retry: fetchAsset falha 1x e sucede na 2ª', async () => {
    let calls = 0;
    const v = await loadVehicle({
      fetchAsset: async () => {
        calls++;
        if (calls === 1) throw new Error('lag');
        return {
          attributes: { attributeList: [{ key: 'vin_commit', value: 'vc' }, { key: 'km_atual', value: '5' }, { key: 'n_eventos', value: '1' }] },
          updateAuthority: { type: 'Address' },
        };
      },
    });
    const veic = await v.getVehicle(ASSET);
    expect(veic?.kmAtual).toBe(5);
  }, 10000);
});
