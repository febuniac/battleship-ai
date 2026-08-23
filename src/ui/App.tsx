import { GameScreen } from './GameScreen.tsx';
import { PlacementScreen } from './PlacementScreen.tsx';
import { useGame, type UseGameOptions } from './useGame.ts';

export function App(options: UseGameOptions = {}) {
  const game = useGame(options);

  return (
    <main className="min-h-dvh px-3 py-5 sm:px-6 sm:py-8 lg:py-10">
      {game.state.phase === 'placement' ? (
        <PlacementScreen game={game} autoFocusBoard={game.generation > 0} />
      ) : (
        <GameScreen game={game} />
      )}
    </main>
  );
}
