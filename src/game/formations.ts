import type { GameConfig } from './config';
import type { Formation, GameState, Vec } from './types';

export const formations: Formation[] = ['square', 'line', 'column', 'arrow'];

// Local forward is -Y. Centering keeps the army pivot stable across every shape.
export function formationSlots(shape: Formation, count: number, spacing: number): Vec[] {
  if (count <= 0) return [];
  let points: Vec[] = [];
  if (shape === 'square') {
    const width = Math.ceil(Math.sqrt(count));
    for (let i = 0; i < count; i++) points.push({ x: (i % width) * spacing, y: Math.floor(i / width) * spacing });
  } else if (shape === 'line' || shape === 'column') {
    // Fill two balanced ranks. Center an incomplete final rank along its own axis.
    const longRank = Math.ceil(count / 2);
    for (let rank = 0; rank < Math.min(count, 2); rank++) {
      const length = rank === 0 ? longRank : count - longRank;
      for (let i = 0; i < length; i++) {
        const along = (i - (length - 1) / 2) * spacing;
        points.push(shape === 'line' ? { x: along, y: rank * spacing } : { x: rank * spacing, y: along });
      }
    }
  } else if (shape === 'arrow') {
    // Filled pyramid: 1, 3, 5, 7, 9 cubes for the initial 25-unit army.
    for (let row = 0; points.length < count; row++) {
      const width = Math.min(2 * row + 1, count - points.length);
      for (let i = 0; i < width; i++) points.push({ x: (i - (width - 1) / 2) * spacing, y: row * spacing });
    }
  }
  const center = points.reduce((sum, p) => ({ x: sum.x + p.x / count, y: sum.y + p.y / count }), { x: 0, y: 0 });
  return points.map(p => ({ x: p.x - center.x, y: p.y - center.y }));
}

// Casualties remove units, leaving their slots vacant. Only a new formation rebuilds them.
export function setFormation(state: GameState, shape: Formation, config: GameConfig): void {
  if (state.formation === shape) return;
  state.formation = shape;
  state.formationAngle = 0;
  const slots = formationSlots(shape, state.players.length, config.army.spacing);
  state.players.forEach((unit, i) => { unit.slot = slots[i]; });
}
