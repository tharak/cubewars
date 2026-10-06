import { formations, formationSlots } from './formations';

export interface WeaponConfig { damage: number; interval: number; speed: number; lifetime: number; radius: number }
export interface GameConfig {
  army: { initialSize: number; spacing: number; unitSize: number; health: number; moveSpeed: number; rotationSpeed: number; formationRotationSpeed: number; transitionSpeed: number };
  arena: { width: number; height: number };
  playerWeapon: WeaponConfig;
  enemy: { health: number; unitSize: number; moveSpeed: number; attackRange: number; spawnMargin: number };
  enemyWeapon: WeaponConfig;
  waves: { initialEnemies: number; additionalPerWave: number; spawnInterval: number; intermission: number };
  simulation: { step: number; maxFrameTime: number };
  input: { stickDeadzone: number };
}

const fields: Record<keyof GameConfig, string[]> = {
  army: ['initialSize', 'spacing', 'unitSize', 'health', 'moveSpeed', 'rotationSpeed', 'formationRotationSpeed', 'transitionSpeed'],
  arena: ['width', 'height'],
  playerWeapon: ['damage', 'interval', 'speed', 'lifetime', 'radius'],
  enemy: ['health', 'unitSize', 'moveSpeed', 'attackRange', 'spawnMargin'],
  enemyWeapon: ['damage', 'interval', 'speed', 'lifetime', 'radius'],
  waves: ['initialEnemies', 'additionalPerWave', 'spawnInterval', 'intermission'],
  simulation: ['step', 'maxFrameTime'],
  input: ['stickDeadzone'],
};

export function validateConfig(value: unknown): GameConfig {
  if (!value || typeof value !== 'object') throw new Error('Game config must be an object');
  const root = value as Record<string, unknown>;
  for (const [group, keys] of Object.entries(fields)) {
    const section = root[group];
    if (!section || typeof section !== 'object') throw new Error(`Missing config section: ${group}`);
    for (const key of keys) {
      const n = (section as Record<string, unknown>)[key];
      const allowZero = key === 'additionalPerWave' || key === 'stickDeadzone';
      if (typeof n !== 'number' || !Number.isFinite(n) || (allowZero ? n < 0 : n <= 0)) {
        throw new Error(`Invalid config: ${group}.${key}`);
      }
    }
  }
  const c = value as GameConfig;
  for (const n of [c.army.initialSize, c.waves.initialEnemies, c.waves.additionalPerWave]) {
    if (!Number.isInteger(n)) throw new Error('Army and wave counts must be integers');
  }
  if (c.army.initialSize > 200) throw new Error('Army size must be at most 200');
  if (c.army.spacing < c.army.unitSize) throw new Error('Army spacing must be at least unit size');
  let radius = 0;
  for (const shape of formations) for (let count = 1; count <= c.army.initialSize; count++) {
    for (const slot of formationSlots(shape, count, c.army.spacing)) radius = Math.max(radius, Math.hypot(slot.x, slot.y));
  }
  if (Math.min(c.arena.width, c.arena.height) <= radius * 2 + Math.SQRT2 * c.army.unitSize) {
    throw new Error('Arena must fit the largest rotated formation');
  }
  if (c.input.stickDeadzone >= 1) throw new Error('Stick deadzone must be less than 1');
  if (c.simulation.step > 1 / 30 || c.simulation.maxFrameTime < c.simulation.step || c.simulation.maxFrameTime > 0.25) {
    throw new Error('Simulation timing must allow a stable timestep and bounded frame catch-up');
  }
  return c;
}
