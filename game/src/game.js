// The Gilded Hedge: game state, the main loop and the rules that tie the
// modules together. Screens: title → play → (caught | levelDone) → win.
// Keys open the gate; the gate ends the level. A guard touching Wren while
// the alarm is up ends the run for that level.
import { NOISE, TILE, VIEW_H, VIEW_W } from './config.js';
import { LEVELS, isBush, tileCentre } from './levels.js';
import { makeGuard, updateGuard, hearNoise, guardSeesPlayer, GUARD_CHASE } from './guards.js';
import { makePlayer, updatePlayer } from './player.js';
import { drawScreen } from './render.js';
import {
  unlockAudio, startPad, playKey, playGate, playWin, playCaught, playPebble, toggleMute,
} from './audio.js';

export function loadLevel(index) {
  const level = LEVELS[index];
  let playerStart = { x: 60, y: 60 };
  let exit = { x: VIEW_W - 60, y: VIEW_H - 60 };
  const keys = [];
  for (let ty = 0; ty < level.map.length; ty += 1) {
    for (let tx = 0; tx < level.map[ty].length; tx += 1) {
      const ch = level.map[ty][tx];
      if (ch === 'P') playerStart = tileCentre(tx, ty);
      if (ch === 'K') keys.push({ x: tx * TILE + 20, y: ty * TILE + 20, taken: false });
      if (ch === 'E') exit = tileCentre(tx, ty);
    }
  }
  return {
    level,
    levelIndex: index,
    player: makePlayer(playerStart.x, playerStart.y),
    guards: level.guards.map(makeGuard),
    keys,
    exit,
    time: 0,
    totalTime: 0,
    screen: 'title',
    pebbles: [],
    pebbleMarks: [],
    events: [],
    seenFlash: 0,
  };
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export function createGame(canvas) {
  const ctx = canvas.getContext('2d');
  const state = loadLevel(0);
  state.canvas = canvas;
  const input = { up: false, down: false, left: false, right: false, sprint: false };
  let last = performance.now();
  let raf = 0;

  function startLevel(index) {
    const total = state.totalTime;
    const fresh = loadLevel(index);
    Object.assign(state, fresh);
    state.totalTime = total;
    state.screen = 'play';
  }

  function restart() {
    startLevel(0);
    state.totalTime = 0;
  }

  function throwPebble(wx, wy) {
    if (state.screen !== 'play' || state.player.pebbles <= 0) return;
    const p = state.player;
    const d = dist(p.x, p.y, wx, wy);
    const range = Math.min(d, NOISE.pebbleThrowRange);
    const tx = p.x + ((wx - p.x) / (d || 1)) * range;
    const ty = p.y + ((wy - p.y) / (d || 1)) * range;
    state.player.pebbles -= 1;
    state.pebbles.push({ x: tx, y: ty, born: state.time });
    state.pebbleMarks.push({ x: tx, y: ty });
    hearNoise(state.guards, tx, ty, NOISE.pebbleRadius);
    playPebble();
  }

  function update(dt) {
    if (state.screen !== 'play') return;
    state.time += dt;
    state.totalTime += dt;
    const { noiseRadius } = updatePlayer(state.level, state.player, input, dt);
    if (noiseRadius > 0) hearNoise(state.guards, state.player.x, state.player.y, noiseRadius);
    const events = [];
    for (const g of state.guards) updateGuard(state.level, g, state.guards, state.player, dt, events);
    state.events = events;

    for (const key of state.keys) {
      if (!key.taken && dist(state.player.x, state.player.y, key.x, key.y) < 26) {
        key.taken = true;
        state.player.keys += 1;
        playKey();
      }
    }
    // Caught: a chasing guard reaches Wren.
    for (const g of state.guards) {
      if (g.state === GUARD_CHASE && dist(g.x, g.y, state.player.x, state.player.y) < 24) {
        state.screen = 'caught';
        playCaught();
        return;
      }
    }
    // The gate only opens with every key pocketed.
    const allKeys = state.keys.every((k) => k.taken);
    if (allKeys && dist(state.player.x, state.player.y, state.exit.x, state.exit.y) < 30) {
      if (state.levelIndex + 1 >= LEVELS.length) {
        state.screen = 'win';
        playWin();
      } else {
        state.screen = 'levelDone';
        playGate();
      }
    }
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    // Screen-reader status line: announce the alert state when it changes.
    const alertNow = state.guards.some((g) => g.state === GUARD_CHASE)
      ? 'Alarm! A guard is chasing you.'
      : state.guards.some((g) => g.suspicion >= 50)
        ? 'A guard is suspicious.'
        : 'Unseen.';
    const statusEl = document.getElementById('status');
    if (statusEl && statusEl.textContent !== alertNow) statusEl.textContent = alertNow;
    drawScreen(ctx, state);
    raf = requestAnimationFrame(frame);
  }

  function toWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * VIEW_W,
      y: ((clientY - rect.top) / rect.height) * VIEW_H,
    };
  }

  function onKeyDown(e) {
    unlockAudio();
    const k = e.key.toLowerCase();
    if (k === 'arrowup' || k === 'w') input.up = true;
    if (k === 'arrowdown' || k === 's') input.down = true;
    if (k === 'arrowleft' || k === 'a') input.left = true;
    if (k === 'arrowright' || k === 'd') input.right = true;
    if (k === 'shift') input.sprint = true;
    if (k === 'c') state.player.crouched = !state.player.crouched;
    if (k === 'm') toggleMute();
    if (k === 'p' || k === 'escape') {
      if (state.screen === 'play') state.screen = 'paused';
      else if (state.screen === 'paused') state.screen = 'play';
    }
    if (k === 'enter' || k === ' ') {
      if (state.screen === 'title') { state.screen = 'play'; startPad(); }
      else if (state.screen === 'levelDone') startLevel(state.levelIndex + 1);
    }
    if (k === 'r') {
      if (state.screen === 'caught') startLevel(state.levelIndex);
      else if (state.screen === 'win') restart();
    }
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  }

  function onKeyUp(e) {
    const k = e.key.toLowerCase();
    if (k === 'arrowup' || k === 'w') input.up = false;
    if (k === 'arrowdown' || k === 's') input.down = false;
    if (k === 'arrowleft' || k === 'a') input.left = false;
    if (k === 'arrowright' || k === 'd') input.right = false;
    if (k === 'shift') input.sprint = false;
  }

  function onClick(e) {
    unlockAudio();
    if (state.screen === 'title') { state.screen = 'play'; startPad(); return; }
    if (state.screen === 'levelDone') { startLevel(state.levelIndex + 1); return; }
    if (state.screen === 'caught') { startLevel(state.levelIndex); return; }
    if (state.screen === 'win') { restart(); return; }
    if (state.screen === 'paused') { state.screen = 'play'; return; }
    const w = toWorld(e.clientX, e.clientY);
    throwPebble(w.x, w.y);
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onClick);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // Exposed for the screenshot scenes and for play-testing in the console.
  window.__game = {
    state,
    input,
    startLevel,
    restart,
    throwPebble,
    update,
    guardSeesPlayer,
    isHidden: () => isBush(state.level, Math.floor(state.player.x / TILE), Math.floor(state.player.y / TILE)),
  };

  raf = requestAnimationFrame(frame);
  return { state, stop: () => cancelAnimationFrame(raf) };
}
