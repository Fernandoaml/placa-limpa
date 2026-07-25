// Página pública de verificação — a tela que vende (raw §5): abre com o selo de
// integridade, depois a timeline completa e imutável do veículo.

import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { AlertaInconsistencia } from '@/components/timeline/AlertaInconsistencia';
import { Timeline } from '@/components/timeline/Timeline';
import { AutoRefresh } from '@/components/AutoRefresh';
import { checkIntegrity } from '@/lib/types';
import { getVehicle } from '@/lib/vehicle';
import { MOCK_VEHICLE } from '@/lib/mock';
import { MOCK } from '@/lib/solana';
import { getAssetByCommit } from '@/lib/db';

export default async function VehiclePage({
  params,
}: {
  params: Promise<{ commit: string }>;
}) {
  const { commit } = await params;

  // MOCK ou /v/demo → dados de demonstração. Senão: resolve vinCommit → asset (base local)
  // e lê a chain (a Solana não indexa por atributo, então o mapa vive no SQLite).
  let vehicle;
  let indexado = false; // achamos o asset no índice off-chain?
  if (MOCK) {
    vehicle = (await getVehicle(commit)) ?? MOCK_VEHICLE;
  } else if (commit === 'demo') {
    vehicle = MOCK_VEHICLE;
  } else {
    const asset = await getAssetByCommit(commit);
    indexado = Boolean(asset);
    vehicle = asset ? await getVehicle(asset) : null;
  }

  // Indexado (existe no banco) mas a chain ainda não respondeu → mint recém-emitido em propagação.
  // Auto-atualiza até o RPC enxergar o asset, em vez do "não encontrado" enganoso.
  if (!vehicle && indexado) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-[var(--sc-bg)] px-6 py-16 text-center">
        <AutoRefresh seconds={5} />
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--sc-border)] border-t-[var(--sc-primary)]" />
        <h1 className="text-2xl font-semibold text-[var(--sc-text)]">Veículo recém-emitido</h1>
        <p className="max-w-md text-sm text-[var(--sc-muted)]">
          O registro já está na Solana, mas a rede ainda está propagando a transação. Esta página
          atualiza sozinha em alguns segundos — não precisa fazer nada.
        </p>
        <Link href={`/v/${commit}`} className="text-sm font-medium text-[var(--sc-primary)] hover:underline">
          Verificar agora
        </Link>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-[var(--sc-bg)] px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold text-[var(--sc-text)]">Veículo não encontrado</h1>
        <p className="max-w-md text-sm text-[var(--sc-muted)]">
          Não encontramos um histórico para{' '}
          <span className="font-mono text-[var(--sc-text)]">{commit}</span>. Confira o código e
          tente novamente.
        </p>
        <Link
          href="/"
          className="text-sm font-medium text-[var(--sc-primary)] hover:underline"
        >
          Voltar ao início
        </Link>
      </div>
    );
  }

  const integrity = checkIntegrity(vehicle.events);

  return (
    <div className="flex flex-1 flex-col items-center bg-[var(--sc-bg)] px-6 py-10 sm:py-16">
      <main className="flex w-full max-w-2xl flex-col gap-6">
        <AlertaInconsistencia integrity={integrity} nEventos={vehicle.nEventos} />

        <Card>
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div className="min-w-0">
              <dt className="text-[var(--sc-muted)]">Asset</dt>
              <dd
                className="truncate font-mono text-[var(--sc-text)]"
                title={vehicle.asset}
              >
                {vehicle.asset.slice(0, 10)}…
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[var(--sc-muted)]">VIN (commit)</dt>
              <dd
                className="truncate font-mono text-[var(--sc-text)]"
                title={vehicle.vinCommit}
              >
                {vehicle.vinCommit.slice(0, 10)}…
              </dd>
            </div>
            <div>
              <dt className="text-[var(--sc-muted)]">Hodômetro atual</dt>
              <dd className="text-[var(--sc-text)]">
                {vehicle.kmAtual.toLocaleString('pt-BR')} km
              </dd>
            </div>
            <div>
              <dt className="text-[var(--sc-muted)]">Eventos</dt>
              <dd className="text-[var(--sc-text)]">{vehicle.nEventos}</dd>
            </div>
          </dl>
        </Card>

        <Timeline events={vehicle.events} integrity={integrity} />
      </main>
    </div>
  );
}
