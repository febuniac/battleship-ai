import { useEffect, useRef, useState } from 'react';
import { coordKey, coordLabel, isSunk, sameCoord, shipAt, shotAt } from '../engine/board.ts';
import { FLEET, shipSpec } from '../engine/rules.ts';
import type {
  Board as BoardModel,
  Coord,
  IllegalReason,
  LogEntry,
  Player,
} from '../engine/types.ts';
import { battleAnnouncement, shotHeadline } from './announcements.ts';
import { AppHeader } from './components/AppHeader.tsx';
import { Board, type BoardHud } from './components/Board.tsx';
import { ConfirmNewGame } from './components/ConfirmNewGame.tsx';
import type { CellAnimation, CellVariant } from './components/Cell.tsx';
import { GameOverOverlay } from './components/GameOverOverlay.tsx';
import { LiveRegion } from './components/LiveRegion.tsx';
import type { ShipVisual } from './components/ShipLayer.tsx';
import { StatusLine } from './components/StatusLine.tsx';
import { TurnBanner } from './components/TurnBanner.tsx';
import { reasonText } from './messages.ts';
import type { Game } from './useGame.ts';

/**
 * How long a landed shot keeps the board's status bar to itself before the boards go back to
 * narrating the turn. Long enough to read "MISS", short enough that it never delays the AI.
 */
const RESULT_HOLD_MS = 700;

/** Ships the viewer is entitled to see: their own fleet, and enemy hulls the engine reports sunk. */
function visibleShips(board: BoardModel, reveal: 'all' | 'sunkOnly'): readonly ShipVisual[] {
  return board.ships
    .filter((ship) => reveal === 'all' || isSunk(ship))
    .map((ship) => ({
      shipId: ship.id,
      origin: ship.origin,
      orientation: ship.orientation,
      tone: isSunk(ship) ? ('wreck' as const) : ('fleet' as const),
    }));
}

/**
 * What a landed shot says on the board that received it. A hit on an enemy vessel still afloat
 * says only that it hit — the ship is named at the moment it goes down, and not before.
 */
function outcomeHud(entry: LogEntry, prefix: string): BoardHud {
  if (entry.sunkShipId !== undefined) {
    return { tone: 'impact', text: `${shipSpec(entry.sunkShipId).name.toUpperCase()} SUNK` };
  }
  return entry.outcome === 'miss'
    ? { tone: 'neutral', text: `${prefix}MISS` }
    : { tone: 'impact', text: `${prefix}HIT` };
}

/** The most recent shot animates once, on whichever board received it. */
function animationFor(last: LogEntry | undefined, attacker: Player, at: Coord): CellAnimation {
  if (!last || last.player !== attacker || !sameCoord(last.at, at)) return null;
  if (last.sunkShipId) return 'sunk';
  return last.outcome === 'hit' ? 'hit' : 'miss';
}

/** Shown beside a board only once it means something: no zeroes on an untouched fleet. */
function sunkCaption(board: BoardModel): string | undefined {
  const sunk = board.ships.filter(isSunk).length;
  return sunk === 0 ? undefined : `${sunk} of ${FLEET.length} sunk`;
}

export function GameScreen({ game }: { readonly game: Game }) {
  const { state, aiThinking } = game;
  // Tagged with the log length it happened at, so the notice disappears once a shot lands.
  const [rejected, setRejected] = useState<{
    readonly reason: IllegalReason;
    readonly afterShots: number;
  } | null>(null);
  // Purely presentational: the game is untouched until the player confirms.
  const [confirmingNewGame, setConfirmingNewGame] = useState(false);
  // The square under the cursor, so the board can name the shot on offer.
  const [target, setTarget] = useState<Coord | null>(null);
  /*
   * Whether the newest shot is still fresh news. It gives every result a beat of its own on the
   * board that received it, so a miss is read before the AI starts thinking.
   */
  const [spentResult, setSpentResult] = useState<LogEntry | null>(null);
  const newGameRef = useRef<HTMLButtonElement>(null);

  const enemyBoard = state.boards.ai;
  const ownBoard = state.boards.human;
  const playable = state.phase === 'playing' && !aiThinking;
  const last = state.log.at(-1);
  const freshResult = last !== undefined && last !== spentResult;

  useEffect(() => {
    if (last === undefined) return;
    const timer = setTimeout(() => {
      setSpentResult(last);
    }, RESULT_HOLD_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [last]);

  const rejection = rejected?.afterShots === state.log.length ? rejected.reason : null;

  // Only cells of ships the engine reports as sunk may be revealed on the enemy board.
  const sunkEnemyCells = new Set(
    enemyBoard.ships.filter(isSunk).flatMap((ship) => ship.cells.map((cell) => coordKey(cell))),
  );

  const enemyVariant = (at: Coord): CellVariant => {
    const shot = shotAt(enemyBoard, at);
    if (shot === 'miss') return 'miss';
    if (shot === 'hit') return sunkEnemyCells.has(coordKey(at)) ? 'sunk' : 'hit';
    return 'water';
  };

  const ownVariant = (at: Coord): CellVariant => {
    const shot = shotAt(ownBoard, at);
    const ship = shipAt(ownBoard, at);
    if (shot === 'miss') return 'miss';
    if (shot === 'hit') return ship !== undefined && isSunk(ship) ? 'sunk' : 'hit';
    return ship ? 'ship' : 'water';
  };

  const enemyCaption = sunkCaption(enemyBoard);
  const ownCaption = sunkCaption(ownBoard);

  // A shot at the player's own fleet may name the vessel struck; the enemy's stay anonymous.
  const lastHitOwnShip =
    last?.player === 'ai' && last.outcome !== 'miss' ? shipAt(ownBoard, last.at) : undefined;

  // One line of commentary: a rejected shot, otherwise whatever just landed.
  const status = rejection
    ? { tone: 'invalid' as const, text: reasonText(rejection), key: `reject-${state.log.length}` }
    : last
      ? {
          tone: last.outcome === 'miss' ? ('neutral' as const) : ('impact' as const),
          text: shotHeadline(
            last,
            ...(lastHitOwnShip === undefined ? [] : [shipSpec(lastHitOwnShip.id).name]),
          ),
          key: last.seq,
        }
      : { tone: 'neutral' as const, text: 'Battle stations — pick a target', key: 'start' };

  /*
   * Each board narrates itself: the enemy water says what the player can do there and what their
   * own last shot did, the player's water reports what the AI just did to their fleet. A result
   * only stands while it is the newest thing that happened, so the turn returning to the player
   * always brings the instruction back.
   */
  const over = state.phase === 'gameOver';
  // The shot that ends the game keeps its own headline: the vessel it sank is named, then locked.
  const finalHud = (attacker: Player, prefix: string): BoardHud =>
    last?.player === attacker && last.sunkShipId !== undefined
      ? outcomeHud(last, prefix)
      : { tone: 'neutral', text: 'Game over.' };

  /** The invitation to fire, naming the square under the cursor when there is one. */
  const targetHud = (at: Coord | null): BoardHud =>
    at !== null && shotAt(enemyBoard, at) === 'unknown'
      ? { tone: 'valid', text: `Fire at ${coordLabel(at)}` }
      : { tone: 'neutral', text: 'Select where to attack.' };

  const enemyHud: BoardHud = over
    ? finalHud('human', '')
    : rejection
      ? { tone: 'invalid', text: reasonText(rejection) }
      : freshResult && last?.player === 'human'
        ? outcomeHud(last, '')
        : aiThinking
          ? { tone: 'neutral', text: 'AI is thinking…' }
          : targetHud(target);

  const ownHud: BoardHud = over
    ? finalHud('ai', 'AI ')
    : freshResult && last?.player === 'ai'
      ? outcomeHud(last, 'AI ')
      : aiThinking
        ? { tone: 'neutral', text: 'AI is thinking…' }
        : { tone: 'neutral', text: 'The AI fires here.' };

  return (
    <div className="mx-auto flex w-full max-w-[74rem] flex-col gap-8 sm:gap-10">
      <LiveRegion message={battleAnnouncement(state, aiThinking)} />

      <AppHeader>
        <div className="flex items-center gap-4 sm:gap-6">
          <TurnBanner state={state} aiThinking={aiThinking} />
          <button
            ref={newGameRef}
            type="button"
            onClick={() => {
              setConfirmingNewGame(true);
            }}
            className="glass-button min-h-11 rounded-full px-4 text-sm"
          >
            New game
          </button>
        </div>
      </AppHeader>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
        {/* Attack board first: it is where the player acts. */}
        <Board
          label="Enemy waters"
          {...(enemyCaption === undefined ? {} : { caption: enemyCaption })}
          hud={enemyHud}
          side="enemy"
          // Emphasis follows the turn: the water that can be fired at is the one that stands out.
          {...(state.phase === 'playing' ? { emphasis: playable ? 'active' : 'idle' } : {})}
          variantAt={enemyVariant}
          // Only sunk enemy hulls are drawn; an unhit ship is indistinguishable from open water.
          ships={visibleShips(enemyBoard, 'sunkOnly')}
          animationAt={(at) => animationFor(last, 'human', at)}
          onSelect={(at) => {
            const reason = game.fire(at);
            setRejected(reason === null ? null : { reason, afterShots: state.log.length });
          }}
          onHover={setTarget}
          // Keyboard focus should not read as aiming: the cell's own label already says where it is.
          hoverOnFocus={false}
          cellDisabled={(at) => shotAt(enemyBoard, at) !== 'unknown'}
          disabled={!playable}
          // Entering the battle (and returning from a finished game) puts focus on the grid.
          focusKey={game.generation}
        />

        <Board
          label="Your waters"
          {...(ownCaption === undefined ? {} : { caption: ownCaption })}
          hud={ownHud}
          side="friendly"
          {...(state.phase === 'playing' ? { emphasis: aiThinking ? 'active' : 'idle' } : {})}
          variantAt={ownVariant}
          ships={visibleShips(ownBoard, 'all')}
          animationAt={(at) => animationFor(last, 'ai', at)}
        />
      </div>

      <StatusLine tone={status.tone} eventKey={status.key}>
        {status.text}
      </StatusLine>
      <p className="sr-only">Keyboard: arrow keys move across the grid, Enter fires.</p>

      {confirmingNewGame ? (
        <ConfirmNewGame
          onCancel={() => {
            setConfirmingNewGame(false);
            newGameRef.current?.focus();
          }}
          onConfirm={() => {
            setConfirmingNewGame(false);
            game.reset();
          }}
        />
      ) : null}

      {state.phase === 'gameOver' ? (
        <GameOverOverlay state={state} onPlayAgain={() => game.reset()} />
      ) : null}
    </div>
  );
}
