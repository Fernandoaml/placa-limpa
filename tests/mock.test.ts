import { describe, it, expect } from 'vitest';
import { MOCK_VEHICLE, getMockVehicle } from '@/lib/mock';
import { checkIntegrity } from '@/lib/types';

describe('MOCK_VEHICLE', () => {
  it('tem 6 eventos e a inconsistência do vídeo (80.000 → 45.000)', () => {
    expect(MOCK_VEHICLE.events).toHaveLength(6);
    expect(MOCK_VEHICLE.nEventos).toBe(6);
    expect(MOCK_VEHICLE.kmAtual).toBe(45000);
    const r = checkIntegrity(MOCK_VEHICLE.events);
    expect(r.ok).toBe(false);
    expect(r.issues[0].message).toMatch(/80\.000 para 45\.000/);
  });

  it('todo evento tem sig e hash de 64 hex', () => {
    for (const e of MOCK_VEHICLE.events) {
      expect(e.sig).toBeTruthy();
      expect(e.hash).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

describe('getMockVehicle', () => {
  it('sem commit retorna o veículo mock', () => {
    expect(getMockVehicle()).toBe(MOCK_VEHICLE);
  });

  it('com o vinCommit correto retorna o veículo', () => {
    expect(getMockVehicle(MOCK_VEHICLE.vinCommit)).toBe(MOCK_VEHICLE);
  });

  it('com um commit desconhecido retorna null', () => {
    expect(getMockVehicle('nao-existe')).toBeNull();
  });
});
