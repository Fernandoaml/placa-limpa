import { describe, it, expect } from 'vitest';
import {
  toHex,
  fromHex,
  toBase64,
  fromBase64,
  sha256Hex,
  randomKey,
  encrypt,
  decrypt,
  splitKey,
  combineKey,
} from '@/lib/crypto';

describe('codecs hex/base64', () => {
  it('toHex/fromHex fazem round-trip', () => {
    const bytes = new Uint8Array([0, 1, 15, 16, 255, 128]);
    expect(toHex(bytes)).toBe('00010f10ff80');
    expect(Array.from(fromHex('00010f10ff80'))).toEqual(Array.from(bytes));
  });

  it('fromHex aceita maiúsculas e espaços nas bordas', () => {
    expect(Array.from(fromHex('  FF00  '))).toEqual([255, 0]);
  });

  it('fromHex rejeita comprimento ímpar', () => {
    expect(() => fromHex('abc')).toThrow(/ímpar/);
  });

  it('toBase64/fromBase64 fazem round-trip', () => {
    const bytes = new Uint8Array([104, 105, 33]); // "hi!"
    const b64 = toBase64(bytes);
    expect(b64).toBe('aGkh');
    expect(Array.from(fromBase64(` ${b64} `))).toEqual(Array.from(bytes));
  });
});

describe('sha256Hex', () => {
  it('calcula o hash conhecido de "abc" (string)', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('aceita Uint8Array e casa com a versão string', async () => {
    const viaBytes = await sha256Hex(new TextEncoder().encode('abc'));
    expect(viaBytes).toBe(await sha256Hex('abc'));
  });
});

describe('AES-256-GCM', () => {
  it('randomKey gera 32 bytes distintos', () => {
    const a = randomKey();
    const b = randomKey();
    expect(a).toHaveLength(32);
    expect(toHex(a)).not.toBe(toHex(b));
  });

  it('encrypt→decrypt recupera o texto original', async () => {
    const key = randomKey();
    const texto = 'laudo cautelar aprovado · CPF 123.456.789-00';
    const cipher = await encrypt(texto, key);
    expect(cipher.ct).toBeTruthy();
    expect(cipher.iv).toBeTruthy();
    expect(await decrypt(cipher, key)).toBe(texto);
  });

  it('decrypt com a chave errada falha', async () => {
    const cipher = await encrypt('segredo', randomKey());
    await expect(decrypt(cipher, randomKey())).rejects.toBeDefined();
  });
});

describe('Shamir 3-de-5', () => {
  it('splitKey gera 5 shares e 3 reconstroem a chave', async () => {
    const key = randomKey();
    const shares = await splitKey(key);
    expect(shares).toHaveLength(5);
    const recomposta = await combineKey([shares[0], shares[2], shares[4]]);
    expect(toHex(recomposta)).toBe(toHex(key));
  });

  it('combineKey rejeita menos de 3 shares', async () => {
    const shares = await splitKey(randomKey());
    await expect(combineKey([shares[0], shares[1]])).rejects.toThrow(/3/);
  });
});
