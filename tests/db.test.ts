import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Banco isolado em memória (libsql :memory:). Import dinâmico após setar a env.
let db: typeof import('@/lib/db');

beforeAll(async () => {
  process.env.PLACA_DB_PATH = ':memory:';
  delete process.env.TURSO_DATABASE_URL;
  db = await import('@/lib/db');
});

afterAll(async () => {
  await db.closeDb();
  delete process.env.PLACA_DB_PATH;
});

describe('emissores', () => {
  it('upsert insere/atualiza, get, list e seed (com e sem pubkey)', async () => {
    await db.upsertEmissor({ pubkey: 'PK1', cnpj: '1', nome: 'Oficina A', escopo: 'oficina' });
    expect((await db.getEmissor('PK1'))?.nome).toBe('Oficina A');
    await db.upsertEmissor({ pubkey: 'PK1', cnpj: '2', nome: 'Oficina A2', escopo: 'oficina' });
    expect((await db.getEmissor('PK1'))?.cnpj).toBe('2');
    expect(await db.getEmissor('NAO')).toBeNull();

    await db.resetSeedTables();
    await db.seedEmissores('MPK');
    expect(await db.listEmissores()).toHaveLength(4);
    expect((await db.getEmissor('MPK'))?.escopo).toBe('montadora');
    await db.resetSeedTables();
    await db.seedEmissores();
    expect(await db.getEmissor('MONTADORA_VW_PUBKEY')).not.toBeNull();
  });
});

describe('dados_sensiveis', () => {
  it('save (com shares), get, listDados e shred', async () => {
    await db.resetSeedTables();
    await db.saveDado({ hash: 'H1', asset: 'A1', ct: 'ct', iv: 'iv', shares: ['s1', 's2', 's3'] });
    expect((await db.getDado('H1'))?.shares).toEqual(['s1', 's2', 's3']);
    expect((await db.getDado('H1'))?.criado_em).toBeTypeOf('number');
    expect(await db.listDados()).toHaveLength(1);
    await db.saveDado({ hash: 'H1', asset: 'A2', ct: 'c2', iv: 'i2', shares: [] });
    expect((await db.getDado('H1'))?.asset).toBe('A2');
    expect((await db.getDado('H1'))?.shares).toEqual([]);
    expect(await db.getDado('NAO')).toBeNull();
    expect(await db.shredDado('H1')).toBe(true);
    expect(await db.getDado('H1')).toBeNull();
    expect(await db.shredDado('H1')).toBe(false);
  });
});

describe('veiculos', () => {
  it('save (com e sem nome), getAssetByCommit e list', async () => {
    await db.resetSeedTables();
    await db.saveVeiculo('VIN1', 'ASSET1', 'Gol íntegro');
    await db.saveVeiculo('VIN2', 'ASSET2');
    expect(await db.getAssetByCommit('VIN1')).toBe('ASSET1');
    expect(await db.getAssetByCommit('NAO')).toBeNull();
    expect(await db.listVeiculos()).toHaveLength(2);
    await db.saveVeiculo('VIN1', 'ASSET1B', 'Gol íntegro 2');
    expect(await db.getAssetByCommit('VIN1')).toBe('ASSET1B');
  });
});

describe('resetSeedTables', () => {
  it('limpa as três tabelas', async () => {
    await db.seedEmissores('X');
    await db.saveVeiculo('V', 'A', 'n');
    await db.saveDado({ hash: 'h', asset: 'a', ct: 'c', iv: 'i', shares: [] });
    await db.resetSeedTables();
    expect(await db.listEmissores()).toHaveLength(0);
    expect(await db.listVeiculos()).toHaveLength(0);
    expect(await db.getDado('h')).toBeNull();
  });
});

describe('resolução da URL (branches)', () => {
  it('arquivo local (file:) cria diretório e grava', async () => {
    vi.resetModules();
    const dir = mkdtempSync(join(tmpdir(), 'placa-file-'));
    process.env.PLACA_DB_PATH = join(dir, 'sub', 'x.db'); // dir inexistente → mkdirSync
    const fileDb = await import('@/lib/db');
    await fileDb.saveVeiculo('F', 'FA');
    expect(await fileDb.getAssetByCommit('F')).toBe('FA');
    await fileDb.closeDb();
    process.env.PLACA_DB_PATH = ':memory:';
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* lock residual do Windows */
    }
    vi.resetModules();
  });

  it('sem PLACA_DB_PATH resolve o caminho padrão (só carrega o módulo)', async () => {
    vi.resetModules();
    delete process.env.PLACA_DB_PATH;
    delete process.env.TURSO_DATABASE_URL;
    const mod = await import('@/lib/db'); // não conecta
    await mod.closeDb(); // _ready == null → cobre o ramo falso do closeDb
    process.env.PLACA_DB_PATH = ':memory:';
    vi.resetModules();
  });

  it('com TURSO_DATABASE_URL usa Turso (só carrega o módulo)', async () => {
    vi.resetModules();
    process.env.TURSO_DATABASE_URL = 'libsql://exemplo.turso.io';
    await import('@/lib/db'); // não conecta
    delete process.env.TURSO_DATABASE_URL;
    process.env.PLACA_DB_PATH = ':memory:';
    vi.resetModules();
  });
});

describe('migração da coluna shares', () => {
  it('adiciona shares num banco de schema antigo (sem a coluna)', async () => {
    vi.resetModules();
    const dir2 = mkdtempSync(join(tmpdir(), 'placa-old-'));
    const oldPath = join(dir2, 'old.db');
    const { createClient } = await import('@libsql/client');
    const raw = createClient({ url: `file:${oldPath}` });
    await raw.execute('CREATE TABLE dados_sensiveis (hash TEXT PRIMARY KEY, asset TEXT, ct TEXT, iv TEXT, criado_em INTEGER)');
    raw.close();
    process.env.PLACA_DB_PATH = oldPath;
    const migrated = await import('@/lib/db');
    await migrated.saveDado({ hash: 'M', asset: 'A', ct: 'c', iv: 'i', shares: ['x', 'y'] });
    expect((await migrated.getDado('M'))?.shares).toEqual(['x', 'y']);
    await migrated.closeDb();
    process.env.PLACA_DB_PATH = ':memory:';
    try {
      rmSync(dir2, { recursive: true, force: true });
    } catch {
      /* lock residual */
    }
    vi.resetModules();
  });
});
