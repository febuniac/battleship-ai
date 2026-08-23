/** Zero-based board coordinate: `r` = row (top to bottom), `c` = column (left to right). */
export interface Coord {
  readonly r: number;
  readonly c: number;
}

export type Orientation = 'horizontal' | 'vertical';

export type ShipId = 'carrier' | 'battleship' | 'cruiser' | 'submarine' | 'destroyer';

export interface ShipSpec {
  readonly id: ShipId;
  readonly name: string;
  readonly size: number;
}

export interface Ship {
  readonly id: ShipId;
  readonly size: number;
  readonly origin: Coord;
  readonly orientation: Orientation;
  /** Every cell the ship occupies, ordered from `origin`. */
  readonly cells: readonly Coord[];
  /** Number of distinct cells hit. `hits === size` means sunk. */
  readonly hits: number;
}

/** What the *attacker* knows about a cell. Ship positions are held separately. */
export type CellState = 'unknown' | 'miss' | 'hit';

export interface Board {
  readonly ships: readonly Ship[];
  /** `shots[r][c]`: the attacker's knowledge of the defender's board. */
  readonly shots: readonly (readonly CellState[])[];
}

export type Player = 'human' | 'ai';

export type Phase = 'placement' | 'playing' | 'gameOver';

export type ShotOutcome = 'miss' | 'hit' | 'sunk';

export interface LogEntry {
  /** Monotonic index, useful as a stable React key. */
  readonly seq: number;
  /** Who fired the shot. */
  readonly player: Player;
  readonly at: Coord;
  readonly outcome: ShotOutcome;
  /** Set when the shot sank a ship. */
  readonly sunkShipId?: ShipId;
  /** Set when the shot ended the game. */
  readonly wonGame?: true;
}

export interface PlayerStats {
  readonly shots: number;
  readonly hits: number;
  /** Ships of *this* player that the opponent has sunk. */
  readonly lostShipIds: readonly ShipId[];
}

export interface GameState {
  readonly phase: Phase;
  readonly turn: Player;
  /** `boards[p]` is player `p`'s own fleet plus the shots fired *at* it. */
  readonly boards: Readonly<Record<Player, Board>>;
  readonly winner: Player | null;
  readonly log: readonly LogEntry[];
  readonly stats: Readonly<Record<Player, PlayerStats>>;
  /** Seeded PRNG state; advanced whenever the engine consumes randomness. */
  readonly rng: number;
}

export type Action =
  | {
      readonly type: 'PLACE_SHIP';
      readonly shipId: ShipId;
      readonly origin: Coord;
      readonly orientation: Orientation;
    }
  | { readonly type: 'REMOVE_SHIP'; readonly shipId: ShipId }
  | { readonly type: 'RANDOMIZE_FLEET' }
  | { readonly type: 'CLEAR_FLEET' }
  | { readonly type: 'START_GAME' }
  | { readonly type: 'FIRE'; readonly player: Player; readonly at: Coord }
  | { readonly type: 'RESET' };

export type IllegalReason =
  | 'OUT_OF_BOUNDS'
  | 'OVERLAP'
  | 'SHIP_ALREADY_PLACED'
  | 'SHIP_NOT_PLACED'
  | 'FLEET_INCOMPLETE'
  | 'ALREADY_FIRED'
  | 'NOT_YOUR_TURN'
  | 'WRONG_PHASE';

/**
 * Result of `applyAction`. Illegal actions are reported, never thrown: the UI renders
 * `reason` as player feedback and tests assert on it, so both share one code path.
 */
export type ActionResult =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly reason: IllegalReason };
