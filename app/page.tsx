'use client';

import { Card } from '@/components/ui/Card';

const roles = [
  {
    href: '/montadora',
    title: 'Montadora',
    description: 'Emita o registro de origem de um veículo novo.',
  },
  {
    href: '/oficina',
    title: 'Oficina',
    description: 'Registre serviços e atualize o histórico do veículo.',
  },
  {
    href: '/verificar',
    title: 'Verificar',
    description: 'Escolha um veículo e veja o histórico público lido da chain.',
  },
  {
    href: '/cofre',
    title: 'Cofre 3-de-5',
    description: 'Governança multisig das chaves de emissão.',
  },
] as const;

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center bg-[var(--sc-bg)] px-6 py-16 sm:py-24">
      <main className="flex w-full max-w-3xl flex-col items-center gap-10 text-center">
        <div className="flex flex-col items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--sc-primary)]">
            Placa Limpa
          </span>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-[var(--sc-text)] sm:text-5xl">
            Histórico veicular que ninguém consegue apagar
          </h1>
          <p className="max-w-md text-base text-[var(--sc-muted)] sm:text-lg">
            Cada evento é uma transação assinada na Solana — imutável e ordenada. A fraude não é
            bloqueada: fica <span className="text-[var(--sc-alerta)]">registrada para sempre</span>, e o
            app marca em vermelho.
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
          {roles.map((role) => (
            <Card key={role.href} href={role.href} className="text-left">
              <h2 className="text-lg font-medium text-[var(--sc-text)]">
                {role.title}
              </h2>
              <p className="mt-1 text-sm text-[var(--sc-muted)]">
                {role.description}
              </p>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
