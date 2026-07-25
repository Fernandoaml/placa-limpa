'use client';

// Fluxo da montadora: emite o asset Core do veículo (mint) — chassi vira vin_commit via
// /api/commit (sha256(chassi+PEPPER) no servidor, o VIN em si nunca sai do form).

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { WalletButton } from '@/components/wallet/WalletButton';
import { getUmi } from '@/lib/solana';
import { mintVehicle } from '@/lib/vehicle';

type Status = 'idle' | 'loading' | 'success' | 'error';

interface MintResult {
  asset: string;
  sig: string;
  vinCommit: string;
}

export default function MontadoraPage() {
  const wallet = useWallet();
  const { connected } = wallet;

  const [chassi, setChassi] = useState('');
  const [km, setKm] = useState('0');
  const [name, setName] = useState('');

  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MintResult | null>(null);

  const busy = status === 'loading';

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!connected) {
      // Sem wallet não há como assinar — o botão de conectar fica visível no form.
      setError('Conecte a wallet (devnet) para escrever on-chain.');
      return;
    }

    setStatus('loading');
    try {
      const commitRes = await fetch('/api/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chassi }),
      });
      const commitBody = (await commitRes.json()) as { commit?: string; error?: string };
      if (!commitRes.ok || !commitBody.commit) {
        throw new Error(commitBody.error ?? 'Falha ao gerar o commit do chassi');
      }
      const vinCommit = commitBody.commit;

      const umi = getUmi(wallet);
      const { asset, sig } = await mintVehicle(umi, {
        vinCommit,
        km: Number(km),
        name: name.trim() || undefined,
      });

      // Registra o índice vinCommit → asset para a verificação. Aguardado (não fire-and-forget):
      // garante o índice gravado ANTES de liberar o link "Verificar" — senão a página abre vazia,
      // pois a resolução vinCommit→asset ainda não existe (bug do "cliquei em verificar e deu vazio").
      const idx = await fetch('/api/veiculos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vinCommit, asset, nome: name.trim() || undefined }),
      });
      if (!idx.ok) throw new Error('Veículo emitido on-chain, mas falha ao registrar o índice de verificação.');

      setResult({ asset, sig, vinCommit });
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido ao emitir o veículo');
      setStatus('error');
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center bg-[var(--sc-bg)] px-6 py-16 sm:py-24">
      <main className="flex w-full max-w-xl flex-col gap-8">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--sc-text)]">
            Montadora
          </h1>
          <p className="text-sm text-[var(--sc-muted)]">
            Emita o registro de origem de um veículo novo na Solana devnet.
          </p>
        </div>

        {!connected && (
          <Card className="flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-[var(--sc-text)]">
              Conecte a wallet (devnet) para escrever on-chain.
            </p>
            <WalletButton />
          </Card>
        )}

        <Card>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-[var(--sc-text)]">Chassi (VIN)</span>
              <input
                required
                value={chassi}
                onChange={(e) => setChassi(e.target.value.toUpperCase())}
                placeholder="9BWZZZ377VT004251"
                className="rounded-lg border border-[var(--sc-border)] bg-[var(--sc-bg)] px-3 py-2 font-mono text-[var(--sc-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--sc-ring)]"
                disabled={busy}
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-[var(--sc-text)]">Km inicial</span>
              <input
                required
                type="number"
                min={0}
                value={km}
                onChange={(e) => setKm(e.target.value)}
                className="rounded-lg border border-[var(--sc-border)] bg-[var(--sc-bg)] px-3 py-2 text-[var(--sc-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--sc-ring)]"
                disabled={busy}
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-[var(--sc-text)]">Nome / modelo (opcional)</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Placa Limpa"
                className="rounded-lg border border-[var(--sc-border)] bg-[var(--sc-bg)] px-3 py-2 text-[var(--sc-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--sc-ring)]"
                disabled={busy}
              />
            </label>

            <Button type="submit" disabled={busy || !connected}>
              {busy ? 'Assinando…' : 'Emitir veículo'}
            </Button>

            {error && (
              <p className="text-sm text-[var(--sc-alerta)]" role="alert">
                {error}
              </p>
            )}
          </form>
        </Card>

        {status === 'success' && result && (
          <Card className="flex flex-col gap-3">
            <p className="text-sm font-medium text-[var(--sc-ok)]">Veículo emitido com sucesso.</p>

            <div className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--sc-muted)]">Asset</span>
              <span className="break-all font-mono text-[var(--sc-text)]">{result.asset}</span>
            </div>

            <div className="flex flex-col gap-2 text-sm sm:flex-row sm:gap-4">
              <a
                href={`https://solscan.io/tx/${result.sig}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
                className="text-[var(--sc-primary)] underline underline-offset-2"
              >
                Ver transação no Solscan
              </a>
              <Link
                href={`/v/${result.vinCommit}`}
                className="text-[var(--sc-primary)] underline underline-offset-2"
              >
                Verificar
              </Link>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
