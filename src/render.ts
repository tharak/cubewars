import type { GameConfig } from './game/config';
import type { GameState, Unit } from './game/types';

const BLUE = '#79e7e0', RED = '#ff797f';

export function render(canvas: HTMLCanvasElement, state: GameState, config: GameConfig): void {
  const context = canvas.getContext('2d')!;
  const width = canvas.clientWidth, height = canvas.clientHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
  }
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  const scale = Math.min((width - 16) / config.arena.width, (height - 16) / config.arena.height);
  if (scale <= 0) return;
  context.translate((width - config.arena.width * scale) / 2, (height - config.arena.height * scale) / 2);
  context.scale(scale, scale);
  context.fillStyle = '#0b1420'; context.fillRect(0, 0, config.arena.width, config.arena.height);
  context.strokeStyle = '#182735'; context.lineWidth = 1 / scale;
  context.strokeRect(0, 0, config.arena.width, config.arena.height);
  context.fillStyle = '#203142';
  for (let x = 30; x < config.arena.width; x += 50) {
    for (let y = 30; y < config.arena.height; y += 50) {
      context.beginPath(); context.arc(x, y, 1, 0, Math.PI * 2); context.fill();
    }
  }
  // Clip off-arena spawns and projectile trails, retaining a small border margin.
  context.save(); context.beginPath(); context.rect(-4, -4, config.arena.width + 8, config.arena.height + 8); context.clip();
  for (const bullet of state.bullets) {
    const friendly = bullet.team === 'player';
    const weapon = friendly ? config.playerWeapon : config.enemyWeapon;
    context.strokeStyle = friendly ? '#79e7e055' : '#ff797f88'; context.lineWidth = weapon.radius * 1.5;
    context.beginPath(); context.moveTo(bullet.x, bullet.y); context.lineTo(bullet.x - bullet.vx * 0.035, bullet.y - bullet.vy * 0.035); context.stroke();
    context.fillStyle = friendly ? BLUE : RED;
    context.beginPath(); context.arc(bullet.x, bullet.y, weapon.radius, 0, Math.PI * 2); context.fill();
  }
  const drawUnit = (unit: Unit, size: number, color: string, health: number) => {
    context.save(); context.translate(unit.x, unit.y); context.rotate(unit.heading);
    context.fillStyle = unit.hit > 0 ? '#ffffff' : color;
    context.shadowColor = color; context.shadowBlur = unit.hit > 0 ? 18 : 5;
    context.fillRect(-size / 2, -size / 2, size, size); context.shadowBlur = 0;
    context.fillStyle = '#08111dcc'; context.fillRect(-size * 0.25, -size * 0.27, size * 0.5, size * 0.19);
    context.strokeStyle = color; context.lineWidth = 2;
    context.beginPath(); context.moveTo(0, -size / 2); context.lineTo(0, -size * 0.9); context.stroke();
    if (unit.health < health) {
      context.fillStyle = '#ffffff88'; context.fillRect(-size / 2, size / 2 + 4, size * Math.max(0, unit.health / health), 2);
    }
    context.restore();
  };
  state.players.forEach(unit => drawUnit(unit, config.army.unitSize, BLUE, config.army.health));
  state.enemies.forEach(unit => drawUnit(unit, config.enemy.unitSize, RED, config.enemy.health));
  if (state.status === 'playing' && state.wave > 0 && state.pendingEnemies === 0 && state.enemies.length === 0) {
    context.strokeStyle = '#79e7e066'; context.lineWidth = 3;
    context.beginPath(); context.arc(state.center.x, state.center.y, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, state.intermission / config.waves.intermission)); context.stroke();
  }
  context.restore();
}
