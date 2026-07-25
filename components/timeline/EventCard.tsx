// Card de um evento na timeline. Sem Font Awesome carregado no projeto — KIND_ICON (nomes
// 'fa-*') é traduzido para um emoji equivalente via KIND_EMOJI (mapa local, só de UI).

import { KIND_ICON, KIND_LABEL, SCOPE_LABEL, type VehicleEvent } from '@/lib/types';

const KIND_EMOJI: Record<string, string> = {
  'fa-certificate': '📜',
  'fa-screwdriver-wrench': '🔧',
  'fa-car-burst': '💥',
  'fa-triangle-exclamation': '⚠️',
  'fa-clipboard-check': '🔍',
  'fa-right-left': '🔁',
};

export interface EventCardProps {
  event: VehicleEvent;
  /** true quando este evento é a origem de uma IntegrityIssue */
  flagged?: boolean;
  /** IntegrityIssue.message, exibido quando flagged */
  issueMessage?: string;
}

export function EventCard({ event, flagged = false, issueMessage }: EventCardProps) {
  const emoji = KIND_EMOJI[KIND_ICON[event.kind]] ?? '•';
  const kmFormatado = `${event.km.toLocaleString('pt-BR')} km`;
  const data = event.ts
    ? new Date(event.ts * 1000).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : null;
  const hashCurto = `${event.hash.slice(0, 10)}…`;
  const scopeLabel = event.scope ? SCOPE_LABEL[event.scope] : undefined;

  return (
    <div
      className={[
        'rounded-xl p-4 transition-colors',
        flagged
          ? 'border-2 border-[var(--sc-alerta)] bg-[var(--sc-alerta)]/10'
          : 'border border-[var(--sc-border)] bg-[var(--sc-card)]',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none" aria-hidden="true">
          {emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <h3 className="font-semibold text-[var(--sc-text)]">{KIND_LABEL[event.kind]}</h3>
            {data && <span className="text-xs text-[var(--sc-muted)]">{data}</span>}
          </div>

          <p className="mt-1 text-sm text-[var(--sc-muted)]">
            {kmFormatado}
            {event.emissor && <> · {event.emissor}</>}
            {scopeLabel && <> · {scopeLabel}</>}
          </p>

          {flagged && issueMessage && (
            <p className="mt-2 text-sm font-semibold text-[var(--sc-alerta)]">⚠️ {issueMessage}</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-[var(--sc-muted)]">
            <span title={event.hash}>{hashCurto}</span>
            {event.sig && (
              <a
                href={`https://solscan.io/tx/${event.sig}?cluster=devnet`}
                target="_blank"
                rel="noreferrer noopener"
                className="text-[var(--sc-primary)] hover:underline"
              >
                ver no Solscan ↗
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
