import { coordLabel } from '../engine/board.ts';
import { shipSpec } from '../engine/rules.ts';
import type { GameState, LogEntry } from '../engine/types.ts';

/** One shot, in words. Shared by the visible log and the live region so they never disagree. */
export function describeShot(entry: LogEntry): string {
  const who = entry.player === 'human' ? 'You' : 'AI';
  const target = coordLabel(entry.at);

  if (entry.sunkShipId) {
    const name = shipSpec(entry.sunkShipId).name;
    return entry.player === 'human'
      ? `You sank the enemy ${name} at ${target}`
      : `AI sank your ${name} at ${target}`;
  }

  return `${who} ${entry.outcome === 'hit' ? 'hit' : 'missed'} at ${target}`;
}

/**
 * The same shot as a compact visible headline: the outcome first, because that is what the player
 * is looking for. A plain hit names only the square — which enemy ship was struck stays hidden
 * until it sinks. A shot at the player's own fleet may name the vessel, since they can see it.
 */
export function shotHeadline(entry: LogEntry, hitShipName?: string): string {
  const who = entry.player === 'human' ? '' : 'AI ';
  const detail =
    entry.sunkShipId !== undefined
      ? shipSpec(entry.sunkShipId).name
      : (hitShipName ?? coordLabel(entry.at));

  if (entry.sunkShipId !== undefined) return `${who}SUNK · ${detail}`;
  return `${who}${entry.outcome === 'miss' ? 'MISS' : 'HIT'} · ${detail}`;
}

/**
 * What the live region should say for the current state. It is *derived* rather than pushed, so
 * a re-render with unchanged state produces identical text and nothing is announced twice.
 */
export function battleAnnouncement(state: GameState, aiThinking: boolean): string {
  if (state.phase === 'gameOver') {
    return state.winner === 'human'
      ? 'Game over. You win: the enemy fleet is sunk.'
      : 'Game over. The AI wins: your fleet is sunk.';
  }

  const last = state.log.at(-1);
  const turn = aiThinking ? 'AI is thinking.' : 'Your turn.';

  return last ? `${describeShot(last)}. ${turn}` : `Battle started. ${turn}`;
}
