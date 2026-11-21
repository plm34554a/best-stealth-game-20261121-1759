// All drawing for The Gilded Hedge: the top-down night garden, hedges,
// moonbushes, lantern guards with their vision cones, the glowing gate,
// and the HUD. Night is a darkness overlay with holes cut where lanterns
// and Wren stand, so lit ground reads as safe and shadow as danger.
import { COLOURS, GUARD, TILE, VIEW_H, VIEW_W } from './config.js';
import { isBush, isWall, tileAt } from './levels.js';
import { GUARD_CHASE, GUARD_SUSPECT } from './guards.js';

const TAU = Math.PI * 2;

function coneColour(guard) {
  if (guard.state === GUARD_CHASE) return COLOURS.coneAlert;
  if (guard.state === GUARD_SUSPECT || guard.suspicion >= 50) return COLOURS.coneSuspect;
  return COLOURS.coneCalm;
}

function drawCone(ctx, guard) {
  ctx.beginPath();
  ctx.moveTo(guard.x, guard.y);
  ctx.arc(guard.x, guard.y, GUARD.viewRange, guard.angle - GUARD.halfAngle, guard.angle + GUARD.halfAngle);
  ctx.closePath();
  ctx.fillStyle = coneColour(guard);
  ctx.fill();
  // Cone edge, so the player can read exactly where sight ends.
  ctx.strokeStyle = 'rgba(255, 220, 130, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawGuard(ctx, guard) {
  drawCone(ctx, guard);
  // Lantern glow on the floor.
  const glow = ctx.createRadialGradient(guard.x, guard.y, 4, guard.x, guard.y, 70);
  glow.addColorStop(0, 'rgba(255, 200, 90, 0.35)');
  glow.addColorStop(1, 'rgba(255, 200, 90, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(guard.x, guard.y, 70, 0, TAU);
  ctx.fill();
  // Body: dark uniform, brass helmet, lantern dot.
  ctx.fillStyle = '#2c3550';
  ctx.beginPath();
  ctx.arc(guard.x, guard.y, GUARD.radius, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#8a7a4a';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = COLOURS.guard;
  ctx.beginPath();
  ctx.arc(guard.x + Math.cos(guard.angle) * 8, guard.y + Math.sin(guard.angle) * 8, 4, 0, TAU);
  ctx.fill();
  // Suspicion arc above the guard.
  if (guard.suspicion > 5) {
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, GUARD.radius + 8, -Math.PI / 2, -Math.PI / 2 + (guard.suspicion / 100) * TAU);
    ctx.strokeStyle = guard.suspicion >= 100 ? '#ff5448' : '#ffb02e';
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  if (guard.state === GUARD_CHASE) {
    ctx.fillStyle = '#ff5448';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', guard.x, guard.y - GUARD.radius - 12);
  }
}

function drawPlayer(ctx, player, level) {
  const hidden = isBush(level, Math.floor(player.x / TILE), Math.floor(player.y / TILE));
  ctx.save();
  if (hidden) ctx.globalAlpha = 0.55;
  // Cloak: a triangle pointing where Wren faces, hood circle on top.
  ctx.translate(player.x, player.y);
  ctx.rotate(player.facing);
  ctx.fillStyle = '#6b5a8f';
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-11, -11);
  ctx.lineTo(-7, 0);
  ctx.lineTo(-11, 11);
  ctx.closePath();
  ctx.fill();
  ctx.rotate(-player.facing);
  ctx.fillStyle = COLOURS.player;
  ctx.beginPath();
  ctx.arc(0, 0, player.crouched ? 10 : 12, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#3a2d55';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  if (player.crouched) {
    ctx.fillStyle = 'rgba(232, 180, 255, 0.8)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('crouched · hidden', player.x, player.y - 20);
  }
}

function drawTiles(ctx, level) {
  for (let ty = 0; ty < level.map.length; ty += 1) {
    for (let tx = 0; tx < level.map[ty].length; tx += 1) {
      const ch = tileAt(level, tx, ty);
      const px = tx * TILE;
      const py = ty * TILE;
      if (ch === '#') {
        ctx.fillStyle = COLOURS.wall;
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = COLOURS.wallTop;
        ctx.fillRect(px, py + 3, TILE, 7);
        ctx.fillStyle = 'rgba(120, 180, 110, 0.25)';
        ctx.fillRect(px + 5, py + 14, 8, 5);
        ctx.fillRect(px + 24, py + 22, 9, 5);
      } else {
        ctx.fillStyle = (tx + ty) % 2 === 0 ? COLOURS.floorA : COLOURS.floorB;
        ctx.fillRect(px, py, TILE, TILE);
        if (ch === 'B') {
          ctx.fillStyle = COLOURS.bush;
          ctx.beginPath();
          ctx.arc(px + 12, py + 14, 11, 0, TAU);
          ctx.arc(px + 28, py + 12, 12, 0, TAU);
          ctx.arc(px + 20, py + 28, 12, 0, TAU);
          ctx.fill();
          ctx.fillStyle = COLOURS.bushLeaf;
          ctx.beginPath();
          ctx.arc(px + 14, py + 12, 5, 0, TAU);
          ctx.arc(px + 28, py + 24, 5, 0, TAU);
          ctx.fill();
        }
      }
    }
  }
}

function drawPickups(ctx, state) {
  for (const key of state.keys) {
    if (key.taken) continue;
    const bob = Math.sin(state.time * 3 + key.x) * 3;
    ctx.fillStyle = COLOURS.key;
    ctx.beginPath();
    ctx.arc(key.x, key.y + bob, 6, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#8a6d1f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(key.x, key.y + bob, 10, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#8a6d1f';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('KEY', key.x, key.y + bob - 14);
  }
  // The gate: a glowing arch that opens once every key is pocketed.
  const gate = state.exit;
  const open = state.keys.every((k) => k.taken);
  const pulse = open ? 0.75 + Math.sin(state.time * 4) * 0.25 : 0.25;
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.fillStyle = COLOURS.exit;
  ctx.fillRect(gate.x - 16, gate.y - 18, 32, 36);
  ctx.restore();
  ctx.strokeStyle = open ? '#ffe9a8' : '#6b5a2e';
  ctx.lineWidth = 3;
  ctx.strokeRect(gate.x - 16, gate.y - 18, 32, 36);
  ctx.fillStyle = open ? '#fff3c4' : '#c9a94f';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(open ? 'EXIT OPEN' : `EXIT · ${state.keys.filter((k) => !k.taken).length} KEY${state.keys.filter((k) => !k.taken).length === 1 ? '' : 'S'} LEFT`, gate.x, gate.y - 24);
}

function drawPebbles(ctx, state) {
  for (const p of state.pebbles) {
    const age = state.time - p.born;
    if (age > 1.2) continue;
    ctx.strokeStyle = `rgba(255, 255, 255, ${1 - age / 1.2})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8 + age * 46, 0, TAU);
    ctx.stroke();
  }
  for (const p of state.pebbleMarks) {
    ctx.fillStyle = '#cfd6e4';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, TAU);
    ctx.fill();
  }
}

function drawDarkness(ctx, state) {
  const dark = document.createElement('canvas');
  dark.width = VIEW_W;
  dark.height = VIEW_H;
  const dctx = dark.getContext('2d');
  dctx.fillStyle = 'rgba(5, 8, 18, 0.55)';
  dctx.fillRect(0, 0, VIEW_W, VIEW_H);
  dctx.globalCompositeOperation = 'destination-out';
  const holes = [{ x: state.player.x, y: state.player.y, r: 130 }];
  for (const g of state.guards) holes.push({ x: g.x, y: g.y, r: 150 });
  holes.push({ x: state.exit.x, y: state.exit.y, r: 90 });
  for (const h of holes) {
    const grad = dctx.createRadialGradient(h.x, h.y, 10, h.x, h.y, h.r);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    dctx.fillStyle = grad;
    dctx.beginPath();
    dctx.arc(h.x, h.y, h.r, 0, TAU);
    dctx.fill();
  }
  ctx.drawImage(dark, 0, 0);
}

export function drawWorld(ctx, state) {
  ctx.fillStyle = COLOURS.night;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawTiles(ctx, state.level);
  drawPickups(ctx, state);
  drawPebbles(ctx, state);
  for (const g of state.guards) drawGuard(ctx, g);
  drawPlayer(ctx, state.player, state.level);
  drawDarkness(ctx, state);
}

export function drawHud(ctx, state) {
  const alarm = state.guards.some((g) => g.state === GUARD_CHASE);
  const maxSus = Math.max(0, ...state.guards.map((g) => g.suspicion));
  ctx.fillStyle = 'rgba(8, 10, 20, 0.82)';
  ctx.fillRect(0, 0, VIEW_W, 44);
  ctx.fillStyle = '#e8ecf5';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(state.level.name, 14, 28);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#ffd166';
  ctx.fillText(`Keys ${state.player.keys}/${state.keys.length}`, 250, 28);
  ctx.fillStyle = '#cfd6e4';
  ctx.fillText(`Pebbles ${state.player.pebbles} (click to throw)`, 350, 28);
  ctx.fillText(`Level ${state.levelIndex + 1}/3`, 580, 28);
  ctx.fillText(`Time ${Math.floor(state.time)}s`, 680, 28);
  // Alert meter.
  ctx.fillStyle = '#2c3550';
  ctx.fillRect(780, 14, 180, 16);
  ctx.fillStyle = alarm ? '#ff5448' : maxSus > 50 ? '#ffb02e' : '#7ee787';
  ctx.fillRect(780, 14, (180 * maxSus) / 100, 16);
  ctx.fillStyle = '#e8ecf5';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(alarm ? 'ALARM!' : maxSus > 50 ? 'SPOTTED' : 'UNSEEN', 970, 28);
  ctx.textAlign = 'left';
}

function overlay(ctx, title, lines, accent) {
  ctx.fillStyle = 'rgba(5, 8, 18, 0.78)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = accent;
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, VIEW_W / 2, 250);
  ctx.fillStyle = '#e8ecf5';
  ctx.font = '18px sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 300 + i * 30));
  ctx.textAlign = 'left';
}

export function drawScreen(ctx, state) {
  if (state.screen === 'title') {
    drawWorld(ctx, state);
    overlay(ctx, 'THE GILDED HEDGE', [
      'Wren must steal back her locket from the lantern-lit estate.',
      'Pocket every silver key, then slip out the garden gate — unseen.',
      'WASD / arrows move · Shift sprint (loud!) · C crouch in the moonbushes',
      'Click to throw a pebble and pull a guard away · M mute · P pause',
      '',
      'Click or press Enter to begin',
    ], '#ffd166');
    return;
  }
  if (state.screen === 'caught') {
    drawWorld(ctx, state);
    overlay(ctx, 'CAUGHT!', [
      `A lantern found Wren on ${state.level.name}.`,
      `Keys pocketed: ${state.player.keys} of ${state.keys.length} · Time: ${Math.floor(state.time)}s`,
      'Press R or click to try the level again',
    ], '#ff5448');
    return;
  }
  if (state.screen === 'levelDone') {
    drawWorld(ctx, state);
    overlay(ctx, 'SLIPPED AWAY', [
      `${state.level.name} cleared — unseen, unheard.`,
      `Time: ${Math.floor(state.time)}s`,
      'Press Enter or click for the next estate',
    ], '#7ee787');
    return;
  }
  if (state.screen === 'win') {
    overlay(ctx, 'THE LOCKET IS HOME', [
      'Wren slipped through all three estates without ever being caught.',
      `Total time: ${Math.floor(state.totalTime)}s`,
      'Press R or click to play again',
    ], '#ffd166');
    return;
  }
  if (state.screen === 'paused') {
    drawWorld(ctx, state);
    overlay(ctx, 'PAUSED', ['Press P or click to keep sneaking'], '#cfd6e4');
    return;
  }
  drawWorld(ctx, state);
  drawHud(ctx, state);
}
