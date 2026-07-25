// Domínio Placa Limpa — tipos, rótulos, ícones e a checagem de integridade (lógica pura).
// Fonte: raw/placa-limpa-plano.md §2/§5. Sem dependência de runtime — testável isolado.

/** Tipos de evento anexados ao ciclo de vida do veículo. */
export const KIND = {
  MINT: 'mint',
  REVISAO: 'revisao',
  SINISTRO: 'sinistro',
  RECALL: 'recall',
  VISTORIA: 'vistoria',
  TRANSFERENCIA: 'transferencia',
} as const;
export type Kind = (typeof KIND)[keyof typeof KIND];

export const KIND_LABEL: Record<Kind, string> = {
  [KIND.MINT]: 'Emissão do veículo',
  [KIND.REVISAO]: 'Revisão',
  [KIND.SINISTRO]: 'Sinistro',
  [KIND.RECALL]: 'Recall',
  [KIND.VISTORIA]: 'Vistoria',
  [KIND.TRANSFERENCIA]: 'Transferência de propriedade',
};

/** Ícone Font Awesome 6 (nome), traduzido para a UI. */
export const KIND_ICON: Record<Kind, string> = {
  [KIND.MINT]: 'fa-certificate',
  [KIND.REVISAO]: 'fa-screwdriver-wrench',
  [KIND.SINISTRO]: 'fa-car-burst',
  [KIND.RECALL]: 'fa-triangle-exclamation',
  [KIND.VISTORIA]: 'fa-clipboard-check',
  [KIND.TRANSFERENCIA]: 'fa-right-left',
};

/** Escopo credenciado do emissor que assina o evento. */
export const SCOPE = {
  MONTADORA: 'montadora',
  OFICINA: 'oficina',
  SEGURADORA: 'seguradora',
  VISTORIADOR: 'vistoriador',
  DETRAN: 'detran',
} as const;
export type Scope = (typeof SCOPE)[keyof typeof SCOPE];

export const SCOPE_LABEL: Record<Scope, string> = {
  [SCOPE.MONTADORA]: 'Montadora',
  [SCOPE.OFICINA]: 'Oficina credenciada',
  [SCOPE.SEGURADORA]: 'Seguradora',
  [SCOPE.VISTORIADOR]: 'Vistoriador',
  [SCOPE.DETRAN]: 'Órgão de trânsito',
};

/** Versão do schema do memo on-chain. Suba ao mudar o formato do payload. */
export const MEMO_VERSION = 1;

/** Payload compacto gravado no SPL Memo de cada evento. */
export interface MemoPayload {
  /** schema version */
  v: number;
  kind: Kind;
  /** hodômetro no momento do evento (km) */
  km: number;
  /** sha256(payload sensível) em hex */
  hash: string;
}

/** Evento já materializado para a UI (memo + metadados da tx). */
export interface VehicleEvent extends MemoPayload {
  /** signature da tx na devnet, quando on-chain */
  sig?: string;
  /** blockTime (segundos epoch) */
  ts?: number;
  /** rótulo ou pubkey do emissor */
  emissor?: string;
  scope?: Scope;
}

/** Veículo = asset Core + seus atributos e eventos. */
export interface Vehicle {
  /** endereço do asset (Metaplex Core) */
  asset: string;
  /** sha256(chassi + PEPPER) — não expõe o VIN */
  vinCommit: string;
  kmAtual: number;
  nEventos: number;
  events: VehicleEvent[];
}

export interface IntegrityIssue {
  /** índice do evento problemático na timeline ordenada */
  index: number;
  type: 'odometer_rollback';
  message: string;
}

export interface IntegrityResult {
  ok: boolean;
  issues: IntegrityIssue[];
  /** maior km observado até então (útil para a UI) */
  kmMax: number;
}

/**
 * Checa a integridade do histórico. Regra central do produto: **hodômetro não retrocede**.
 * Sem programa custom, isso é validação de cliente — mas a fraude fica registrada para sempre.
 * Erro silencioso aqui reprova o vídeo, então é lógica pura, testada e sem dependências.
 *
 * @param events eventos em ordem cronológica (mais antigo primeiro).
 */
export function checkIntegrity(events: readonly VehicleEvent[]): IntegrityResult {
  const issues: IntegrityIssue[] = [];
  let kmMax = 0;
  events.forEach((ev, index) => {
    if (ev.km < kmMax) {
      issues.push({
        index,
        type: 'odometer_rollback',
        message: `Hodômetro retrocedeu de ${kmMax.toLocaleString('pt-BR')} para ${ev.km.toLocaleString('pt-BR')} km`,
      });
    } else {
      kmMax = ev.km;
    }
  });
  return { ok: issues.length === 0, issues, kmMax };
}
