import type { Formation, Vec } from './types';

export const formations: Formation[] = ['square', 'line', 'column', 'arrow', 'circle'];

// Local forward is -Y. Centering keeps the army pivot stable across every shape.
export function formationSlots(shape: Formation, count: number, spacing: number): Vec[] {
  if (count <= 0) return [];
  let points: Vec[] = [];
  if (shape === 'square') {
    const width = Math.ceil(Math.sqrt(count));
    for (let i = 0; i < count; i++) points.push({ x: (i % width) * spacing, y: Math.floor(i / width) * spacing });
  } else if (shape === 'line' || shape === 'column') {
    points = Array.from({ length: count }, (_, i) => ({ x: shape === 'line' ? i * spacing : 0, y: shape === 'column' ? i * spacing : 0 }));
  } else if (shape === 'arrow') {
    points.push({ x: 0, y: 0 });
    for (let row = 1; points.length < count; row++) {
      points.push({ x: -row * spacing * 0.7, y: row * spacing * 0.7 });
      if (points.length < count) points.push({ x: row * spacing * 0.7, y: row * spacing * 0.7 });
    }
  } else {
    const radius = count > 1 ? spacing / (2 * Math.sin(Math.PI / count)) : 0;
    points = Array.from({ length: count }, (_, i) => ({ x: Math.sin(i * Math.PI * 2 / count) * radius, y: -Math.cos(i * Math.PI * 2 / count) * radius }));
  }
  const center = points.reduce((sum, p) => ({ x: sum.x + p.x / count, y: sum.y + p.y / count }), { x: 0, y: 0 });
  return points.map(p => ({ x: p.x - center.x, y: p.y - center.y }));
}
