import { describe, it, expect } from 'vitest';
import {
  KIND,
  KIND_LABEL,
  KIND_ICON,
  SCOPE,
  SCOPE_LABEL,
  MEMO_VERSION,
  checkIntegrity,
  type VehicleEvent,
} from '@/lib/types';

const ev = (km: number, kind = KIND.REVISAO): VehicleEvent => ({
  v: MEMO_VERSION,
  kind,
  km,
  hash: 'h',
});

describe('catálogos', () => {
  it('todo KIND tem label e ícone', () => {
    for (const k of Object.values(KIND)) {
      expect(KIND_LABEL[k]).toBeTruthy();
      expect(KIND_ICON[k]).toMatch(/^fa-/);
    }
  });

  it('todo SCOPE tem label', () => {
    for (const s of Object.values(SCOPE)) {
      expect(SCOPE_LABEL[s]).toBeTruthy();
    }
  });
});

describe('checkIntegrity', () => {
  it('histórico vazio é íntegro com kmMax 0', () => {
    const r = checkIntegrity([]);
    expect(r.ok).toBe(true);
    expect(r.issues).toHaveLength(0);
    expect(r.kmMax).toBe(0);
  });

  it('km sempre crescente é íntegro', () => {
    const r = checkIntegrity([ev(15000), ev(38000), ev(80000)]);
    expect(r.ok).toBe(true);
    expect(r.kmMax).toBe(80000);
  });

  it('km igual ao anterior não gera inconsistência', () => {
    const r = checkIntegrity([ev(80000), ev(80000)]);
    expect(r.ok).toBe(true);
    expect(r.kmMax).toBe(80000);
  });

  it('retrocesso do hodômetro gera inconsistência com a mensagem formatada', () => {
    const r = checkIntegrity([ev(80000), ev(45000)]);
    expect(r.ok).toBe(false);
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0]).toMatchObject({ index: 1, type: 'odometer_rollback' });
    expect(r.issues[0].message).toBe('Hodômetro retrocedeu de 80.000 para 45.000 km');
    // kmMax não regride ao valor menor
    expect(r.kmMax).toBe(80000);
  });
});
