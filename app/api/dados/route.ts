// Ciphertext off-chain do dado sensível — base local SQLite (lib/db). Na chain só vai o hash.
// GET ?hash= : recupera o ciphertext. POST: guarda {hash, asset, ct, iv}. DELETE ?hash= : crypto-shredding.

import { getDado, listDados, saveDado, shredDado } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const hash = new URL(req.url).searchParams.get('hash');
  if (!hash) return Response.json({ dados: await listDados() }); // sem hash: lista para o seletor do cofre
  const dado = await getDado(hash);
  return dado ? Response.json(dado) : Response.json({ error: 'não encontrado' }, { status: 404 });
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<{ hash: string; asset: string; ct: string; iv: string; shares: string[] }>;
  if (!body.hash || !body.asset || !body.ct || !body.iv) {
    return Response.json({ error: 'hash, asset, ct e iv são obrigatórios' }, { status: 400 });
  }
  try {
    await saveDado({ hash: body.hash, asset: body.asset, ct: body.ct, iv: body.iv, shares: body.shares ?? [] });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'falha ao gravar' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const hash = new URL(req.url).searchParams.get('hash');
  if (!hash) return Response.json({ error: 'hash obrigatório' }, { status: 400 });
  try {
    // Destrói o ciphertext; o hash imutável na chain permanece, sem reidentificar ninguém (LGPD art. 18).
    return Response.json({ shredded: await shredDado(hash) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'falha ao apagar' }, { status: 500 });
  }
}
