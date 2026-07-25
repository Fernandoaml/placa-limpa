'use client';

// Seletor de veículos: lista os que já estão registrados (base local /api/veiculos) e
// leva à verificação pública real (/v/<vinCommit>, que lê a chain). Substitui o link fixo do mock.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';

interface VeiculoRow {
  vin_commit: string;
  asset: string;
  nome: string;
}

export default function VerificarPage() {
  const [veiculos, setVeiculos] = useState<VeiculoRow[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/veiculos')
      .then((r) => r.json())
      .then((j: { veiculos?: VeiculoRow[]; error?: string }) => {
        if (j.veiculos) setVeiculos(j.veiculos);
        else setErro(j.error ?? 'Falha ao carregar');
      })
      .catch((e) => setErro(e instanceof Error ? e.message : 'Falha ao carregar'));
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center bg-[var(--sc-bg)] px-6 py-16 sm:py-24">
      <main className="flex w-full max-w-2xl flex-col gap-8">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--sc-text)]">
            Verificar histórico
          </h1>
          <p className="text-sm text-[var(--sc-muted)]">
            Escolha um veículo registrado — o histórico é lido da Solana devnet.
          </p>
        </div>

        {erro && (
          <p className="rounded-lg border border-[var(--sc-alerta)] bg-[var(--sc-alerta)]/10 p-3 text-sm text-[var(--sc-alerta)]">
            {erro}
          </p>
        )}

        {veiculos === null && !erro && (
          <p className="text-center text-sm text-[var(--sc-muted)]">Carregando…</p>
        )}

        {veiculos && veiculos.length === 0 && (
          <p className="text-center text-sm text-[var(--sc-muted)]">
            Nenhum veículo registrado ainda. Emita um em{' '}
            <Link href="/montadora" className="text-[var(--sc-primary)] underline underline-offset-2">
              /montadora
            </Link>
            .
          </p>
        )}

        <div className="grid gap-3">
          {veiculos?.map((v) => (
            <Card key={v.vin_commit} href={`/v/${v.vin_commit}`} className="text-left">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-medium text-[var(--sc-text)]">
                    {v.nome || 'Veículo'}
                  </h2>
                  <p className="truncate font-mono text-xs text-[var(--sc-muted)]" title={v.vin_commit}>
                    {v.vin_commit.slice(0, 18)}…
                  </p>
                </div>
                <span className="shrink-0 text-sm font-medium text-[var(--sc-primary)]">
                  Ver histórico →
                </span>
              </div>
            </Card>
          ))}
        </div>

        <div className="text-center">
          <Link
            href="/v/demo"
            className="text-xs text-[var(--sc-muted)] underline underline-offset-2 hover:text-[var(--sc-text)]"
          >
            ou ver a demonstração (dados mock)
          </Link>
        </div>
      </main>
    </div>
  );
}
