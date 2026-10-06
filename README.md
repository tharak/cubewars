# CubeWars

A formation survival game for desktop and phone browsers. Command a cube army, change its shape, and survive attacks from every direction.

[Play](https://tharak.github.io/cubewars/) · [Implementation roadmap](https://github.com/tharak/cubewars/issues)

## Controls

| Action | Desktop | Touch |
| --- | --- | --- |
| Move | W forward, S backward relative to facing | Left stick in screen directions |
| Rotate / aim | A / D | Right stick |
| Rotate cube positions while keeping aim | Hold Q / E | Hold rotation icons beside formations |
| Formation | 1 square, 2 row (two rows), 3 column (two columns), 4 filled pyramid | Formation icons |
| Start / pause / resume | Play/pause icon, Space or Escape | Play/pause icon |
| Restart | Circular arrow icon | Circular arrow icon |

Every cube automatically fires in the army's heading. A/D turns the army and its firing direction; Q/E orbits cube positions around the pivot while keeping their aim fixed, allowing damaged cubes to move from the front toward the rear. W/S follows the firing direction even while positions rotate. Friendly cubes do not block friendly shots. Casualties persist and leave gaps: surviving cubes keep their assigned slots through movement and both rotations. Changing to a different formation rebuilds slots for the remaining army and aligns the new shape with its firing direction; selecting the active formation does not close gaps or reset tactical rotation. The initial row/column layouts have two ranks of 13 and 12, and the pyramid has filled rows of 1, 3, 5, 7, and 9. Zero survivors ends the run. Defeat changes the central action to restart. Each cleared wave gives a short break before more enemies arrive. Backgrounding the game pauses it. Landscape offers a larger battlefield on phones, but portrait is supported.

## Development

Use Node.js 24 or newer.

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
npm run preview
```

Vite uses `/cubewars/` as the base path. Open the URL printed by the server. The server listens on all interfaces for LAN phone testing. Build output is `dist/`.

## Architecture

The project follows a functional core / imperative shell boundary. Domain functions receive explicit state, configuration, commands, time, and randomness. For predictable allocations, simulation updates state in place; there are no hidden global game variables, DOM dependencies, or internal clocks in the core.

| Module | Responsibility |
| --- | --- |
| `src/game/types.ts` | State and shared command interfaces |
| `src/game/config.ts` | Typed configuration and startup validation |
| `src/game/formations.ts` | Centered local geometry and explicit slot reassignment; forward is negative Y |
| `src/game/math.ts` | Geometry, swept collisions, and seeded randomness |
| `src/game/simulation.ts` | Fixed-timestep movement, formations, and domain orchestration |
| `src/game/combat.ts` | Forward firing, earliest projectile impact, damage, casualties |
| `src/game/waves.ts` | Spawn scheduling and wave escalation |
| `src/input.ts` | Keyboard and multitouch adapters to `Commands` |
| `src/render.ts` | Canvas presentation; no simulation changes |
| `src/main.ts` | Configuration loading, lifecycle, UI, and frame scheduling |

Rendering scales a fixed world into the available canvas; resizing never changes simulation coordinates. Player units store local formation slots; casualties remove units without recalculating those slots. State tracks firing `heading` and independent `formationAngle`; slot geometry uses their sum, while movement and shots use heading alone. The simulation rigidly carries current positions with army movement/both rotations and approaches slot targets during explicit formation transitions. Keyboard movement is forward/backward relative to heading; touch movement is in world/screen directions. A future Capacitor shell can reuse this core and web presentation. Native packaging is deferred.

## Game configuration

Edit `public/config/game.json`. Values are loaded at startup; reload after changing them. Times are seconds, positions and sizes are world units, speeds are world units/second, and rotation speed is radians/second.

| Section | Fields |
| --- | --- |
| `army` | `initialSize`, `spacing`, `unitSize`, `health`, `moveSpeed`, `rotationSpeed` for steering, `formationRotationSpeed` for Q/E, `transitionSpeed` |
| `arena` | `width`, `height` |
| `playerWeapon`, `enemyWeapon` | `damage`, `interval` between shots, projectile `speed`, `lifetime`, `radius` |
| `enemy` | `health`, `unitSize`, `moveSpeed`, `attackRange`, `spawnMargin` outside the arena |
| `waves` | `initialEnemies`, `additionalPerWave`, `spawnInterval`, `intermission` |
| `simulation` | Fixed `step`, `maxFrameTime` for bounded catch-up |
| `input` | `stickDeadzone` between 0 and 1 |

All settings are finite positive numbers except `additionalPerWave` and `stickDeadzone`, which may be zero. Counts must be integers; army size is capped at 200. Spacing must fit units and the arena must accommodate every rotated formation at every survivor count. Invalid configuration produces a minimal warning symbol and a detailed console error rather than silently substituting defaults.

Enemies per wave = `initialEnemies + (wave - 1) * additionalPerWave`. Each enemy approaches to 75% of its attack range, faces the army pivot, and fires when in range. Config values deliberately live outside the simulation so balancing does not require editing gameplay code.

## Verification and session handoff

Simulation tests cover configuration, formations for every survivor count, movement, rotation/bounds, deterministic randomness, bullet collision/damage/lifetime, enemy behavior, wave timing, defeat, and restart. Browser checks cover keyboard controls, emulated simultaneous touch, pointer cancellation, responsive layouts, and lifecycle. Real-phone performance needs a physical device playtest; browser emulation is not a substitute. That follow-up is tracked in [issue #6](https://github.com/tharak/cubewars/issues/6).

GitHub Actions runs type checks, tests, and builds, then deploys successful `main` builds to Pages. Enable GitHub Actions as the repository's Pages source. Never publish builds with failing checks.

Use the issue roadmap to continue between sessions. Reference issues in commits, close completed issues only after verification, and leave a handoff comment on any unfinished issue with remaining work, checks, and blockers.
