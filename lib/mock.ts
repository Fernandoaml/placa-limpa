// Dados de demonstração (NEXT_PUBLIC_MOCK=1). Um veículo, 6 eventos, com a inconsistência
// do roteiro do vídeo: hodômetro cai de 80.000 → 45.000 (raw/placa-limpa-plano.md §2/§8).
// DESLIGAR no deploy final (§9).

import { KIND, SCOPE, MEMO_VERSION, type Vehicle, type VehicleEvent } from './types';

const h = (s: string): string =>
  // hash fake porém determinístico e com cara de sha256 (64 hex) — só para a demo mock.
  Array.from(s).reduce((a, c) => (a * 33 + c.charCodeAt(0)) >>> 0, 5381).toString(16).padStart(8, '0').repeat(8).slice(0, 64);

const ev = (
  kind: VehicleEvent['kind'],
  km: number,
  scope: VehicleEvent['scope'],
  emissor: string,
  daysAgo: number,
  sig: string,
): VehicleEvent => ({
  v: MEMO_VERSION,
  kind,
  km,
  hash: h(`${kind}:${km}:${emissor}`),
  emissor,
  scope,
  ts: Math.floor(Date.parse('2026-07-25T12:00:00-03:00') / 1000) - daysAgo * 86_400,
  sig,
});

const events: VehicleEvent[] = [
  ev(KIND.MINT, 0, SCOPE.MONTADORA, 'Montadora VW', 900, 'mock1MintSig111111111111111111111111111111111'),
  ev(KIND.REVISAO, 15_000, SCOPE.OFICINA, 'Oficina Central', 720, 'mock2RevSig2222222222222222222222222222222222'),
  ev(KIND.VISTORIA, 38_000, SCOPE.VISTORIADOR, 'Vistoria Rápida', 480, 'mock3VistSig333333333333333333333333333333333'),
  ev(KIND.REVISAO, 62_000, SCOPE.OFICINA, 'Oficina do Bairro', 240, 'mock4RevSig4444444444444444444444444444444444'),
  ev(KIND.REVISAO, 80_000, SCOPE.OFICINA, 'Oficina Central', 90, 'mock5RevSig5555555555555555555555555555555555'),
  // ⚠️ evento fraudulento: hodômetro retrocede de 80.000 para 45.000
  ev(KIND.REVISAO, 45_000, SCOPE.OFICINA, 'AutoCenter Suspeito', 20, 'mock6FraudSig66666666666666666666666666666666'),
];

export const MOCK_VEHICLE: Vehicle = {
  asset: 'MockAsseT1111111111111111111111111111111111',
  vinCommit: h('9BWZZZ377VT004251+PEPPER'),
  kmAtual: 45_000,
  nEventos: events.length,
  events,
};

/** Retorna o veículo de demonstração por `vinCommit` (ou o único mock, se bater). */
export function getMockVehicle(commit?: string): Vehicle | null {
  if (!commit || commit === MOCK_VEHICLE.vinCommit) return MOCK_VEHICLE;
  return null;
}
