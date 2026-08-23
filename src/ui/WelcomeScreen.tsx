import { useRef, useState } from 'react';
import { RulesDialog } from './components/RulesDialog.tsx';
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
  const [rulesOpen, setRulesOpen] = useState(false);
  const rulesTriggerRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="mx-auto flex min-h-[80dvh] w-full max-w-[36rem] flex-col items-center justify-center gap-9 text-center sm:gap-10">
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

      {/*
       * The three questions a first-time player has — what do I do, how do I win, how do turns
       * work — answered in three lines. The complete rules stay behind THE RULES.
       */}
      <div className="glass flex w-full max-w-[24rem] flex-col items-center gap-2 rounded-2xl px-6 py-5 sm:px-8 sm:py-6">
        <h2 className="text-[0.6rem] font-medium tracking-[0.22em] text-ink-faint uppercase">
          How to play
        </h2>
        <p className="text-[0.82rem] leading-relaxed text-balance text-ink-soft">
          Place your fleet. Take turns firing at the enemy. Hit all five ships to win.
        </p>
        <p className="text-[0.7rem] tracking-[0.04em] text-ink-faint">
          Hit = fire again · Miss = turn changes
        </p>
      </div>

      <div className="flex flex-col items-center gap-5">
        <button
          type="button"
          onClick={onStart}
          className="min-h-11 rounded-full bg-ink px-9 text-sm font-medium text-paper transition-[background-color,transform] hover:-translate-y-px hover:bg-ink/90"
        >
          Start game
        </button>
        <button
          ref={rulesTriggerRef}
          type="button"
          onClick={() => {
            setRulesOpen(true);
          }}
          className="min-h-11 px-3 text-[0.65rem] tracking-[0.2em] text-ink-faint uppercase transition-colors hover:text-ink-soft"
        >
          The rules
        </button>
      </div>

      {rulesOpen ? (
        <RulesDialog
          onClose={() => {
            setRulesOpen(false);
            rulesTriggerRef.current?.focus();
          }}
        />
      ) : null}
    </div>
  );
}
