// Screenshot scenes behind ?shot=start|play|exit|caught. Each one plays the
// real game forward from a fresh level with a small autopilot steering Wren
// along a breadth-first path to the nearest key, then the gate — waiting,
// crouched, when the next step would be seen — stepping the real update loop
// synchronously so the staged frame does not depend on wall-clock timing.
// Every frame is what a real game looks like, and the same seed always gives
// the same frame. The 'caught' scene walks straight at the nearest guard
// until the alarm catches Wren.
import { TILE } from './config.js';
import { isWall, tileCentre } from './levels.js';
import { findPath as guardFindPath } from './guards.js';

const params = new URLSearchParams(location.search);
const shot = params.get('shot') || 'start';
const STEP = 1 / 60;

function waitForGame() {
  return new Promise((resolve) => {
    const tick = () => (window.__game ? resolve(window.__game) : requestAnimationFrame(tick));
    tick();
  });
}

function probeSeen(game, px, py) {
  const probe = { x: px, y: py, crouched: game.state.player.crouched };
  return game.state.guards.some((g) => game.guardSeesPlayer(game.state.level, g, probe));
}

/** Breadth-first path over walkable tiles, as pixel waypoints. */
function findPath(level, fromTx, fromTy, toTx, toTy) {
  const key = (x, y) => `${x},${y}`;
  const prev = new Map();
  const queue = [[fromTx, fromTy]];
  prev.set(key(fromTx, fromTy), null);
  while (queue.length > 0) {
    const [x, y] = queue.shift();
    if (x === toTx && y === toTy) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (isWall(level, nx, ny) || prev.has(key(nx, ny))) continue;
      prev.set(key(nx, ny), [x, y]);
      queue.push([nx, ny]);
    }
  }
  if (!prev.has(key(toTx, toTy))) return [];
  const path = [];
  let cur = [toTx, toTy];
  while (cur) {
    path.unshift(tileCentre(cur[0], cur[1]));
    cur = prev.get(key(cur[0], cur[1]));
  }
  return path;
}

function makePilot(game) {
  let path = [];
  let pathTarget = '';
  let waitTime = 0;
  return {
    steer(tx, ty, reckless) {
      const s = game.state;
      const p = s.player;
      const input = game.input;
      input.up = input.down = input.left = input.right = false;
      input.sprint = false;
      const ptx = Math.floor(p.x / TILE);
      const pty = Math.floor(p.y / TILE);
      const ttx = Math.floor(tx / TILE);
      const tty = Math.floor(ty / TILE);
      const targetKey = `${ttx},${tty}`;
      if (targetKey !== pathTarget || path.length === 0) {
        path = findPath(s.level, ptx, pty, ttx, tty);
        pathTarget = targetKey;
      }
      // Drop waypoints already reached.
      while (path.length > 0 && Math.hypot(path[0].x - p.x, path[0].y - p.y) < 14) path.shift();
      if (path.length === 0) return true;
      const node = path[0];
      const dx = node.x - p.x;
      const dy = node.y - p.y;
      const d = Math.hypot(dx, dy);
      const nx = (dx / d) * 26;
      const ny = (dy / d) * 26;
      if (!reckless && probeSeen(game, p.x + nx, p.y + ny)) {
        waitTime += STEP;
        // Wait, crouched, for the cone to sweep past — but not forever:
        // after a few seconds, slip through crouched anyway.
        p.crouched = true;
        if (waitTime < 3) return false;
      }
      waitTime = 0;
      p.crouched = false;
      const mx = dx / d;
      const my = dy / d;
      if (mx < -0.3) input.left = true;
      if (mx > 0.3) input.right = true;
      if (my < -0.3) input.up = true;
      if (my > 0.3) input.down = true;
      return false;
    },
  };
}

waitForGame().then((game) => {
  if (shot === 'start') return; // Title screen is the cover.
  const s = game.state;
  s.screen = 'play';
  const pilot = makePilot(game);
  const stop = () => {
    game.input.up = game.input.down = game.input.left = game.input.right = false;
    game.state.player.crouched = shot === 'play';
  };
  if (shot === 'caught') {
    // Stand Wren on the first guard's real patrol path, dead ahead in its
    // beam: the guard walks straight at her, the alarm rises, and it catches her.
    const guard = s.guards[0];
    const nextTile = guard.waypointTiles[1];
    const patrolPath = guardFindPath(
      s.level,
      Math.floor(guard.x / TILE),
      Math.floor(guard.y / TILE),
      nextTile[0],
      nextTile[1],
    );
    const middle = patrolPath[Math.floor(patrolPath.length / 2)] || { x: guard.x + 120, y: guard.y };
    s.player.x = middle.x;
    s.player.y = middle.y;
    s.player.crouched = false;
    for (let i = 0; i < 60 * 90; i += 1) {
      game.update(STEP);
      if (s.screen === 'caught') break;
    }
  } else if (shot === 'exit') {
    for (let i = 0; i < 60 * 300; i += 1) {
      const allKeys = s.keys.every((k) => k.taken);
      const nearGate = Math.hypot(s.player.x - s.exit.x, s.player.y - s.exit.y) < 110;
      if (allKeys && nearGate) break;
      if (s.screen !== 'play') break;
      const target = s.keys.find((k) => !k.taken) || s.exit;
      pilot.steer(target.x, target.y, false);
      game.update(STEP);
    }
  } else if (shot === 'win') {
    // Full playthrough: clear all three estates to prove the whole game is winnable.
    for (let i = 0; i < 60 * 900 && s.screen !== 'win'; i += 1) {
      if (s.screen === 'levelDone') {
        game.startLevel(s.levelIndex + 1);
        continue;
      }
      if (s.screen !== 'play') break;
      const target = s.keys.find((k) => !k.taken) || s.exit;
      pilot.steer(target.x, target.y, false);
      game.update(STEP);
    }
  } else {
    // play: a mid-game frame with a key pocketed and a cone in view.
    for (let i = 0; i < 60 * 60; i += 1) {
      if ((s.player.keys >= 1 && s.time > 9) || s.time > 25) break;
      if (s.screen !== 'play') break;
      const target = s.keys.find((k) => !k.taken) || s.exit;
      pilot.steer(target.x, target.y, false);
      game.update(STEP);
    }
  }
  stop();
});
