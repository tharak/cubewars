import type { GameConfig } from './config';
import { advanceBullets, fire } from './combat';
import { formationSlots } from './formations';
import { approach, clamp, normalize, rotate } from './math';
import type { Commands, GameState, Random } from './types';
import { advanceWaves } from './waves';

export function createGame(config: GameConfig): GameState {
  const center = { x: config.arena.width / 2, y: config.arena.height / 2 };
  return {
    status: 'ready', center, heading: 0, formation: 'square',
    players: formationSlots('square', config.army.initialSize, config.army.spacing).map((p, i) => ({
      ...p, x: p.x + center.x, y: p.y + center.y, id: i + 1, health: config.army.health,
      heading: 0, cooldown: (i % 5) * 0.035, hit: 0,
    })),
    enemies: [], bullets: [], wave: 0, kills: 0, pendingEnemies: 0, spawnTimer: 0,
    intermission: 0, nextId: config.army.initialSize + 1, time: 0,
  };
}

// Mutates explicit state in place for bounded allocation. Never reads browser globals.
export function stepGame(state: GameState, config: GameConfig, commands: Commands, dt: number, random: Random): void {
  if (state.status !== 'playing') return;
  state.time += dt;
  const heading = commands.aim ?? state.heading + commands.rotation * config.army.rotationSpeed * dt;
  state.heading = Math.atan2(Math.sin(heading), Math.cos(heading));
  const local = formationSlots(state.formation, state.players.length, config.army.spacing);
  const slots = local.map(p => rotate(p, state.heading));
  const padding = config.army.unitSize * Math.SQRT2 / 2;
  const minX = Math.min(...slots.map(p => p.x), 0), maxX = Math.max(...slots.map(p => p.x), 0);
  const minY = Math.min(...slots.map(p => p.y), 0), maxY = Math.max(...slots.map(p => p.y), 0);
  const move = normalize(commands.move);
  const oldCenter = { ...state.center };
  state.center.x = clamp(state.center.x + move.x * config.army.moveSpeed * dt, padding - minX, config.arena.width - padding - maxX);
  state.center.y = clamp(state.center.y + move.y * config.army.moveSpeed * dt, padding - minY, config.arena.height - padding - maxY);
  state.players.forEach((unit, i) => {
    // Translate existing positions with the pivot, then independently approach new slots.
    unit.x += state.center.x - oldCenter.x; unit.y += state.center.y - oldCenter.y;
    const next = approach(unit, { x: state.center.x + slots[i].x, y: state.center.y + slots[i].y }, config.army.transitionSpeed * dt);
    unit.x = clamp(next.x, padding, config.arena.width - padding);
    unit.y = clamp(next.y, padding, config.arena.height - padding);
    unit.heading = state.heading; unit.hit = Math.max(0, unit.hit - dt); unit.cooldown -= dt;
    if (unit.cooldown <= 0) fire(state, unit, 'player', config.playerWeapon, config.army.unitSize);
  });
  advanceWaves(state, config, dt, random);
  for (const enemy of state.enemies) {
    const dx = state.center.x - enemy.x, dy = state.center.y - enemy.y;
    enemy.heading = Math.atan2(dx, -dy);
    const distance = Math.hypot(dx, dy);
    const next = approach(enemy, state.center, Math.min(config.enemy.moveSpeed * dt, Math.max(0, distance - config.enemy.attackRange * 0.75)));
    enemy.x = next.x; enemy.y = next.y; enemy.hit = Math.max(0, enemy.hit - dt); enemy.cooldown -= dt;
    if (distance <= config.enemy.attackRange && enemy.cooldown <= 0) {
      // Do not accumulate missed shots while approaching from outside range.
      enemy.cooldown = 0;
      fire(state, enemy, 'enemy', config.enemyWeapon, config.enemy.unitSize);
    }
  }
  advanceBullets(state, config, dt);
  if (state.players.length === 0) state.status = 'over';
}
