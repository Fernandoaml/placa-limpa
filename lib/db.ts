// Base off-chain — libsql (@libsql/client). Local: arquivo `file:` (data/placa-limpa.db).
// Produção (Vercel): Turso (libsql cloud) via TURSO_DATABASE_URL — escrita persiste no serverless.
// Guarda o que NÃO vai na chain: credencial do emissor, índice vinCommit→asset e o ciphertext
// (+ 5 shares Shamir) do dado sensível. Na chain só entra o hash.

import { createClient, type Client } from '@libsql/client';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

export interface Emissor {
  pubkey: string;
  cnpj: string;
  nome: string;
  escopo: string;
}

export interface DadoSensivel {
  hash: string;
  asset: string;
  ct: string;
  iv: string;
  /** 5 shares Shamir (hex) da chave AES — em produção ficariam com 5 custodiantes; aqui juntas p/ a demo do cofre. */
  shares: string[];
  criado_em: number;
}

export interface Veiculo {
  vin_commit: string;
  asset: string;
  nome: string;
  criado_em: number;
}

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const LOCAL_PATH = process.env.PLACA_DB_PATH ?? join(process.cwd(), 'data', 'placa-limpa.db');
const DB_URL = TURSO_URL ?? (LOCAL_PATH === ':memory:' ? ':memory:' : `file:${LOCAL_PATH}`);

let _ready: Promise<Client> | null = null;

function db(): Promise<Client> {
  if (_ready) return _ready;
  _ready = (async () => {
    if (!TURSO_URL && DB_URL.startsWith('file:')) mkdirSync(dirname(LOCAL_PATH), { recursive: true });
    const c = createClient({ url: DB_URL, authToken: process.env.TURSO_AUTH_TOKEN, intMode: 'number' });
    await c.executeMultiple(`
      CREATE TABLE IF NOT EXISTS emissores (
        pubkey TEXT PRIMARY KEY, cnpj TEXT NOT NULL, nome TEXT NOT NULL, escopo TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS dados_sensiveis (
        hash TEXT PRIMARY KEY, asset TEXT NOT NULL, ct TEXT NOT NULL, iv TEXT NOT NULL,
        shares TEXT NOT NULL DEFAULT '[]', criado_em INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS veiculos (
        vin_commit TEXT PRIMARY KEY, asset TEXT NOT NULL, nome TEXT NOT NULL DEFAULT '', criado_em INTEGER NOT NULL
      );
    `);
    // migração: adiciona a coluna `shares` em bancos criados antes dela.
    try {
      await c.execute("ALTER TABLE dados_sensiveis ADD COLUMN shares TEXT NOT NULL DEFAULT '[]'");
    } catch {
      /* coluna já existe */
    }
    return c;
  })();
  return _ready;
}

/** Fecha a conexão (usado nos testes). */
export async function closeDb(): Promise<void> {
  if (_ready) {
    (await _ready).close();
    _ready = null;
  }
}

// ---- emissores -------------------------------------------------------------

export async function listEmissores(): Promise<Emissor[]> {
  const r = await (await db()).execute('SELECT pubkey, cnpj, nome, escopo FROM emissores ORDER BY nome');
  return r.rows as unknown as Emissor[];
}

export async function getEmissor(pubkey: string): Promise<Emissor | null> {
  const r = await (await db()).execute({ sql: 'SELECT pubkey, cnpj, nome, escopo FROM emissores WHERE pubkey = ?', args: [pubkey] });
  return (r.rows[0] as unknown as Emissor) ?? null;
}

export async function upsertEmissor(e: Emissor): Promise<void> {
  await (await db()).execute({
    sql: `INSERT INTO emissores (pubkey, cnpj, nome, escopo) VALUES (?, ?, ?, ?)
          ON CONFLICT(pubkey) DO UPDATE SET cnpj = excluded.cnpj, nome = excluded.nome, escopo = excluded.escopo`,
    args: [e.pubkey, e.cnpj, e.nome, e.escopo],
  });
}

// ---- dados sensíveis (ciphertext + shares off-chain) -----------------------

export async function saveDado(d: Omit<DadoSensivel, 'criado_em'>): Promise<void> {
  await (await db()).execute({
    sql: `INSERT INTO dados_sensiveis (hash, asset, ct, iv, shares, criado_em) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(hash) DO UPDATE SET asset = excluded.asset, ct = excluded.ct, iv = excluded.iv, shares = excluded.shares`,
    args: [d.hash, d.asset, d.ct, d.iv, JSON.stringify(d.shares), Date.now()],
  });
}

export async function getDado(hash: string): Promise<DadoSensivel | null> {
  const r = await (await db()).execute({ sql: 'SELECT hash, asset, ct, iv, shares, criado_em FROM dados_sensiveis WHERE hash = ?', args: [hash] });
  const row = r.rows[0] as unknown as (Omit<DadoSensivel, 'shares'> & { shares: string }) | undefined;
  if (!row) return null;
  return { ...row, shares: JSON.parse(row.shares) as string[] };
}

/** Lista os registros cifrados (sem o ciphertext), do mais novo p/ o mais antigo. */
export async function listDados(): Promise<{ hash: string; asset: string; criado_em: number }[]> {
  const r = await (await db()).execute('SELECT hash, asset, criado_em FROM dados_sensiveis ORDER BY criado_em DESC');
  return r.rows as unknown as { hash: string; asset: string; criado_em: number }[];
}

/** Crypto-shredding: apaga o ciphertext. Sobra o hash imutável na chain (LGPD art. 18). */
export async function shredDado(hash: string): Promise<boolean> {
  const r = await (await db()).execute({ sql: 'DELETE FROM dados_sensiveis WHERE hash = ?', args: [hash] });
  return r.rowsAffected > 0;
}

// ---- veículos (índice off-chain vinCommit → asset) -------------------------

export async function saveVeiculo(vinCommit: string, asset: string, nome = ''): Promise<void> {
  await (await db()).execute({
    sql: `INSERT INTO veiculos (vin_commit, asset, nome, criado_em) VALUES (?, ?, ?, ?)
          ON CONFLICT(vin_commit) DO UPDATE SET asset = excluded.asset, nome = excluded.nome`,
    args: [vinCommit, asset, nome, Date.now()],
  });
}

export async function getAssetByCommit(vinCommit: string): Promise<string | null> {
  const r = await (await db()).execute({ sql: 'SELECT asset FROM veiculos WHERE vin_commit = ?', args: [vinCommit] });
  return (r.rows[0]?.asset as string | undefined) ?? null;
}

export async function listVeiculos(): Promise<Veiculo[]> {
  const r = await (await db()).execute('SELECT vin_commit, asset, nome, criado_em FROM veiculos ORDER BY criado_em DESC');
  return r.rows as unknown as Veiculo[];
}

// ---- seed / reset ----------------------------------------------------------

/** Limpa as tabelas semeadas (uso do seed-db) — idempotente. */
export async function resetSeedTables(): Promise<void> {
  await (await db()).executeMultiple('DELETE FROM dados_sensiveis; DELETE FROM veiculos; DELETE FROM emissores;');
}

/** Emissores credenciados padrão (semeados uma vez). Idempotente. */
export async function seedEmissores(seedSignerPubkey?: string): Promise<void> {
  const base: Emissor[] = [
    { pubkey: seedSignerPubkey ?? 'MONTADORA_VW_PUBKEY', cnpj: '59.104.422/0001-50', nome: 'Montadora VW', escopo: 'montadora' },
    { pubkey: 'OficinaCentraL1111111111111111111111111111', cnpj: '12.345.678/0001-90', nome: 'Oficina Central', escopo: 'oficina' },
    { pubkey: 'VistoriaRapidA22222222222222222222222222222', cnpj: '98.765.432/0001-10', nome: 'Vistoria Rápida', escopo: 'vistoriador' },
    { pubkey: 'SeguradoraX333333333333333333333333333333333', cnpj: '11.222.333/0001-44', nome: 'Seguradora X', escopo: 'seguradora' },
  ];
  for (const e of base) await upsertEmissor(e);
}
