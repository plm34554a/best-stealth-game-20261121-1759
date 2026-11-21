// Wren, the player: a young courier in a grey cloak, stealing back the
// locket the estate took. WASD / arrows to move, Shift to sprint (fast but
// loud — guards hear it), C to crouch (slow, quiet, harder to spot), click
// to throw a pebble that draws guards to where it lands.
import { NOISE, PLAYER, TILE } from './config.js';
import { isWall } from './levels.js';
import { playStep } from './audio.js';

export function makePlayer(x, y) {
  return {
    x,
    y,
    radius: PLAYER.radius,
    facing: 0,
    crouched: false,
    sprinting: false,
    moving: false,
    stepTimer: 0,
    pebbles: 3,
    keys: 0,
  };
}

function tryMove(level, player, dx, dy) {
  const nx = player.x + dx;
  const ny = player.y + dy;
  if (!isWall(level, Math.floor(nx / TILE), Math.floor(player.y / TILE))) player.x = nx;
  if (!isWall(level, Math.floor(player.x / TILE), Math.floor(ny / TILE))) player.y = ny;
}

export function updatePlayer(level, player, input, dt) {
  let mx = 0;
  let my = 0;
  if (input.left) mx -= 1;
  if (input.right) mx += 1;
  if (input.up) my -= 1;
  if (input.down) my += 1;
  player.moving = mx !== 0 || my !== 0;
  if (!player.moving) {
    player.sprinting = false;
    return { noiseRadius: 0 };
  }
  const len = Math.hypot(mx, my);
  mx /= len;
  my /= len;
  player.facing = Math.atan2(my, mx);
  player.sprinting = input.sprint && !player.crouched;
  const speed = player.crouched
    ? PLAYER.crouchSpeed
    : player.sprinting
      ? PLAYER.sprintSpeed
      : PLAYER.walkSpeed;
  tryMove(level, player, mx * speed * dt, my * speed * dt);
  player.stepTimer -= dt;
  if (player.stepTimer <= 0) {
    playStep(player.sprinting);
    player.stepTimer = player.sprinting ? 0.26 : player.crouched ? 0.55 : 0.38;
  }
  return { noiseRadius: player.sprinting ? NOISE.sprintRadius : NOISE.walkRadius };
}
