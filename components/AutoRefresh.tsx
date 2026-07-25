'use client';

// Recarrega a página após N segundos. Usado no /v quando o veículo está indexado (existe no
// banco) mas a chain ainda não propagou o mint recém-emitido — a página se atualiza sozinha
// até o RPC enxergar o asset, em vez de deixar o usuário num "não encontrado" enganoso.

import { useEffect } from 'react';

export function AutoRefresh({ seconds = 5 }: { seconds?: number }) {
  useEffect(() => {
    const t = setTimeout(() => window.location.reload(), seconds * 1000);
    return () => clearTimeout(t);
  }, [seconds]);
  return null;
}
