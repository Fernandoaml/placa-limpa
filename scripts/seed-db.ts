// Semeia a base local SQLite (data/placa-limpa.db) com emissores credenciados + 1 dado sensível
// de demo (ciphertext cujo hash bate com o do veículo semeado). Rodar:
//   cd apps/web && npx tsx scripts/seed-db.ts
// O arquivo .db resultante é versionado no git (é lido em produção na Vercel).

import { resetSeedTables, seedEmissores, saveDado, saveVeiculo, listEmissores, listVeiculos, closeDb } from '../lib/db';
import { randomKey, encrypt, sha256Hex, splitKey, toHex } from '../lib/crypto';

// Veículos atualmente na devnet (mintados por scripts/seed.ts sob a carteira descartável).
const VEICULOS_ONCHAIN: [vinCommit: string, asset: string, nome: string][] = [
  ['55136edccd343d8c49981ae7368db66dfaa1c26b8d42399871dbf40f7ae1051b', 'GEEb1wEHnxoNhJrbDSKVyejPJCNXQBP59yLHgYVGBmZn', 'VW Gol 2019 — íntegro'],
  ['b2bb2440b6c53c6ea978db3f74ec8b4da978d6f03662e7e4761748ae6cc2be43', 'FgfrTMEKfLQni6PnVPdBCt6MDBH5LDhMppJBzLX8nT6M', 'VW Gol 2019 — fraudado'],
];

// Eventos de cada veículo (mesma definição que scripts/seed.ts usou no mint on-chain).
// O hash é sha256(`${sensivel}|${chassi}|${km}`) — IDÊNTICO ao que está no memo da chain.
const ASSET_INTEGRO = 'GEEb1wEHnxoNhJrbDSKVyejPJCNXQBP59yLHgYVGBmZn';
const ASSET_FRAUDADO = 'FgfrTMEKfLQni6PnVPdBCt6MDBH5LDhMppJBzLX8nT6M';
const EVENTOS: { asset: string; chassi: string; km: number; sensivel: string }[] = [
  { asset: ASSET_INTEGRO, chassi: '9BWZZZ377VT004251', km: 15_000, sensivel: 'troca de óleo + filtros' },
  { asset: ASSET_INTEGRO, chassi: '9BWZZZ377VT004251', km: 38_000, sensivel: 'laudo cautelar aprovado' },
  { asset: ASSET_INTEGRO, chassi: '9BWZZZ377VT004251', km: 62_000, sensivel: 'correia dentada' },
  { asset: ASSET_INTEGRO, chassi: '9BWZZZ377VT004251', km: 80_000, sensivel: 'revisão 80 mil' },
  { asset: ASSET_FRAUDADO, chassi: '9BWZZZ377VT009988', km: 20_000, sensivel: 'revisão 20 mil' },
  { asset: ASSET_FRAUDADO, chassi: '9BWZZZ377VT009988', km: 55_000, sensivel: 'revisão 55 mil' },
  { asset: ASSET_FRAUDADO, chassi: '9BWZZZ377VT009988', km: 80_000, sensivel: 'revisão 80 mil' },
  { asset: ASSET_FRAUDADO, chassi: '9BWZZZ377VT009988', km: 45_000, sensivel: 'hodômetro adulterado' },
];

// Carteira que minta os veículos no seed on-chain = a montadora credenciada.
const MONTADORA_PUBKEY = 'AENk2DB1xKpi3Urs8UJgqk5BWLA25Xqruz8eJMF9VFJP';

async function main() {
  await resetSeedTables(); // idempotente: limpa antes de semear (evita órfãos de seeds anteriores)
  await seedEmissores(MONTADORA_PUBKEY);

  for (const [vinCommit, asset, nome] of VEICULOS_ONCHAIN) await saveVeiculo(vinCommit, asset, nome);

  // Um ciphertext por evento, indexado pelo MESMO hash que está no memo on-chain.
  // payload = `${sensivel}|${chassi}|${km}`  →  hash = sha256(payload) = o hash do memo.
  let dados = 0;
  for (const e of EVENTOS) {
    const payload = `${e.sensivel}|${e.chassi}|${e.km}`;
    const hash = await sha256Hex(payload);
    const K = randomKey();
    const shares = (await splitKey(K)).map(toHex); // 5 shares 3-de-5
    const cipher = await encrypt(payload, K);
    await saveDado({ hash, asset: e.asset, ct: cipher.ct, iv: cipher.iv, shares });
    dados++;
  }

  console.log('✅ Base semeada.');
  console.log('   emissores:', (await listEmissores()).length);
  console.log('   veículos:', (await listVeiculos()).length);
  console.log('   dados_sensiveis:', dados, '(1 por evento, hash = hash do memo)');
  await closeDb();
}

main().catch((e) => {
  console.error('❌ seed-db falhou:', e instanceof Error ? e.message : e);
  process.exit(1);
});
