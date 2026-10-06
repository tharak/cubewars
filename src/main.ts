import './style.css';
import { validateConfig } from './game/config';
import { formations, setFormation } from './game/formations';
import { seededRandom } from './game/math';
import { createGame, stepGame } from './game/simulation';
import type { Formation } from './game/types';
import { Input } from './input';
import { render } from './render';

const playIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7Z"/></svg>';
const pauseIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>';
const restartIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8a8 8 0 1 1-1 8M5 3v5h5"/></svg>';
const icons: Record<Formation, string> = {
  square: '<path d="M6 6h4v4H6zm8 0h4v4h-4zM6 14h4v4H6zm8 0h4v4h-4z"/>',
  line: '<path d="M3 6h4v4H3zm7 0h4v4h-4zm7 0h4v4h-4zM3 14h4v4H3zm7 0h4v4h-4zm7 0h4v4h-4z"/>',
  column: '<path d="M6 3h4v4H6zm8 0h4v4h-4zM6 10h4v4H6zm8 0h4v4h-4zM6 17h4v4H6zm8 0h4v4h-4z"/>',
  arrow: '<path d="M10 3h4v4h-4zM7 9h4v4H7zm6 0h4v4h-4zM4 15h4v4H4zm6 0h4v4h-4zm6 0h4v4h-4z"/>',
};

async function start(): Promise<void> {
  const response = await fetch(`${import.meta.env.BASE_URL}config/game.json`, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Unable to load game configuration (${response.status})`);
  const config = validateConfig(await response.json());
  let state = createGame(config);
  const random = seededRandom(Date.now());
  const canvas = document.querySelector<HTMLCanvasElement>('#arena')!;
  const pause = document.querySelector<HTMLButtonElement>('#pause')!;
  const centerAction = document.querySelector<HTMLButtonElement>('#center-action')!;
  const navigation = document.querySelector<HTMLElement>('#formations')!;
  let accumulator = 0;
  let uiSignature = '';
  const chooseFormation = (formation: Formation) => { setFormation(state, formation, config); updateUI(); };
  const togglePause = () => {
    if (state.status === 'over') state = createGame(config);
    state.status = state.status === 'playing' ? 'paused' : 'playing';
    accumulator = 0; input.clear(); updateUI();
  };
  const input = new Input(config.input.stickDeadzone, chooseFormation, togglePause);
  for (const [i, formation] of formations.entries()) {
    const button = document.createElement('button');
    const label = formation === 'line' ? 'row' : formation;
    button.dataset.formation = formation; button.setAttribute('aria-label', `${label} formation`);
    button.title = `${label} (${i + 1})`; button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[formation]}</svg>`;
    button.addEventListener('click', () => chooseFormation(formation)); navigation.append(button);
  }
  pause.addEventListener('click', togglePause); centerAction.addEventListener('click', togglePause);
  document.querySelector('#restart')!.addEventListener('click', () => {
    state = createGame(config); state.status = 'playing'; accumulator = 0; input.clear(); updateUI();
  });
  const loseFocus = () => {
    if (state.status === 'playing') state.status = 'paused';
    input.clear(); accumulator = 0; updateUI();
  };
  window.addEventListener('blur', loseFocus);
  document.addEventListener('visibilitychange', () => { if (document.hidden) loseFocus(); });
  window.addEventListener('pagehide', loseFocus);
  const updateTouch = () => document.body.classList.toggle('touch', navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches);
  updateTouch(); matchMedia('(pointer: coarse)').addEventListener('change', updateTouch);
  function updateUI(): void {
    const signature = `${state.status}:${state.wave}:${state.players.length}:${state.formation}`;
    if (signature === uiSignature) return;
    uiSignature = signature;
    document.querySelector('#wave')!.textContent = String(state.wave);
    document.querySelector('#survivors')!.textContent = String(state.players.length);
    const label = state.status === 'playing' ? 'Pause' : state.status === 'over' ? 'Restart' : state.status === 'ready' ? 'Start' : 'Resume';
    const icon = state.status === 'playing' ? pauseIcon : state.status === 'over' ? restartIcon : playIcon;
    if (pause.getAttribute('aria-label') !== label) { pause.setAttribute('aria-label', label); pause.title = label; pause.innerHTML = icon; }
    centerAction.hidden = state.status === 'playing'; centerAction.setAttribute('aria-label', label);
    centerAction.innerHTML = icon;
    document.querySelector('#app')!.setAttribute('data-status', state.status);
    navigation.querySelectorAll<HTMLButtonElement>('button').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.formation === state.formation));
    });
  }
  updateUI();
  let last = performance.now();
  function frame(now: number): void {
    const elapsed = Math.min((now - last) / 1000, config.simulation.maxFrameTime); last = now;
    if (state.status === 'playing') {
      accumulator += elapsed;
      while (accumulator >= config.simulation.step) {
        stepGame(state, config, input.read(), config.simulation.step, random); accumulator -= config.simulation.step;
        if (state.status !== 'playing') { accumulator = 0; input.clear(); break; }
      }
    } else accumulator = 0;
    render(canvas, state, config); updateUI(); requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

start().catch(error => {
  console.error(error);
  document.querySelector<HTMLElement>('#error')!.hidden = false;
  document.querySelector<HTMLElement>('#center-action')!.hidden = true;
  document.querySelectorAll<HTMLButtonElement>('button').forEach(button => { button.disabled = true; });
});
