import type { GameConfig } from './config';
import type { GameState, Random } from './types';

export function advanceWaves(state: GameState, config: GameConfig, dt: number, random: Random): void {
  if (state.pendingEnemies === 0 && state.enemies.length === 0) {
    state.intermission -= dt;
    if (state.intermission > 0) return;
    state.wave++;
    state.pendingEnemies = config.waves.initialEnemies + (state.wave - 1) * config.waves.additionalPerWave;
    state.spawnTimer = 0;
    state.intermission = config.waves.intermission;
  }
  state.spawnTimer -= dt;
  if (state.pendingEnemies > 0 && state.spawnTimer <= 0) {
    const { width, height } = config.arena, margin = config.enemy.spawnMargin;
    const edge = Math.floor(random() * 4), along = random();
    const x = edge === 0 ? -margin : edge === 1 ? width + margin : along * width;
    const y = edge === 2 ? -margin : edge === 3 ? height + margin : along * height;
    state.enemies.push({ id: state.nextId++, x, y, health: config.enemy.health,
      heading: 0, cooldown: random() * config.enemyWeapon.interval, hit: 0 });
    state.pendingEnemies--;
    state.spawnTimer += config.waves.spawnInterval;
  }
}
