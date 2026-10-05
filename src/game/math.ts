import type { Random, Vec } from './types';

export const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
export function normalize(v: Vec): Vec {
  const length = Math.hypot(v.x, v.y);
  return length > 1 ? { x: v.x / length, y: v.y / length } : v;
}
export function rotate(v: Vec, angle: number): Vec {
  return { x: v.x * Math.cos(angle) - v.y * Math.sin(angle), y: v.x * Math.sin(angle) + v.y * Math.cos(angle) };
}
export function approach(from: Vec, to: Vec, distance: number): Vec {
  const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy);
  const ratio = length === 0 ? 0 : Math.min(1, distance / length);
  return { x: from.x + dx * ratio, y: from.y + dy * ratio };
}
// Earliest intersection along a segment; supports shots that cross a unit in one tick.
export function segmentHit(start: Vec, end: Vec, target: Vec, radius: number): number | null {
  const dx = end.x - start.x, dy = end.y - start.y;
  const ox = start.x - target.x, oy = start.y - target.y;
  const a = dx * dx + dy * dy, c = ox * ox + oy * oy - radius * radius;
  if (c <= 0) return 0;
  if (a === 0) return null;
  const b = 2 * (ox * dx + oy * dy), discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}
export function seededRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
