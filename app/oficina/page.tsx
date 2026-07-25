'use client';

// Fluxo da oficina (e demais emissores credenciados): anexa um evento ao histórico do
// veículo. O dado sensível nunca vai on-chain — só o sha256 dele entra no memo.

import { useEffect, useState, type FormEvent } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { WalletButton } from '@/components/wallet/WalletButton';
import { getUmi } from '@/lib/solana';
import { appendEvent } from '@/lib/vehicle';
import { sha256Hex, encrypt, randomKey, splitKey, toHex } from '@/lib/crypto';
import { KIND, KIND_LABEL, SCOPE, SCOPE_LABEL, MEMO_VERSION, type Kind, type Scope } from '@/lib/types';

type Status = 'idle' | 'loading' | 'success' | 'error';

const EVENT_KINDS = (Object.values(KIND) as Kind[]).filter((k) => k !== KIND.MINT);
const SCOPES = Object.values(SCOPE) as Scope[];

interface VeiculoOption {
  asset: string;
  nome: string;
  vin_commit: string;
}

export default function OficinaPage() {
  const wallet = useWallet();
  const { connected, publicKey } = wallet;

  const [asset, setAsset] = useState('');
  const [veiculos, setVeiculos] = useState<VeiculoOption[]>([]);
  const [kind, setKind] = useState<Kind>(EVENT_KINDS[0]);
  const [km, setKm] = useState('0');
  const [scope, setScope] = useState<Scope>(SCOPE.OFICINA);
  const [dadoSensivel, setDadoSensivel] = useState('');

  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [sig, setSig] = useState<string | null>(null);

  const busy = status === 'loading';

  // Carrega os veículos registrados para o seletor (mesma fonte do /verificar).
  useEffect(() => {
    fetch('/api/veiculos')
      .then((r) => r.json())
      .then((j: { veiculos?: VeiculoOption[] }) => {
        const list = j.veiculos ?? [];
        setVeiculos(list);
        setAsset((a) => a || list[0]?.asset || '');
      })
      .catch(() => {});
  }, []);

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
      const kmNumber = Number(km);
      const payload = dadoSensivel.trim() || `${asset.trim()}:${kmNumber}`;
      const hash = await sha256Hex(payload);

      const umi = getUmi(wallet);
      const { sig: txSig } = await appendEvent(umi, asset.trim(), {
        v: MEMO_VERSION,
        kind,
        km: kmNumber,
        hash,
        scope,
        emissor: publicKey?.toBase58(),
      });

      // Guarda o ciphertext off-chain sob o MESMO hash do memo (na chain só foi o hash) + 5 shares 3-de-5.
      const K = randomKey();
      const shares = (await splitKey(K)).map(toHex);
      const cipher = await encrypt(payload, K);
      void fetch('/api/dados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash, asset: asset.trim(), ct: cipher.ct, iv: cipher.iv, shares }),
      }).catch(() => {});

      setSig(txSig);
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido ao registrar o evento');
      setStatus('error');
    }
  }

  function novoEvento() {
    setStatus('idle');
    setSig(null);
    setError(null);
    setDadoSensivel('');
    setKm('0');
  }

  return (
    <div className="flex flex-1 flex-col items-center bg-[var(--sc-bg)] px-6 py-16 sm:py-24">
      <main className="flex w-full max-w-xl flex-col gap-8">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--sc-text)]">
            Oficina
          </h1>
          <p className="text-sm text-[var(--sc-muted)]">
            Registre um evento no histórico do veículo na Solana devnet.
          </p>
        </div>

        {status !== 'success' && !connected && (
          <Card className="flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-[var(--sc-text)]">
              Conecte a wallet (devnet) para escrever on-chain.
            </p>
            <WalletButton />
          </Card>
        )}

        {status !== 'success' && (
        <Card>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-[var(--sc-text)]">Veículo</span>
              <select
                required
                value={asset}
                onChange={(e) => setAsset(e.target.value)}
                className="rounded-lg border border-[var(--sc-border)] bg-[var(--sc-bg)] px-3 py-2 text-[var(--sc-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--sc-ring)]"
                disabled={busy || veiculos.length === 0}
              >
                {veiculos.length === 0 && <option value="">Nenhum veículo registrado</option>}
                {veiculos.map((v) => (
                  <option key={v.asset} value={v.asset}>
                    {v.nome || `${v.asset.slice(0, 12)}…`}
                  </option>
                ))}
              </select>
              {asset && (
                <span
                  className="truncate font-mono text-xs text-[var(--sc-muted)]"
                  title={asset}
                >
                  {asset}
                </span>
              )}
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-[var(--sc-text)]">Tipo de evento</span>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as Kind)}
                className="rounded-lg border border-[var(--sc-border)] bg-[var(--sc-bg)] px-3 py-2 text-[var(--sc-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--sc-ring)]"
                disabled={busy}
              >
                {EVENT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-[var(--sc-text)]">Km atual</span>
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
              <span className="font-medium text-[var(--sc-text)]">Escopo do emissor</span>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as Scope)}
                className="rounded-lg border border-[var(--sc-border)] bg-[var(--sc-bg)] px-3 py-2 text-[var(--sc-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--sc-ring)]"
                disabled={busy}
              >
                {SCOPES.map((s) => (
                  <option key={s} value={s}>
                    {SCOPE_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-[var(--sc-text)]">Dado sensível</span>
              <textarea
                value={dadoSensivel}
                onChange={(e) => setDadoSensivel(e.target.value)}
                placeholder="Ex.: laudo, nota fiscal, peças trocadas… (só o hash vai on-chain)"
                rows={3}
                className="rounded-lg border border-[var(--sc-border)] bg-[var(--sc-bg)] px-3 py-2 text-[var(--sc-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--sc-ring)]"
                disabled={busy}
              />
            </label>

            <Button type="submit" disabled={busy || !connected}>
              {busy ? 'Assinando…' : 'Registrar evento'}
            </Button>

            {error && (
              <p className="text-sm text-[var(--sc-alerta)]" role="alert">
                {error}
              </p>
            )}
          </form>
        </Card>
        )}

        {status === 'success' && sig && (
          <Card className="flex flex-col gap-3">
            <p className="text-sm font-medium text-[var(--sc-ok)]">Evento registrado com sucesso.</p>

            <div className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--sc-muted)]">Assinatura</span>
              <span className="break-all font-mono text-[var(--sc-text)]">{sig}</span>
            </div>

            <a
              href={`https://solscan.io/tx/${sig}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-[var(--sc-primary)] underline underline-offset-2"
            >
              Ver transação no Solscan
            </a>

            <Button variant="secondary" onClick={novoEvento} className="mt-2">
              Registrar outro evento
            </Button>
          </Card>
        )}
      </main>
    </div>
  );
}
