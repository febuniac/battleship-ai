import { ShipSprite } from './components/ShipSprite.tsx';

/**
 * Three of the fleet's own models sailing in loose line ahead. Widths are a share of the row, so
 * they stay to scale with each other and shrink with the viewport instead of overflowing it.
 */
const FLOTILLA = [
  { shipId: 'carrier', width: '43%', offset: '0rem' },
  { shipId: 'cruiser', width: '26%', offset: '1.6rem' },
  { shipId: 'destroyer', width: '17%', offset: '0.5rem' },
] as const;

/**
 * The first thing a visitor sees: the title, the matchup, one line of rules, one action. The
 * decorative flotilla uses the same `ShipSprite` models that appear on the water, so the opening
 * screen and the game are the same object seen from further away.
 */
export function WelcomeScreen({ onStart }: { readonly onStart: () => void }) {
  return (
    <div className="mx-auto flex min-h-[80dvh] w-full max-w-[36rem] flex-col items-center justify-center gap-10 text-center sm:gap-12">
      <div className="animate-fade-in flex flex-col items-center gap-5">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-2xl font-light tracking-[0.4em] text-ink uppercase sm:text-4xl">
            Battleship
          </h1>
          <p className="text-[0.68rem] tracking-[0.24em] text-ink-faint uppercase sm:text-xs">
            Human vs AI
          </p>
        </div>
        <p className="max-w-[26rem] text-sm leading-relaxed text-balance text-ink-soft sm:text-base">
          Sink the enemy fleet before they sink yours.
        </p>
      </div>

      <div
        aria-hidden
        className="flex w-full max-w-[30rem] items-end justify-center gap-[4%] opacity-70"
      >
        {FLOTILLA.map(({ shipId, width, offset }) => (
          <ShipSprite
            key={shipId}
            shipId={shipId}
            className="h-9 shrink-0 sm:h-12"
            style={{ width, marginBottom: offset }}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={onStart}
        className="min-h-11 rounded-full bg-ink px-9 text-sm font-medium text-paper transition-[background-color,transform] hover:-translate-y-px hover:bg-ink/90"
      >
        Start game
      </button>
    </div>
  );
}
