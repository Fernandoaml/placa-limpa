// scripts/seed.ts — semeia a devnet com dados reais: mint de 2 veículos + eventos,
// um deles com a inconsistência do vídeo (hodômetro 80.000 → 45.000).
//
// Rodar (DEPOIS de financiar a carteira devnet, gate de sábado 23:00):
//   cd apps/web && npx tsx scripts/seed.ts
//
// Requer no .env.local (ou no ambiente):
//   NEXT_PUBLIC_RPC=<rpc devnet do bounty>
//   VIN_PEPPER=<mesma string usada na /api/commit>
//   SEED_SECRET_KEY=<secret key base58 OU json array de 64 bytes>   # carteira devnet financiada
//   (alternativa: SEED_KEYPAIR_PATH=C:\...\id.json)
//
// Ao final, imprime os endereços dos assets e signatures para colar no formulário de submissão.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplCore } from '@metaplex-foundation/mpl-core';
import { keypairIdentity, type Umi } from '@metaplex-foundation/umi';
import { base58 } from '@metaplex-foundation/umi/serializers';
import { mintVehicle, appendEvent } from '../lib/vehicle';
import { saveVeiculo, saveDado } from '../lib/db';
import { sha256Hex, encrypt, randomKey, splitKey, toHex } from '../lib/crypto';
import { KIND, SCOPE, MEMO_VERSION, type Kind, type Scope } from '../lib/types';

// --- carrega .env.local (parser mínimo, sem dep) --------------------------
function loadEnvLocal(): void {
  const p = resolve(process.cwd(), '.env.local');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
  }
}

function secretKeyBytes(): Uint8Array {
  const path = process.env.SEED_KEYPAIR_PATH;
  if (path && existsSync(path)) return Uint8Array.from(JSON.parse(readFileSync(path, 'utf8')));
  const raw = process.env.SEED_SECRET_KEY;
  if (!raw) {
    throw new Error(
      'Defina SEED_SECRET_KEY (base58 ou json array) ou SEED_KEYPAIR_PATH no .env.local — carteira devnet financiada.',
    );
  }
  return raw.trim().startsWith('[') ? Uint8Array.from(JSON.parse(raw)) : base58.serialize(raw.trim());
}

interface EventoSeed {
  kind: Kind;
  km: number;
  scope: Scope;
  emissor: string;
  sensivel: string;
}

async function semearVeiculo(umi: Umi, chassi: string, nome: string, eventos: EventoSeed[]) {
  const pepper = process.env.VIN_PEPPER ?? '';
  const vinCommit = await sha256Hex(chassi + pepper);
  const { asset, sig } = await mintVehicle(umi, { vinCommit, km: 0, name: nome });
  await saveVeiculo(vinCommit, asset, nome); // índice off-chain p/ a verificação por vinCommit
  console.log(`\n🚗 ${nome}`);
  console.log(`   asset:  ${asset}`);
  console.log(`   mint:   https://solscan.io/tx/${sig}?cluster=devnet`);
  console.log(`   verify: /v/${vinCommit}`);

  let kmMax = 0;
  for (const ev of eventos) {
    const payload = `${ev.sensivel}|${chassi}|${ev.km}`;
    const hash = await sha256Hex(payload);
    const { sig: esig } = await appendEvent(umi, asset, {
      v: MEMO_VERSION,
      kind: ev.kind,
      km: ev.km,
      hash,
      scope: ev.scope,
      emissor: ev.emissor,
    });
    // ciphertext off-chain sob o mesmo hash do memo (na chain só o hash) + 5 shares 3-de-5
    const K = randomKey();
    const shares = (await splitKey(K)).map(toHex);
    const cipher = await encrypt(payload, K);
    await saveDado({ hash, asset, ct: cipher.ct, iv: cipher.iv, shares });
    const flag = ev.km < kmMax ? ' ⚠️' : '';
    if (ev.km > kmMax) kmMax = ev.km;
    console.log(`   +${ev.kind} @ ${ev.km.toLocaleString('pt-BR')} km${flag}  ${esig.slice(0, 12)}…`);
  }
  return { asset, vinCommit };
}

async function main() {
  loadEnvLocal();
  const rpc = process.env.NEXT_PUBLIC_RPC ?? 'https://api.devnet.solana.com';
  const umi = createUmi(rpc).use(mplCore());
  umi.use(keypairIdentity(umi.eddsa.createKeypairFromSecretKey(secretKeyBytes())));
  console.log(`RPC: ${rpc}`);
  console.log(`Signer: ${umi.identity.publicKey}`);

  // Veículo A — histórico íntegro (km sempre sobe).
  await semearVeiculo(umi, '9BWZZZ377VT004251', 'VW Gol 2019 (íntegro)', [
    { kind: KIND.REVISAO, km: 15_000, scope: SCOPE.OFICINA, emissor: 'Oficina Central', sensivel: 'troca de óleo + filtros' },
    { kind: KIND.VISTORIA, km: 38_000, scope: SCOPE.VISTORIADOR, emissor: 'Vistoria Rápida', sensivel: 'laudo cautelar aprovado' },
    { kind: KIND.REVISAO, km: 62_000, scope: SCOPE.OFICINA, emissor: 'Oficina do Bairro', sensivel: 'correia dentada' },
    { kind: KIND.REVISAO, km: 80_000, scope: SCOPE.OFICINA, emissor: 'Oficina Central', sensivel: 'revisão 80 mil' },
  ]);

  // Veículo B — com fraude: hodômetro retrocede de 80.000 para 45.000.
  await semearVeiculo(umi, '9BWZZZ377VT009988', 'VW Gol 2019 (fraudado)', [
    { kind: KIND.REVISAO, km: 20_000, scope: SCOPE.OFICINA, emissor: 'Oficina Central', sensivel: 'revisão 20 mil' },
    { kind: KIND.REVISAO, km: 55_000, scope: SCOPE.OFICINA, emissor: 'Oficina do Bairro', sensivel: 'revisão 55 mil' },
    { kind: KIND.REVISAO, km: 80_000, scope: SCOPE.OFICINA, emissor: 'Oficina Central', sensivel: 'revisão 80 mil' },
    { kind: KIND.REVISAO, km: 45_000, scope: SCOPE.OFICINA, emissor: 'AutoCenter Suspeito', sensivel: 'hodômetro adulterado' },
  ]);

  console.log('\n✅ Seed concluído. Cole o asset e uma signature no formulário. Lembre: NEXT_PUBLIC_MOCK=0 no deploy final.');
}

main().catch((e) => {
  console.error('\n❌ Seed falhou:', e instanceof Error ? e.message : e);
  process.exit(1);
});
