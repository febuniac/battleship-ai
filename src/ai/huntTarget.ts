import { coordKey, inBounds } from '../engine/board.ts';
import type { Rng } from '../engine/rng.ts';
import type { Coord } from '../engine/types.ts';
import { sunkCellKeys, viewCell, type PlayerView } from '../engine/view.ts';
import type { AIPlayer } from './types.ts';

/**
 * Hunt/Target with parity - the classic strong-but-human Battleship heuristic.
 *
 * Hunt: fire at random cells on the `(r + c) % 2 === 0` lattice. The smallest ship covers
 * two cells, so every ship must touch that lattice - searching half the board loses nothing.
 *
 * Target: an unresolved hit (a hit not yet explained by a sunk ship) is chased down. One
 * hit means firing at its orthogonal neighbours; two or more collinear hits lock the axis
 * and the shots extend that line until the ship sinks or the line dead-ends.
 *
 * The strategy is *stateless*: the target queue is recomputed from the view on every call
 * rather than remembered. That keeps it trivially testable from a board fixture and immune
 * to the extra-turn rule, where several shots resolve inside a single turn.
 */

const NEIGHBOUR_OFFSETS: readonly Coord[] = [
  { r: -1, c: 0 },
  { r: 1, c: 0 },
  { r: 0, c: -1 },
  { r: 0, c: 1 },
];

function neighbours(coord: Coord): Coord[] {
  return NEIGHBOUR_OFFSETS.map((offset) => ({
    r: coord.r + offset.r,
    c: coord.c + offset.c,
  })).filter(inBounds);
}

function cellsWithState(view: PlayerView, state: 'unknown' | 'hit' | 'miss'): Coord[] {
  const cells: Coord[] = [];
  for (let r = 0; r < view.size; r += 1) {
    for (let c = 0; c < view.size; c += 1) {
      if (viewCell(view, { r, c }) === state) cells.push({ r, c });
    }
  }
  return cells;
}

/** Hits that no sunk ship accounts for: there is still a live ship under them. */
export function unresolvedHits(view: PlayerView): Coord[] {
  const sunk = sunkCellKeys(view);
  return cellsWithState(view, 'hit').filter((cell) => !sunk.has(coordKey(cell)));
}

/** Group unresolved hits into orthogonally connected clusters. */
function clusterHits(hits: readonly Coord[]): Coord[][] {
  const remaining = new Map(hits.map((hit) => [coordKey(hit), hit]));
  const clusters: Coord[][] = [];

  for (const [key, start] of remaining) {
    if (!remaining.has(key)) continue;
    const cluster: Coord[] = [];
    const queue: Coord[] = [start];
    remaining.delete(key);

    while (queue.length > 0) {
      const current = queue.pop() as Coord;
      cluster.push(current);
      for (const neighbour of neighbours(current)) {
        const neighbourKey = coordKey(neighbour);
        if (remaining.has(neighbourKey)) {
          queue.push(remaining.get(neighbourKey) as Coord);
          remaining.delete(neighbourKey);
        }
      }
    }
    clusters.push(cluster);
  }

  return clusters;
}

/** Cells that extend a known ship line at either end. */
function lineExtensions(cluster: readonly Coord[]): Coord[] {
  const rows = new Set(cluster.map((cell) => cell.r));
  const cols = new Set(cluster.map((cell) => cell.c));

  if (rows.size === 1 && cols.size > 1) {
    const r = cluster[0]?.r ?? 0;
    const sorted = [...cols].sort((a, b) => a - b);
    return [
      { r, c: (sorted[0] as number) - 1 },
      { r, c: (sorted[sorted.length - 1] as number) + 1 },
    ];
  }
  if (cols.size === 1 && rows.size > 1) {
    const c = cluster[0]?.c ?? 0;
    const sorted = [...rows].sort((a, b) => a - b);
    return [
      { r: (sorted[0] as number) - 1, c },
      { r: (sorted[sorted.length - 1] as number) + 1, c },
    ];
  }
  // An L-shaped cluster means two touching ships; fall back to probing every neighbour.
  return cluster.flatMap(neighbours);
}

/**
 * Cells worth firing at while a hit is unresolved, best first: extending a known ship line
 * beats probing around a lone hit.
 */
export function targetCandidates(view: PlayerView): Coord[] {
  const clusters = clusterHits(unresolvedHits(view));
  const isOpen = (cell: Coord) => inBounds(cell) && viewCell(view, cell) === 'unknown';

  const lineCandidates = clusters
    .filter((cluster) => cluster.length > 1)
    .flatMap(lineExtensions)
    .filter(isOpen);
  if (lineCandidates.length > 0) return lineCandidates;

  return clusters
    .filter((cluster) => cluster.length === 1)
    .flatMap((cluster) => neighbours(cluster[0] as Coord))
    .filter(isOpen);
}

/** Unshot cells on the parity lattice, or any unshot cell once the lattice is exhausted. */
export function huntCandidates(view: PlayerView): Coord[] {
  const unknown = cellsWithState(view, 'unknown');
  const parity = unknown.filter((cell) => (cell.r + cell.c) % 2 === 0);
  return parity.length > 0 ? parity : unknown;
}

export function createHuntTargetAI(): AIPlayer {
  return {
    id: 'huntTarget',
    name: 'Hunt & Target',
    description: 'Searches on a parity lattice, then chases every hit until the ship sinks.',
    nextShot(view: PlayerView, rng: Rng): Coord {
      const targets = targetCandidates(view);
      const candidates = targets.length > 0 ? targets : huntCandidates(view);
      if (candidates.length === 0) throw new Error('No cell left to fire at');
      return rng.pick(candidates);
    },
  };
}
