import type { GameConfig, WeaponConfig } from './config';
import { segmentHit } from './math';
import type { GameState, Team, Unit } from './types';

export function fire(state: GameState, unit: Unit, team: Team, weapon: WeaponConfig, size: number): void {
  const dx = Math.sin(unit.heading), dy = -Math.cos(unit.heading);
  state.bullets.push({ id: state.nextId++, x: unit.x + dx * size * 0.7, y: unit.y + dy * size * 0.7,
    vx: dx * weapon.speed, vy: dy * weapon.speed, life: weapon.lifetime, team });
  unit.cooldown += weapon.interval;
}

export function advanceBullets(state: GameState, config: GameConfig, dt: number): void {
  state.bullets = state.bullets.filter(bullet => {
    const weapon = bullet.team === 'player' ? config.playerWeapon : config.enemyWeapon;
    const targets = bullet.team === 'player' ? state.enemies : state.players;
    const size = bullet.team === 'player' ? config.enemy.unitSize : config.army.unitSize;
    const aliveTime = Math.min(dt, bullet.life);
    const end = { x: bullet.x + bullet.vx * aliveTime, y: bullet.y + bullet.vy * aliveTime };
    let first: Unit | null = null, firstTime = Infinity;
    for (const target of targets) {
      if (target.health <= 0) continue;
      const t = segmentHit(bullet, end, target, size * 0.55 + weapon.radius);
      if (t !== null && t < firstTime) { first = target; firstTime = t; }
    }
    if (first) { first.health -= weapon.damage; first.hit = 0.12; return false; }
    bullet.x = end.x; bullet.y = end.y; bullet.life -= dt;
    return bullet.life > 0;
  });
  state.kills += state.enemies.filter(e => e.health <= 0).length;
  state.players = state.players.filter(p => p.health > 0);
  state.enemies = state.enemies.filter(e => e.health > 0);
}
