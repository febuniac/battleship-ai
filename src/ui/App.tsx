import { BOARD_SIZE, FLEET } from '../engine/rules.ts';

/**
 * Placeholder shell. The playable UI lands in the next milestone; this milestone
 * covers the engine, the AI and their test suites.
 */
export function App() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-slate-900 p-8 text-slate-100">
      <h1 className="text-3xl font-semibold">Battleship</h1>
      <p className="text-slate-400">
        {BOARD_SIZE}×{BOARD_SIZE} board · {FLEET.length} ships · engine and AI ready
      </p>
    </main>
  );
}
