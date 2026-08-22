import { coordLabel } from '../../engine/board.ts';
import { shipSpec } from '../../engine/rules.ts';
import type { LogEntry } from '../../engine/types.ts';

export interface StatusLogProps {
  readonly entries: readonly LogEntry[];
}

function describe(entry: LogEntry): string {
  const who = entry.player === 'human' ? 'You' : 'AI';
  const target = coordLabel(entry.at);
  if (entry.sunkShipId) {
    const name = shipSpec(entry.sunkShipId).name;
    return `${who} sank the ${entry.player === 'human' ? 'enemy ' : ''}${name} at ${target}`;
  }
  return `${who} ${entry.outcome === 'hit' ? 'hit' : 'missed'} at ${target}`;
}

export function StatusLog({ entries }: StatusLogProps) {
  const recent = [...entries].reverse();

  return (
    <section aria-label="Shot log" className="flex min-h-0 flex-col gap-1">
      <h3 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Log</h3>
      {recent.length === 0 ? (
        <p className="text-xs text-slate-500">No shots fired yet.</p>
      ) : (
        <ol className="max-h-48 overflow-y-auto text-xs text-slate-300 lg:max-h-64">
          {recent.map((entry) => (
            <li
              key={entry.seq}
              className={`border-l-2 py-0.5 pl-2 ${
                entry.player === 'human' ? 'border-sky-500/70' : 'border-rose-500/70'
              }`}
            >
              {describe(entry)}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
