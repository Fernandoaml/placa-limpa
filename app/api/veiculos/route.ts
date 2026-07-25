// Índice off-chain vinCommit → asset (base local SQLite). A chain não indexa por atributo,
// então a verificação por vinCommit resolve o asset aqui e só então lê a chain.
// GET: lista (ou ?commit= → { asset }). POST: registra { vinCommit, asset } após o mint.

import { listVeiculos, getAssetByCommit, saveVeiculo } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const commit = new URL(req.url).searchParams.get('commit');
  if (commit) {
    const asset = await getAssetByCommit(commit);
    return asset ? Response.json({ asset }) : Response.json({ error: 'não encontrado' }, { status: 404 });
  }
  return Response.json({ veiculos: await listVeiculos() });
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<{ vinCommit: string; asset: string; nome: string }>;
  if (!body.vinCommit || !body.asset) {
    return Response.json({ error: 'vinCommit e asset são obrigatórios' }, { status: 400 });
  }
  try {
    await saveVeiculo(body.vinCommit, body.asset, body.nome ?? '');
    return Response.json({ ok: true });
  } catch (e) {
    // Vercel: FS read-only → não persiste em produção.
    return Response.json({ error: e instanceof Error ? e.message : 'falha ao gravar' }, { status: 500 });
  }
}
