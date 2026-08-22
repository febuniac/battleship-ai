import type { LogEntry } from '../../engine/types.ts';
import { describeShot } from '../announcements.ts';

export interface StatusLogProps {
  readonly entries: readonly LogEntry[];
}

export function StatusLog({ entries }: StatusLogProps) {
  const recent = [...entries].reverse();

  return (
    <section aria-label="Shot log" className="flex min-h-0 flex-col gap-1.5">
      <h3 className="text-xs font-semibold tracking-[0.08em] text-slate-400 uppercase">Log</h3>
      {recent.length === 0 ? (
        <p className="text-xs text-slate-500">No shots fired yet.</p>
      ) : (
        <ol className="max-h-44 overflow-y-auto text-xs text-slate-300 lg:max-h-72">
          {recent.map((entry) => (
            <li
              key={entry.seq}
              className={`animate-fade-in border-l-2 py-1 pl-2 ${
                entry.player === 'human' ? 'border-sky-500/70' : 'border-rose-500/70'
              } ${entry.sunkShipId ? 'font-medium text-slate-100' : ''}`}
            >
              {describeShot(entry)}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
