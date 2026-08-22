import { GameScreen } from './GameScreen.tsx';
import { PlacementScreen } from './PlacementScreen.tsx';
import { useGame, type UseGameOptions } from './useGame.ts';

export function App(options: UseGameOptions = {}) {
  const game = useGame(options);

  return (
    <main className="min-h-dvh px-4 py-6 sm:px-8 sm:py-10 lg:px-12 lg:py-14">
      {game.state.phase === 'placement' ? (
        <PlacementScreen game={game} autoFocusBoard={game.generation > 0} />
      ) : (
        <GameScreen game={game} />
      )}
    </main>
  );
}
