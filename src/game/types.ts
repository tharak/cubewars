export interface Vec { x: number; y: number }
export type Formation = 'square' | 'line' | 'column' | 'arrow';
export type Status = 'ready' | 'playing' | 'paused' | 'over';
export type Team = 'player' | 'enemy';
export interface Unit extends Vec { id: number; health: number; heading: number; cooldown: number; hit: number }
export interface PlayerUnit extends Unit { slot: Vec }
export interface Bullet extends Vec { id: number; vx: number; vy: number; life: number; team: Team }
export interface GameState {
  status: Status;
  center: Vec;
  heading: number;
  formation: Formation;
  players: PlayerUnit[];
  enemies: Unit[];
  bullets: Bullet[];
  wave: number;
  kills: number;
  pendingEnemies: number;
  spawnTimer: number;
  intermission: number;
  nextId: number;
  time: number;
}
// Keyboard movement is relative to army heading; the touch stick uses screen directions.
export interface Commands { move: Vec; worldMove: Vec; rotation: number; aim: number | null }
export type Random = () => number;
