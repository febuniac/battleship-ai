import { GameScreen } from './GameScreen.tsx';
import { PlacementScreen } from './PlacementScreen.tsx';
import { useGame, type UseGameOptions } from './useGame.ts';

export function App(options: UseGameOptions = {}) {
  const game = useGame(options);

  return (
    <main className="min-h-dvh bg-slate-900 px-4 py-6 text-slate-100 sm:px-6 sm:py-10">
      {game.state.phase === 'placement' ? (
        <PlacementScreen game={game} />
      ) : (
        <GameScreen game={game} />
      )}
    </main>
  );
}
