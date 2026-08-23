import { Cell, type CellVariant } from './Cell.tsx';

const ENTRIES: readonly { readonly variant: CellVariant; readonly label: string }[] = [
  { variant: 'water', label: 'Unknown' },
  { variant: 'miss', label: 'Miss' },
  { variant: 'hit', label: 'Hit' },
  { variant: 'sunk', label: 'Sunk' },
];

/** Names the shapes used on the boards, so the states are learnable without relying on colour. */
export function Legend() {
  return (
    <ul aria-label="Board legend" className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {ENTRIES.map(({ variant, label }) => (
        <li key={variant} className="flex items-center gap-1.5 text-xs text-slate-400">
          <span aria-hidden className="w-5">
            <Cell at={{ r: 0, c: 0 }} variant={variant} />
          </span>
          {label}
        </li>
      ))}
    </ul>
  );
}
