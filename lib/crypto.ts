// Dado sensível: AES-256-GCM off-chain + chave em Shamir 3-de-5 (raw/placa-limpa-plano.md §4).
// Na chain só entra sha256(payload). Lógica pura, sem React — testável isolada.
//
// Honestidades registradas no plano:
//  1. Na reconstrução, K existe inteira num ponto (Lit Protocol resolveria; fora do MVP).
//  2. 3-de-5 protege confidencialidade, não veracidade (garbage-in).
// Crypto-shredding: destruir a chave/shares mata o dado mesmo com o hash imutável (art. 18 LGPD).

import { split, combine } from 'shamir-secret-sharing';

const subtle = globalThis.crypto.subtle;

/** Garante um buffer ArrayBuffer (não Shared) para o Web Crypto — evita o estreitamento do TS 5.x. */
function ab(u: Uint8Array): BufferSource {
  return new Uint8Array(u);
}

// ---- codecs (sem Buffer; funciona no browser e no Node) --------------------

export function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

export function fromHex(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase();
  if (clean.length % 2 !== 0) throw new Error('hex inválido: comprimento ímpar');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64.trim());
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---- hash on-chain ---------------------------------------------------------

/** sha256(data) em hex — é o que vai no memo (nunca o payload cru). */
export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const digest = await subtle.digest('SHA-256', ab(bytes));
  return toHex(new Uint8Array(digest));
}

// ---- AES-256-GCM -----------------------------------------------------------

export interface Cipher {
  /** ciphertext (inclui a tag GCM) em base64 */
  ct: string;
  /** IV de 12 bytes em base64 */
  iv: string;
}

/** Gera uma chave K aleatória de 256 bits, por veículo. */
export function randomKey(): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(32));
}

async function importKey(key: Uint8Array): Promise<CryptoKey> {
  return subtle.importKey('raw', ab(key), 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encrypt(plaintext: string, key: Uint8Array): Promise<Cipher> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ck = await importKey(key);
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv: ab(iv) }, ck, ab(new TextEncoder().encode(plaintext)));
  return { ct: toBase64(new Uint8Array(ct)), iv: toBase64(iv) };
}

export async function decrypt(cipher: Cipher, key: Uint8Array): Promise<string> {
  const ck = await importKey(key);
  const pt = await subtle.decrypt(
    { name: 'AES-GCM', iv: ab(fromBase64(cipher.iv)) },
    ck,
    ab(fromBase64(cipher.ct)),
  );
  return new TextDecoder().decode(pt);
}

// ---- Shamir 3-de-5 ---------------------------------------------------------

/** Divide K em 5 shares; quaisquer 3 reconstroem. */
export async function splitKey(key: Uint8Array): Promise<Uint8Array[]> {
  return split(key, 5, 3);
}

/** Reconstrói K a partir de >= 3 shares. */
export async function combineKey(shares: Uint8Array[]): Promise<Uint8Array> {
  if (shares.length < 3) throw new Error('São necessárias ao menos 3 das 5 chaves');
  return combine(shares);
}
