import assert from 'node:assert/strict';
import { test } from 'node:test';
import defaults from '../public/config/game.json';
import { validateConfig } from '../src/game/config';
import { advanceBullets } from '../src/game/combat';
import { formationSlots, formations, setFormation } from '../src/game/formations';
import { rotate, seededRandom, segmentHit } from '../src/game/math';
import { createGame, stepGame } from '../src/game/simulation';
import { advanceWaves } from '../src/game/waves';
import type { Commands, PlayerUnit, Unit } from '../src/game/types';

const config = validateConfig(defaults);
const idle: Commands = { move: { x: 0, y: 0 }, worldMove: { x: 0, y: 0 }, rotation: 0, aim: null };
const unit = (id: number, x: number, y: number, health = 3): Unit => ({ id, x, y, health, heading: 0, cooldown: 0, hit: 0 });
const player = (id: number, x: number, y: number): PlayerUnit => ({ ...unit(id, x, y), slot: { x: 0, y: 0 } });

test('configuration rejects missing, non-finite, fractional, and unsafe settings', () => {
  assert.throws(() => validateConfig({}), /Missing/);
  for (const edit of [
    (c: typeof defaults) => { c.enemyWeapon.damage = NaN; },
    (c: typeof defaults) => { c.waves.initialEnemies = 2.5; },
    (c: typeof defaults) => { c.army.spacing = 1; },
    (c: typeof defaults) => { c.arena.width = 40; },
    (c: typeof defaults) => { c.input.stickDeadzone = 1; },
    (c: typeof defaults) => { c.simulation.step = 1; },
  ]) {
    const c = structuredClone(defaults); edit(c); assert.throws(() => validateConfig(c));
  }
  const c = structuredClone(defaults); c.waves.additionalPerWave = 0; c.input.stickDeadzone = 0;
  assert.doesNotThrow(() => validateConfig(c));
  c.arena = { width: 400, height: 400 };
  assert.doesNotThrow(() => validateConfig(c));
});

test('formations are centered, unique, and fit the arena for all survivor counts', () => {
  for (const shape of formations) for (let count = 1; count <= 25; count++) {
    const slots = formationSlots(shape, count, config.army.spacing);
    assert.equal(slots.length, count);
    assert.equal(new Set(slots.map(p => `${p.x}:${p.y}`)).size, count);
    assert.ok(Math.abs(slots.reduce((sum, p) => sum + p.x, 0)) < 1e-7);
    assert.ok(Math.abs(slots.reduce((sum, p) => sum + p.y, 0)) < 1e-7);
    for (const p of slots) assert.ok(Math.hypot(p.x, p.y) < Math.min(config.arena.width, config.arena.height) / 2);
  }
  assert.deepEqual(formationSlots('square', 0, 24), []);
});

test('shape direction and square grid match expected geometry', () => {
  const square = formationSlots('square', 25, 24);
  assert.equal(new Set(square.map(p => p.x)).size, 5);
  assert.equal(new Set(square.map(p => p.y)).size, 5);
  assert.deepEqual(formations, ['square', 'line', 'column', 'arrow']);
  for (let count = 1; count <= 25; count++) {
    for (const shape of ['line', 'column'] as const) {
      const slots = formationSlots(shape, count, 24);
      const axis = shape === 'line' ? 'y' : 'x';
      const ranks = [...new Set(slots.map(p => p[axis]))];
      assert.equal(ranks.length, Math.min(count, 2));
      assert.deepEqual(ranks.map(rank => slots.filter(p => p[axis] === rank).length), [Math.ceil(count / 2), Math.floor(count / 2)].filter(n => n > 0));
    }
  }
  const arrow = formationSlots('arrow', 25, 24);
  assert.equal(arrow[0].y, Math.min(...arrow.map(p => p.y)));
  const rows = [...new Set(arrow.map(p => p.y))];
  assert.deepEqual(rows.map(y => arrow.filter(p => p.y === y).length), [1, 3, 5, 7, 9]);
  for (const y of rows) {
    const row = arrow.filter(p => p.y === y);
    assert.ok(Math.abs(row.reduce((sum, p) => sum + p.x, 0)) < 1e-8);
    for (let i = 1; i < row.length; i++) assert.equal(row[i].x - row[i - 1].x, 24);
  }
  const rotated = rotate({ x: 0, y: -10 }, Math.PI / 2);
  assert.ok(Math.abs(rotated.x - 10) < 1e-9);
});

test('start, pause, and deterministic seeded simulation', () => {
  const a = createGame(config), b = createGame(config);
  assert.equal(a.players.length, 25); assert.equal(a.center.x, config.arena.width / 2);
  const initial = structuredClone(a);
  stepGame(a, config, idle, config.simulation.step, seededRandom(1));
  assert.deepEqual(a, initial);
  a.status = b.status = 'playing';
  const ra = seededRandom(7), rb = seededRandom(7);
  for (let i = 0; i < 120; i++) {
    stepGame(a, config, idle, config.simulation.step, ra); stepGame(b, config, idle, config.simulation.step, rb);
  }
  assert.deepEqual(a, b);
  a.status = 'paused'; const paused = structuredClone(a);
  stepGame(a, config, idle, config.simulation.step, ra); assert.deepEqual(a, paused);
});

test('diagonal movement has the same speed as axial movement', () => {
  const a = createGame(config), b = createGame(config); a.status = b.status = 'playing';
  const origin = { ...a.center };
  stepGame(a, config, { ...idle, move: { x: 1, y: 0 } }, config.simulation.step, seededRandom(1));
  stepGame(b, config, { ...idle, move: { x: 1, y: 1 } }, config.simulation.step, seededRandom(1));
  assert.ok(Math.abs(Math.hypot(a.center.x - origin.x, a.center.y - origin.y) - Math.hypot(b.center.x - origin.x, b.center.y - origin.y)) < 1e-8);
});

test('forward, reverse, and strafe follow heading while phone movement follows the screen', () => {
  for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    for (const move of [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }]) {
      const s = createGame(config); s.status = 'playing'; const before = { ...s.center };
      stepGame(s, config, { ...idle, move, aim: angle }, config.simulation.step, seededRandom(1));
      const expected = rotate(move, angle), distance = config.army.moveSpeed * config.simulation.step;
      assert.ok(Math.abs(s.center.x - before.x - expected.x * distance) < 1e-8);
      assert.ok(Math.abs(s.center.y - before.y - expected.y * distance) < 1e-8);
    }
    const s = createGame(config); s.status = 'playing'; const before = { ...s.center };
    stepGame(s, config, { ...idle, worldMove: { x: 1, y: 0 }, aim: angle }, config.simulation.step, seededRandom(1));
    assert.ok(s.center.x > before.x); assert.equal(s.center.y, before.y);
  }
});

test('casualties keep survivor slots and gaps through idle, movement, and rotation', () => {
  const s = createGame(config); s.status = 'playing'; s.pendingEnemies = 1; s.spawnTimer = 1000;
  const victim = s.players[12];
  s.bullets = [{ id: 100, x: victim.x, y: victim.y, vx: 0, vy: 0, life: 1, team: 'enemy' }];
  const c = structuredClone(config); c.enemyWeapon.damage = c.army.health;
  advanceBullets(s, c, config.simulation.step);
  assert.equal(s.players.length, 24);
  const before = new Map(s.players.map(p => [p.id, { x: p.x, y: p.y, slot: { ...p.slot } }]));
  for (let i = 0; i < 60; i++) stepGame(s, c, idle, c.simulation.step, seededRandom(1));
  for (const p of s.players) {
    assert.equal(p.x, before.get(p.id)!.x); assert.equal(p.y, before.get(p.id)!.y);
    assert.deepEqual(p.slot, before.get(p.id)!.slot);
  }
  for (let i = 0; i < 30; i++) stepGame(s, c, { ...idle, move: { x: 0, y: -1 }, rotation: 1 }, c.simulation.step, seededRandom(1));
  for (const p of s.players) {
    assert.deepEqual(p.slot, before.get(p.id)!.slot);
    const position = rotate(p.slot, s.heading);
    assert.ok(Math.abs(p.x - s.center.x - position.x) < 1e-7);
    assert.ok(Math.abs(p.y - s.center.y - position.y) < 1e-7);
  }
  setFormation(s, 'square', c);
  for (const p of s.players) assert.deepEqual(p.slot, before.get(p.id)!.slot);
  setFormation(s, 'arrow', c);
  const slots = formationSlots('arrow', 24, c.army.spacing);
  s.players.forEach((p, i) => assert.deepEqual(p.slot, slots[i]));
});

test('all formations remain bounded while rotating and reshaping at an edge', () => {
  const s = createGame(config); s.status = 'playing'; s.center = { x: 5, y: 5 };
  for (const shape of formations) {
    setFormation(s, shape, config);
    for (let i = 0; i < 120; i++) {
      stepGame(s, config, { ...idle, move: { x: -1, y: -1 }, rotation: 1 }, config.simulation.step, seededRandom(1));
      for (const p of s.players) {
        const pad = config.army.unitSize * Math.SQRT2 / 2;
        assert.ok(p.x >= pad && p.x <= config.arena.width - pad);
        assert.ok(p.y >= pad && p.y <= config.arena.height - pad);
      }
    }
  }
});

test('explicit formation changes settle survivors into new slots and share touch heading', () => {
  const s = createGame(config); s.status = 'playing'; s.players = s.players.slice(0, 7); setFormation(s, 'arrow', config);
  for (let i = 0; i < 180; i++) stepGame(s, config, { ...idle, aim: Math.PI / 2 }, config.simulation.step, seededRandom(1));
  const slots = formationSlots('arrow', 7, config.army.spacing).map(p => rotate(p, Math.PI / 2));
  s.players.forEach((p, i) => {
    assert.ok(Math.abs(p.x - s.center.x - slots[i].x) < 1e-7);
    assert.ok(Math.abs(p.y - s.center.y - slots[i].y) < 1e-7);
    assert.equal(p.heading, Math.PI / 2);
  });
});

test('swept collision detects crossing, tangent, miss, and initial overlap', () => {
  assert.equal(segmentHit({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 0 }, 10), 0.4);
  assert.equal(segmentHit({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 10 }, 10), 0.5);
  assert.equal(segmentHit({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 20 }, 10), null);
  assert.equal(segmentHit({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, 10), 0);
});

test('a fast bullet hits only the nearest opponent, ignoring allies', () => {
  const s = createGame(config);
  s.players = [player(1, 15, 50)]; s.enemies = [unit(2, 80, 50), unit(3, 40, 50)];
  s.bullets = [{ id: 4, x: 0, y: 50, vx: 1000, vy: 0, life: 1, team: 'player' }];
  advanceBullets(s, config, 0.1);
  assert.equal(s.enemies[0].health, 3); assert.equal(s.enemies[1].health, 2);
  assert.equal(s.players[0].health, 3); assert.equal(s.bullets.length, 0);
});

test('configured damage removes casualties and lifetime limits travel', () => {
  const c = structuredClone(config); c.enemyWeapon.damage = 3;
  const s = createGame(c); s.players = [player(1, 50, 50)];
  s.bullets = [{ id: 4, x: 0, y: 50, vx: 1000, vy: 0, life: 1, team: 'enemy' }];
  advanceBullets(s, c, 0.1); assert.equal(s.players.length, 0);
  s.enemies = [unit(3, 80, 50)];
  s.bullets = [{ id: 4, x: 0, y: 50, vx: 1000, vy: 0, life: 0.01, team: 'player' }];
  advanceBullets(s, c, 0.1); assert.equal(s.enemies[0].health, 3); assert.equal(s.bullets.length, 0);
});

test('waves respect pending spawns, intermission, scaling, and all four edges', () => {
  const s = createGame(config);
  advanceWaves(s, config, 0.01, seededRandom(1));
  assert.equal(s.wave, 1); assert.equal(s.enemies.length, 1); assert.equal(s.pendingEnemies, 4);
  s.enemies = [];
  advanceWaves(s, config, 0.01, seededRandom(1)); assert.equal(s.wave, 1);
  s.pendingEnemies = 0; s.intermission = config.waves.intermission;
  advanceWaves(s, config, 1, seededRandom(1)); assert.equal(s.wave, 1);
  advanceWaves(s, config, 2.01, seededRandom(1)); assert.equal(s.wave, 2); assert.equal(s.pendingEnemies, 6);
  for (let edge = 0; edge < 4; edge++) {
    const state = createGame(config); let call = 0;
    advanceWaves(state, config, 0.01, () => call++ === 0 ? (edge + 0.1) / 4 : 0.5);
    const enemy = state.enemies[0];
    assert.ok(enemy.x < 0 || enemy.x > config.arena.width || enemy.y < 0 || enemy.y > config.arena.height);
  }
});

test('enemy shoots forward toward the army and no units means defeat', () => {
  const s = createGame(config); s.status = 'playing';
  s.players.forEach(p => { p.cooldown = 100; });
  s.enemies = [unit(99, s.center.x + 200, s.center.y)]; s.pendingEnemies = 1;
  stepGame(s, config, idle, config.simulation.step, seededRandom(1));
  const bullet = s.bullets.find(b => b.team === 'enemy');
  assert.ok(bullet && bullet.vx < 0 && Math.abs(bullet.vy) < 1e-8);
  s.players = []; stepGame(s, config, idle, config.simulation.step, seededRandom(1)); assert.equal(s.status, 'over');
  const restart = createGame(config); assert.equal(restart.players.length, 25); assert.equal(restart.wave, 0); assert.equal(restart.bullets.length, 0);
});
