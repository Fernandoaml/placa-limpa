'use client';

// Cofre 3-de-5 — abre um dado sensível REAL (registrado por um evento on-chain).
// Fluxo: (1) escolhe o veículo → (2) vê os registros cifrados dele → (3) abre um hash:
// mostra as 5 shares Shamir → cola 3 → reconstrói a chave AES → decifra e lê o que foi escrito.
// Confere que sha256(dado) == hash do memo on-chain. "Destruir a chave" = crypto-shredding (LGPD art. 18).
//
// ⚠️ Demo: as 5 shares aparecem juntas aqui só para demonstrar o mecanismo. Em produção elas ficam
// distribuídas entre 5 custodiantes (emissor, DPO, proprietário, seguradora, custódia).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { combineKey, decrypt, fromHex, sha256Hex } from '@/lib/crypto';

interface DadoRow {
  hash: string;
  asset: string;
  criado_em: number;
}
interface DadoFull extends DadoRow {
  ct: string;
  iv: string;
  shares: string[];
}
interface VeiculoRow {
  asset: string;
  nome: string;
}

const CUSTODIANTES = ['Emissor / Montadora', 'DPO da plataforma', 'Proprietário', 'Seguradora', 'Custódia / Escrow'];

const data = (ms: number) =>
  new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function CofrePage() {
  const [dados, setDados] = useState<DadoRow[]>([]);
  const [veiculos, setVeiculos] = useState<VeiculoRow[]>([]);
  const [assetSel, setAssetSel] = useState<string | null>(null);
  const [sel, setSel] = useState<DadoFull | null>(null);
  const [entradas, setEntradas] = useState(['', '', '']);
  const [aberto, setAberto] = useState<{ texto: string; confere: boolean } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const carregar = useCallback(() => {
    void Promise.all([
      fetch('/api/dados').then((r) => r.json()),
      fetch('/api/veiculos').then((r) => r.json()),
    ])
      .then(([d, v]: [{ dados?: DadoRow[] }, { veiculos?: VeiculoRow[] }]) => {
        setDados(d.dados ?? []);
        setVeiculos((v.veiculos ?? []).map((x) => ({ asset: x.asset, nome: x.nome })));
      })
      .catch(() => {});
  }, []);

  useEffect(() => carregar(), [carregar]);

  const nomes = useMemo(() => Object.fromEntries(veiculos.map((v) => [v.asset, v.nome])), [veiculos]);
  const contagem = useMemo(() => {
    const m: Record<string, number> = {};
    for (const d of dados) m[d.asset] = (m[d.asset] ?? 0) + 1;
    return m;
  }, [dados]);
  const registros = useMemo(
    () => (assetSel ? dados.filter((d) => d.asset === assetSel) : []),
    [dados, assetSel],
  );

  function escolherVeiculo(asset: string) {
    setAssetSel(asset);
    setSel(null);
    setAberto(null);
    setErro(null);
    setStatus(null);
    setEntradas(['', '', '']);
  }

  async function escolher(hash: string) {
    setErro(null);
    setAberto(null);
    setStatus(null);
    setEntradas(['', '', '']);
    const d = (await fetch(`/api/dados?hash=${hash}`).then((r) => r.json())) as DadoFull;
    setSel(d);
  }

  async function abrir() {
    setErro(null);
    setAberto(null);
    if (!sel) return;
    try {
      const shares = entradas
        .map((s) => s.trim())
        .filter(Boolean)
        .map(fromHex);
      if (shares.length < 3) throw new Error('Cole ao menos 3 das 5 shares.');
      const K = await combineKey(shares);
      const texto = await decrypt({ ct: sel.ct, iv: sel.iv }, K);
      const confere = (await sha256Hex(texto)) === sel.hash;
      setAberto({ texto, confere });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao reconstruir a chave / decifrar.');
    }
  }

  async function destruir() {
    if (!sel) return;
    if (!confirm('Destruir a chave deste registro? É IRREVERSÍVEL — o dado cifrado some para sempre (sobra só o hash na chain).')) return;
    await fetch(`/api/dados?hash=${sel.hash}`, { method: 'DELETE' });
    setStatus('🔥 Ciphertext e shares destruídos. Sobra o hash imutável na chain — que não reidentifica ninguém (LGPD art. 18).');
    setSel(null);
    setAberto(null);
    carregar();
  }

  const campos = aberto ? aberto.texto.split('|') : [];

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 text-[var(--sc-text)]">
      <h1 className="text-2xl font-semibold">Cofre 3-de-5</h1>
      <p className="mt-2 text-[var(--sc-muted)]">
        O dado sensível de cada evento é cifrado (AES-256-GCM); na chain só vai o <strong>hash</strong>.
        A chave é dividida em 5 partes — quaisquer <strong>3</strong> reconstroem e abrem o dado.
      </p>
      <p className="mt-1 text-xs text-[var(--sc-muted)]">
        Demo: as 5 shares aparecem juntas aqui só para você experimentar. Em produção, ficam com 5 custodiantes distintos.
      </p>

      {/* passo 1 — escolher o veículo */}
      <section className="mt-6">
        <h2 className="text-sm font-medium text-[var(--sc-muted)]">1 · Escolha o veículo</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {veiculos.map((v) => (
            <button
              key={v.asset}
              onClick={() => escolherVeiculo(v.asset)}
              className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                assetSel === v.asset
                  ? 'border-[var(--sc-primary)] bg-[var(--sc-primary)]/10'
                  : 'border-[var(--sc-border)] bg-[var(--sc-card)] hover:border-[var(--sc-primary)]'
              }`}
            >
              <span className="block truncate text-[var(--sc-text)]">{v.nome || 'Veículo'}</span>
              <span className="block text-xs text-[var(--sc-muted)]">
                {contagem[v.asset] ?? 0} {(contagem[v.asset] ?? 0) === 1 ? 'registro cifrado' : 'registros cifrados'}
              </span>
              <span className="block truncate font-mono text-xs text-[var(--sc-muted)]" title={v.asset}>
                {v.asset.slice(0, 16)}…
              </span>
            </button>
          ))}
          {veiculos.length === 0 && <p className="text-sm text-[var(--sc-muted)]">Nenhum veículo registrado.</p>}
        </div>
      </section>

      {/* passo 2 — registros do veículo escolhido */}
      {assetSel && (
        <section className="mt-6">
          <h2 className="text-sm font-medium text-[var(--sc-muted)]">
            2 · Registros de <span className="text-[var(--sc-text)]">{nomes[assetSel] ?? 'veículo'}</span>
          </h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {registros.map((d) => (
              <button
                key={d.hash}
                onClick={() => void escolher(d.hash)}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  sel?.hash === d.hash
                    ? 'border-[var(--sc-primary)] bg-[var(--sc-primary)]/10'
                    : 'border-[var(--sc-border)] bg-[var(--sc-card)] hover:border-[var(--sc-primary)]'
                }`}
              >
                <span className="block font-mono text-xs text-[var(--sc-text)]">{d.hash.slice(0, 18)}…</span>
                <span className="block text-xs text-[var(--sc-muted)]">{data(d.criado_em)}</span>
              </button>
            ))}
            {registros.length === 0 && <p className="text-sm text-[var(--sc-muted)]">Nenhum registro cifrado para este veículo.</p>}
          </div>
        </section>
      )}

      {/* passo 3 — abrir o hash (ler o dado) */}
      {sel && (
        <>
          <section className="mt-6">
            <h2 className="text-sm font-medium text-[var(--sc-muted)]">3 · As 5 shares (copie 3 quaisquer)</h2>
            <div className="mt-3 grid gap-2">
              {sel.shares.map((s, i) => (
                <div key={i} className="rounded-lg border border-[var(--sc-border)] bg-[var(--sc-card)] p-3">
                  <div className="text-xs text-[var(--sc-muted)]">Share {i + 1} · {CUSTODIANTES[i]}</div>
                  <div className="mt-1 break-all font-mono text-xs text-[var(--sc-text)]">{s}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6">
            <h2 className="text-sm font-medium text-[var(--sc-muted)]">Reconstruir e abrir (cole 3 shares)</h2>
            <div className="mt-3 grid gap-2">
              {[0, 1, 2].map((i) => (
                <input
                  key={i}
                  value={entradas[i]}
                  onChange={(e) => setEntradas((p) => p.map((v, j) => (j === i ? e.target.value : v)))}
                  placeholder={`share ${i + 1} (hex)`}
                  className="w-full rounded-lg border border-[var(--sc-border)] bg-[var(--sc-bg)] px-3 py-2 font-mono text-xs text-[var(--sc-text)] outline-none focus:border-[var(--sc-primary)]"
                />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              <Button onClick={abrir}>Abrir dado</Button>
              <Button variant="ghost" onClick={destruir}>
                🔥 Destruir a chave (LGPD)
              </Button>
            </div>
          </section>
        </>
      )}

      {erro && (
        <p className="mt-4 rounded-lg border border-[var(--sc-alerta)] bg-[var(--sc-alerta)]/10 p-3 text-sm text-[var(--sc-alerta)]">
          {erro}
        </p>
      )}

      {status && (
        <p className="mt-4 rounded-lg border border-[var(--sc-alerta)] bg-[var(--sc-alerta)]/10 p-3 text-sm text-[var(--sc-alerta)]">
          {status}
        </p>
      )}

      {aberto && (
        <Card className="mt-4 p-5">
          <h2 className="text-sm font-medium text-[var(--sc-ok)]">✅ Dado aberto</h2>
          {campos.length === 3 ? (
            <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-[var(--sc-muted)]">Dado sensível</dt>
                <dd className="text-[var(--sc-text)]">{campos[0]}</dd>
              </div>
              <div>
                <dt className="text-[var(--sc-muted)]">Chassi (VIN)</dt>
                <dd className="font-mono text-[var(--sc-text)]">{campos[1]}</dd>
              </div>
              <div>
                <dt className="text-[var(--sc-muted)]">Hodômetro</dt>
                <dd className="text-[var(--sc-text)]">{Number(campos[2]).toLocaleString('pt-BR')} km</dd>
              </div>
            </dl>
          ) : (
            <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-[var(--sc-text)]">{aberto.texto}</pre>
          )}
          <p className={`mt-3 text-xs ${aberto.confere ? 'text-[var(--sc-ok)]' : 'text-[var(--sc-alerta)]'}`}>
            {aberto.confere
              ? '✅ sha256(dado) confere com o hash gravado no memo on-chain — íntegro e não adulterado.'
              : '⚠️ o hash não confere com o registro.'}
          </p>
        </Card>
      )}
    </main>
  );
}
