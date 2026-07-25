// Selo de integridade do topo da página pública — o frame de abertura do vídeo (raw §5).
// Estilo do design Pencil: bloco com fundo tint (cor a ~10%) + borda e texto sólidos — não chapado.

import type { IntegrityResult } from '@/lib/types';

export interface AlertaInconsistenciaProps {
  integrity: IntegrityResult;
  /** total de eventos do veículo (Vehicle.nEventos) */
  nEventos: number;
}

export function AlertaInconsistencia({ integrity, nEventos }: AlertaInconsistenciaProps) {
  if (integrity.ok) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-[var(--sc-ok)]/30 bg-[var(--sc-ok)]/10 px-5 py-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--sc-ok)]/15 text-lg text-[var(--sc-ok)]">
          ✓
        </span>
        <div>
          <p className="text-sm font-semibold text-[var(--sc-ok)]">Histórico íntegro</p>
          <p className="text-xs text-[var(--sc-muted)]">
            {nEventos} eventos verificados · hodômetro consistente
          </p>
        </div>
      </div>
    );
  }

  const mensagem = integrity.issues[0]?.message ?? 'Inconsistência detectada no histórico';

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-2xl border border-[var(--sc-alerta)]/60 bg-[var(--sc-alerta)]/10 px-5 py-4"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--sc-alerta)]/15 text-lg text-[var(--sc-alerta)]">
        ⚠
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold uppercase tracking-wide text-[var(--sc-alerta)]">
          Inconsistência detectada
        </p>
        <p className="mt-0.5 text-sm text-[var(--sc-text)]">{mensagem}</p>
        <p className="mt-1 text-xs text-[var(--sc-muted)]">registro imutável na blockchain</p>
      </div>
    </div>
  );
}
