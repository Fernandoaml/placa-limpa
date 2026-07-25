import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sha256Hex } from '@/lib/crypto';

let commit: typeof import('@/app/api/commit/route');
let dados: typeof import('@/app/api/dados/route');
let emissores: typeof import('@/app/api/emissores/route');
let veiculos: typeof import('@/app/api/veiculos/route');
let dbmod: typeof import('@/lib/db');
let dir: string;

const post = (body: unknown) =>
  new Request('http://t/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
const req = (qs = '', method = 'GET') => new Request(`http://t/${qs}`, { method });

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'placa-api-'));
  process.env.PLACA_DB_PATH = join(dir, 'api.db');
  process.env.VIN_PEPPER = 'pepper-teste';
  delete process.env.VERCEL;
  dbmod = await import('@/lib/db');
  commit = await import('@/app/api/commit/route');
  dados = await import('@/app/api/dados/route');
  emissores = await import('@/app/api/emissores/route');
  veiculos = await import('@/app/api/veiculos/route');
});

afterAll(async () => {
  await dbmod.closeDb();
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* lock residual do Windows */
  }
  delete process.env.PLACA_DB_PATH;
  delete process.env.VIN_PEPPER;
});

describe('/api/commit', () => {
  it('gera o commit = sha256(chassi + pepper)', async () => {
    const r = await commit.POST(post({ chassi: '9BWZZZ377VT004251' }));
    expect(r.status).toBe(200);
    const { commit: c } = (await r.json()) as { commit: string };
    expect(c).toBe(await sha256Hex('9BWZZZ377VT004251' + 'pepper-teste'));
  });

  it('rejeita chassi ausente/vazio com 400', async () => {
    expect((await commit.POST(post({}))).status).toBe(400);
    expect((await commit.POST(post({ chassi: '   ' }))).status).toBe(400);
  });

  it('body inválido cai no catch (500)', async () => {
    const bad = new Request('http://t/', { method: 'POST', body: '{invalido' });
    expect((await commit.POST(bad)).status).toBe(500);
  });

  it('sem VIN_PEPPER usa string vazia', async () => {
    delete process.env.VIN_PEPPER;
    const r = await commit.POST(post({ chassi: 'X' }));
    expect(((await r.json()) as { commit: string }).commit).toBe(await sha256Hex('X'));
    process.env.VIN_PEPPER = 'pepper-teste';
  });
});

describe('/api/emissores', () => {
  it('GET lista, POST cadastra, POST inválido = 400', async () => {
    expect((await emissores.POST(post({ pubkey: 'PK', cnpj: '1' }))).status).toBe(400);
    const ok = await emissores.POST(post({ pubkey: 'PK', cnpj: '1', nome: 'Oficina', escopo: 'oficina' }));
    expect(ok.status).toBe(200);
    const list = (await (await emissores.GET()).json()) as { emissores: unknown[] };
    expect(list.emissores.length).toBeGreaterThan(0);
  });
});

describe('/api/dados', () => {
  it('POST guarda, GET recupera por hash, DELETE faz shred', async () => {
    expect((await dados.POST(post({ hash: 'H' }))).status).toBe(400);
    expect((await dados.POST(post({ hash: 'H', asset: 'A', ct: 'c', iv: 'i' }))).status).toBe(200);

    expect((await dados.GET(req())).status).toBe(200); // sem hash: lista
    const found = await dados.GET(req('?hash=H'));
    expect(found.status).toBe(200);
    expect((await dados.GET(req('?hash=NAO'))).status).toBe(404);

    expect((await dados.DELETE(req('', 'DELETE'))).status).toBe(400); // sem hash
    const shr = await dados.DELETE(req('?hash=H', 'DELETE'));
    expect(((await shr.json()) as { shredded: boolean }).shredded).toBe(true);
    // soft delete: o registro permanece (auditoria), agora marcado como destruído
    const depois = await dados.GET(req('?hash=H'));
    expect(depois.status).toBe(200);
    expect(((await depois.json()) as { shredded_em: number }).shredded_em).toBeTypeOf('number');
  });
});

describe('/api/veiculos', () => {
  it('POST registra, GET lista e resolve por commit', async () => {
    expect((await veiculos.POST(post({ vinCommit: 'V' }))).status).toBe(400);
    expect((await veiculos.POST(post({ vinCommit: 'V', asset: 'ASSET', nome: 'Gol' }))).status).toBe(200);

    const list = (await (await veiculos.GET(req())).json()) as { veiculos: unknown[] };
    expect(list.veiculos.length).toBeGreaterThan(0);

    const byCommit = await veiculos.GET(req('?commit=V'));
    expect(((await byCommit.json()) as { asset: string }).asset).toBe('ASSET');
    expect((await veiculos.GET(req('?commit=NAO'))).status).toBe(404);
  });
});
