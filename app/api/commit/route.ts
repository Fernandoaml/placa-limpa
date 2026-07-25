// Converte chassis (VIN) em commit SHA256 usando pepper server-side
// Garante que o commit não seja reversível ao VIN; pepper é segredo exclusivo do servidor.

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { chassi } = body;

    if (!chassi || typeof chassi !== 'string' || !chassi.trim()) {
      return Response.json({ error: 'chassi obrigatório' }, { status: 400 });
    }

    const pepper = process.env.VIN_PEPPER ?? '';
    const input = chassi.trim() + pepper;

    // SHA-256 usando Web Crypto do Node.js
    const buffer = await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(input) as BufferSource
    );

    // Converte buffer para hexadecimal
    const commit = Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return Response.json({ commit });
  } catch (error) {
    console.error('Erro ao processar commit:', error);
    return Response.json({ error: 'Erro interno' }, { status: 500 });
  }
}
