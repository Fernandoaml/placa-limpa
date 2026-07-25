// Operações do veículo contra Metaplex Core + SPL Memo — sem programa custom.
//  mint:        cria o asset Core com o plugin Attributes (vin_commit, km_atual, n_eventos).
//  appendEvent: UMA tx = memo (payload do evento) + update dos atributos do asset.
//  listEvents / getVehicle: leitura on-chain (ou mock em dev).

import { PublicKey } from '@solana/web3.js';
import type { Umi } from '@metaplex-foundation/umi';
import { publicKey, generateSigner } from '@metaplex-foundation/umi';
import { base58 } from '@metaplex-foundation/umi/serializers';
import {
  create,
  updatePlugin,
  fetchAsset,
  fetchCollection,
  type Attribute,
} from '@metaplex-foundation/mpl-core';
import { getConnection, getUmi, COLLECTION, MOCK } from './solana';
import { getMockVehicle } from './mock';
import type { MemoPayload, Vehicle, VehicleEvent, Kind } from './types';

// Program ID do SPL Memo (v2). O memo não exige contas — só os bytes do texto.
const MEMO_PROGRAM = publicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

const attr = (attrs: Attribute[], key: string): string | undefined =>
  attrs.find((a) => a.key === key)?.value;

/**
 * `fetchAsset` com retry — cobre o lag de propagação do RPC logo após mint/update
 * (o `sendAndConfirm` volta em 'confirmed', mas o read pode não enxergar a conta ainda).
 */
async function fetchAssetWithRetry(
  umi: Umi,
  pk: ReturnType<typeof publicKey>,
  attempts = 20,
  delayMs = 1500,
): Promise<Awaited<ReturnType<typeof fetchAsset>>> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetchAsset(umi, pk);
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

// ---- escrita ---------------------------------------------------------------

/** Cria o asset Core do veículo com os atributos iniciais (n_eventos = 1 = o mint). */
export async function mintVehicle(
  umi: Umi,
  args: { vinCommit: string; km: number; name?: string },
): Promise<{ asset: string; sig: string }> {
  const asset = generateSigner(umi);
  const attributeList: Attribute[] = [
    { key: 'vin_commit', value: args.vinCommit },
    { key: 'km_atual', value: String(args.km) },
    { key: 'n_eventos', value: '1' },
  ];

  const { signature } = await create(umi, {
    asset,
    name: args.name ?? 'Placa Limpa',
    uri: '',
    collection: COLLECTION ? await fetchCollection(umi, COLLECTION) : undefined,
    plugins: [{ type: 'Attributes', attributeList }],
  }).sendAndConfirm(umi);

  return { asset: asset.publicKey, sig: base58.deserialize(signature)[0] };
}

/**
 * Anexa um evento em UMA transação: grava o memo (JSON compacto {v,kind,km,hash}) e
 * atualiza os atributos do asset (km_atual := ev.km, n_eventos += 1). O memo cai na mesma
 * tx que toca o asset, então `getSignaturesForAddress(asset)` o encontra depois.
 */
export async function appendEvent(
  umi: Umi,
  asset: string,
  ev: MemoPayload & { scope?: string; emissor?: string },
): Promise<{ sig: string }> {
  const assetPk = publicKey(asset);
  const current = await fetchAssetWithRetry(umi, assetPk);
  const attrs = current.attributes?.attributeList ?? [];

  const prevN = Number(attr(attrs, 'n_eventos') ?? '0');
  const attributeList: Attribute[] = [
    { key: 'vin_commit', value: attr(attrs, 'vin_commit') ?? '' },
    { key: 'km_atual', value: String(ev.km) },
    { key: 'n_eventos', value: String(prevN + 1) },
  ];

  // Só na chain vai o payload compacto; nada sensível (o hash já foi calculado fora).
  const memo = JSON.stringify({ v: ev.v, kind: ev.kind, km: ev.km, hash: ev.hash });

  // Asset em collection precisa passar a collection como conta no update.
  const collection =
    current.updateAuthority.type === 'Collection' ? current.updateAuthority.address : undefined;

  const { signature } = await updatePlugin(umi, {
    asset: assetPk,
    collection,
    plugin: { type: 'Attributes', attributeList },
  })
    .add({
      instruction: { programId: MEMO_PROGRAM, keys: [], data: new TextEncoder().encode(memo) },
      signers: [],
      bytesCreatedOnChain: 0,
    })
    .sendAndConfirm(umi);

  return { sig: base58.deserialize(signature)[0] };
}

// ---- leitura ---------------------------------------------------------------

/** Extrai nosso JSON do memo mesmo quando vem prefixado (ex.: "[36] {json}"). */
function parseMemo(memo: string | null): MemoPayload | null {
  if (!memo) return null;
  const start = memo.indexOf('{');
  const end = memo.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const o = JSON.parse(memo.slice(start, end + 1)) as Record<string, unknown>;
    if (
      typeof o.v !== 'number' ||
      typeof o.kind !== 'string' ||
      typeof o.km !== 'number' ||
      typeof o.hash !== 'string'
    ) {
      return null;
    }
    return { v: o.v, kind: o.kind as Kind, km: o.km, hash: o.hash };
  } catch {
    return null;
  }
}

/** Eventos do asset, do memo de cada tx, em ordem cronológica (mais antigo primeiro). */
export async function listEvents(asset: string): Promise<VehicleEvent[]> {
  const sigs = await getConnection().getSignaturesForAddress(new PublicKey(asset), { limit: 1000 });

  const events: VehicleEvent[] = [];
  for (const s of sigs) {
    const payload = parseMemo(s.memo);
    if (!payload) continue; // ignora memos fora do nosso schema
    events.push({ ...payload, sig: s.signature, ts: s.blockTime ?? undefined });
  }

  // getSignaturesForAddress volta do mais novo p/ o mais antigo — invertemos por blockTime.
  events.sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));
  return events;
}

/**
 * Monta o veículo. Em dev (MOCK) devolve o mock. Senão trata o argumento como endereço
 * do asset: lê atributos via Core e cruza com os eventos on-chain. null se não achar.
 */
export async function getVehicle(commitOrAsset: string): Promise<Vehicle | null> {
  if (MOCK) return getMockVehicle(commitOrAsset);

  try {
    const asset = await fetchAssetWithRetry(getUmi(), publicKey(commitOrAsset), 3, 600);
    const attrs = asset.attributes?.attributeList ?? [];
    const events = await listEvents(commitOrAsset);
    const lastKm = events.length ? events[events.length - 1].km : 0;

    return {
      asset: commitOrAsset,
      vinCommit: attr(attrs, 'vin_commit') ?? '',
      kmAtual: Number(attr(attrs, 'km_atual') ?? lastKm),
      // conta pelos eventos reais lidos da chain — o atributo n_eventos pode ficar defasado (lag do RPC).
      nEventos: events.length,
      events,
    };
  } catch {
    return null; // asset inexistente ou RPC fora
  }
}
