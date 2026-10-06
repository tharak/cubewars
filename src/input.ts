import { clamp, normalize } from './game/math';
import type { Commands, Formation, Vec } from './game/types';
import { formations } from './game/formations';

export class Input {
  private keys = new Set<string>();
  private touchMove: Vec = { x: 0, y: 0 };
  private touchAim: number | null = null;
  private resetSticks: (() => void)[] = [];

  constructor(deadzone: number, onFormation: (shape: Formation) => void, onPause: () => void) {
    window.addEventListener('keydown', event => {
      if (event.target instanceof HTMLButtonElement && (event.code === 'Space' || event.code === 'Enter')) return;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'Space', 'Escape'].includes(event.code)) event.preventDefault();
      this.keys.add(event.code);
      const number = Number(event.key);
      if (number >= 1 && number <= formations.length) onFormation(formations[number - 1]);
      if (!event.repeat && (event.code === 'Space' || event.code === 'Escape')) onPause();
    });
    window.addEventListener('keyup', event => this.keys.delete(event.code));
    this.bindStick(document.querySelector<HTMLElement>('#move-stick')!, deadzone, value => { this.touchMove = value; });
    this.bindStick(document.querySelector<HTMLElement>('#aim-stick')!, deadzone, value => {
      this.touchAim = Math.hypot(value.x, value.y) > 0 ? Math.atan2(value.x, -value.y) : null;
    });
  }

  read(): Commands {
    const key = (name: string) => this.keys.has(name) ? 1 : 0;
    return {
      move: normalize({ x: key('KeyD') - key('KeyA'), y: key('KeyS') - key('KeyW') }),
      worldMove: this.touchMove,
      rotation: key('KeyE') - key('KeyQ'), aim: this.touchAim,
    };
  }

  clear(): void {
    this.keys.clear(); this.touchMove = { x: 0, y: 0 }; this.touchAim = null;
    this.resetSticks.forEach(reset => reset());
  }

  private bindStick(element: HTMLElement, deadzone: number, changed: (value: Vec) => void): void {
    const thumb = element.querySelector<HTMLElement>('.thumb')!;
    let pointer: number | null = null;
    const reset = () => {
      if (pointer !== null && element.hasPointerCapture(pointer)) element.releasePointerCapture(pointer);
      pointer = null; thumb.style.transform = 'translate(0px, 0px)'; element.classList.remove('active');
      changed({ x: 0, y: 0 });
    };
    const update = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      const radius = rect.width * 0.32;
      const raw = normalize({ x: (event.clientX - rect.left - rect.width / 2) / radius, y: (event.clientY - rect.top - rect.height / 2) / radius });
      const length = Math.hypot(raw.x, raw.y);
      const magnitude = clamp((length - deadzone) / (1 - deadzone), 0, 1);
      changed(length === 0 ? raw : { x: raw.x / length * magnitude, y: raw.y / length * magnitude });
      thumb.style.transform = `translate(${raw.x * radius}px, ${raw.y * radius}px)`;
    };
    element.addEventListener('pointerdown', event => {
      if (pointer !== null) return;
      event.preventDefault(); pointer = event.pointerId; element.setPointerCapture(pointer);
      element.classList.add('active'); update(event);
    });
    element.addEventListener('pointermove', event => { if (event.pointerId === pointer) update(event); });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      element.addEventListener(name, event => { if ((event as PointerEvent).pointerId === pointer) reset(); });
    }
    this.resetSticks.push(reset);
  }
}
