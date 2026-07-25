// Registro off-chain de emissores credenciados (CNPJ, escopo) — base local SQLite (lib/db).
// GET: lista. POST: cadastra/atualiza. Em produção (Vercel) o GET lê o .db semeado; POST não persiste.

import { listEmissores, upsertEmissor } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  return Response.json({ emissores: await listEmissores() });
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<{ pubkey: string; cnpj: string; nome: string; escopo: string }>;
  if (!body.pubkey || !body.cnpj || !body.nome || !body.escopo) {
    return Response.json({ error: 'pubkey, cnpj, nome e escopo são obrigatórios' }, { status: 400 });
  }
  try {
    await upsertEmissor({ pubkey: body.pubkey, cnpj: body.cnpj, nome: body.nome, escopo: body.escopo });
    return Response.json({ ok: true });
  } catch (e) {
    // Vercel: FS read-only → escrita não persiste.
    return Response.json({ error: e instanceof Error ? e.message : 'falha ao gravar' }, { status: 500 });
  }
}
