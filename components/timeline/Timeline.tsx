// Timeline vertical do histórico do veículo — mais recente no topo (o que aconteceu por
// último é o que mais importa para quem está verificando). `events` chega em ordem
// cronológica (mais antigo primeiro, contrato de lib/vehicle.ts::listEvents); invertemos aqui.

import type { IntegrityResult, VehicleEvent } from '@/lib/types';
import { EventCard } from './EventCard';

export interface TimelineProps {
  events: VehicleEvent[];
  integrity: IntegrityResult;
}

export function Timeline({ events, integrity }: TimelineProps) {
  const issueByIndex = new Map(integrity.issues.map((issue) => [issue.index, issue]));

  const ordered = events
    .map((event, index) => ({ event, index }))
    .slice()
    .reverse(); // mais recente no topo

  return (
    <ol className="flex flex-col gap-3">
      {ordered.map(({ event, index }) => {
        const issue = issueByIndex.get(index);
        return (
          <li key={event.sig ?? `${index}-${event.kind}-${event.km}`}>
            <EventCard event={event} flagged={Boolean(issue)} issueMessage={issue?.message} />
          </li>
        );
      })}
    </ol>
  );
}
