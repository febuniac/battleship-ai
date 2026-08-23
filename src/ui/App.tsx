import { useState } from 'react';
import { GameScreen } from './GameScreen.tsx';
import { PlacementScreen } from './PlacementScreen.tsx';
import { useGame, type UseGameOptions } from './useGame.ts';
import { WelcomeScreen } from './WelcomeScreen.tsx';

export function App(options: UseGameOptions = {}) {
  const game = useGame(options);
  // Purely a view flag: the engine has no notion of a title screen, and Play again resets the
  // game to `placement` without coming back through here.
  const [entered, setEntered] = useState(false);
  /*
   * The two stage introductions are onboarding, not ceremony: each is shown once and stays gone,
   * so a second game — Play again included — starts straight in the interaction.
   */
  const [placementIntroSeen, setPlacementIntroSeen] = useState(false);
  const [battleIntroSeen, setBattleIntroSeen] = useState(false);

  return (
    <main className="min-h-dvh px-4 py-6 sm:px-8 sm:py-10 lg:px-12 lg:py-14">
      {!entered ? (
        <WelcomeScreen
          onStart={() => {
            setEntered(true);
          }}
        />
      ) : game.state.phase === 'placement' ? (
        <PlacementScreen
          game={game}
          autoFocusBoard={game.generation > 0}
          intro={!placementIntroSeen}
          onIntroDismiss={() => {
            setPlacementIntroSeen(true);
          }}
        />
      ) : (
        <GameScreen
          game={game}
          intro={!battleIntroSeen}
          onIntroDismiss={() => {
            setBattleIntroSeen(true);
          }}
        />
      )}
    </main>
  );
}
