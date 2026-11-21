// Lantern guards: patrol, suspicion, investigation and chase.
// A guard walks its waypoints, pauses, and sweeps its lantern. Its vision cone
// is a range + angle + line-of-sight test (hedges block sight; moonbushes hide
// a crouched or standing player inside them). Seeing the player fills suspicion;
// a full meter raises the alarm and every guard chases. Lose sight long enough
// and the alarm cools, the guards search the last known spot, then return.
//
// Guards never walk in a straight line through a hedge: every leg they walk is
// a breadth-first path over walkable tiles, so a patrol always reaches its
// next waypoint instead of getting stuck against a wall.
import { GUARD, PLAYER, TILE } from './config.js';
import { isBush, isWall, tileCentre } from './levels.js';
import { playAlarm, playSuspicious } from './audio.js';

export const GUARD_CALM = 'patrol';
export const GUARD_SUSPECT = 'suspicious';
export const GUARD_CHASE = 'chase';
export const GUARD_SEARCH = 'search';
export const GUARD_RETURN = 'return';

function tileKey(x, y) {
  return `${x},${y}`;
}

/** Breadth-first path over walkable tiles, as pixel waypoints (excluding the start). */
export function findPath(level, fromTx, fromTy, toTx, toTy) {
  const prev = new Map();
  const queue = [[fromTx, fromTy]];
  prev.set(tileKey(fromTx, fromTy), null);
  while (queue.length > 0) {
    const [x, y] = queue.shift();
    if (x === toTx && y === toTy) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (isWall(level, nx, ny) || prev.has(tileKey(nx, ny))) continue;
      prev.set(tileKey(nx, ny), [x, y]);
      queue.push([nx, ny]);
    }
  }
  if (!prev.has(tileKey(toTx, toTy))) return [];
  const path = [];
  let cur = [toTx, toTy];
  while (cur) {
    path.unshift(tileCentre(cur[0], cur[1]));
    cur = prev.get(tileKey(cur[0], cur[1]));
  }
  return path.slice(1);
}

export function makeGuard(def) {
  const start = tileCentre(def.waypoints[0][0], def.waypoints[0][1]);
  return {
    x: start.x,
    y: start.y,
    angle: 0,
    state: GUARD_CALM,
    suspicion: 0,
    waypoints: def.waypoints.map(([tx, ty]) => tileCentre(tx, ty)),
    waypointTiles: def.waypoints,
    waypointIndex: 0,
    pauseTimer: 0,
    target: null, // {x, y} being investigated or chased
    path: [], // pixel waypoints currently being followed
    pathIndex: 0,
    pathTargetKey: '',
    loseTimer: 0,
    alarmTimer: 0,
    searchTimer: 0,
    sawPlayer: false,
  };
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

function turnToward(guard, targetAngle, dt) {
  let d = targetAngle - guard.angle;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  const step = GUARD.turnSpeed * dt;
  guard.angle += Math.max(-step, Math.min(step, d));
}

function blockedByWall(level, x0, y0, x1, y1) {
  // Sample the segment; a hedge tile anywhere along it blocks the view.
  const steps = Math.ceil(dist(x0, y0, x1, y1) / (TILE / 3));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    if (isWall(level, Math.floor(x / TILE), Math.floor(y / TILE))) return true;
  }
  return false;
}

/** True when the guard can currently see the player. Exported for render + HUD. */
export function guardSeesPlayer(level, guard, player) {
  const d = dist(guard.x, guard.y, player.x, player.y);
  const range = player.crouched
    ? PLAYER.crouchSeenRange
    : isBush(level, Math.floor(player.x / TILE), Math.floor(player.y / TILE))
      ? PLAYER.bushSeenRange
      : PLAYER.seenRange;
  if (d > Math.min(GUARD.viewRange, range)) return false;
  let diff = angleTo(guard.x, guard.y, player.x, player.y) - guard.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) > GUARD.halfAngle) return false;
  return !blockedByWall(level, guard.x, guard.y, player.x, player.y);
}

/** Walk along guard.path toward path[pathIndex]; true when the path is finished. */
function followPath(guard, speed, dt) {
  if (guard.pathIndex >= guard.path.length) return true;
  const node = guard.path[guard.pathIndex];
  const d = dist(guard.x, guard.y, node.x, node.y);
  const step = Math.min(speed * dt, d);
  if (d > 0.001) {
    guard.x += ((node.x - guard.x) / d) * step;
    guard.y += ((node.y - guard.y) / d) * step;
    guard.angle = angleTo(guard.x, guard.y, node.x, node.y);
  }
  if (d - step < 4) guard.pathIndex += 1;
  return guard.pathIndex >= guard.path.length;
}

/** (Re)build the path to a pixel target when the target tile changed. */
function ensurePath(level, guard, tx, ty) {
  const key = `${Math.floor(tx / TILE)},${Math.floor(ty / TILE)}`;
  if (key === guard.pathTargetKey && guard.pathIndex < guard.path.length) return;
  guard.path = findPath(
    level,
    Math.floor(guard.x / TILE),
    Math.floor(guard.y / TILE),
    Math.floor(tx / TILE),
    Math.floor(ty / TILE),
  );
  guard.pathIndex = 0;
  guard.pathTargetKey = key;
}

/** Next patrol waypoint: a path to it, with a pause when it is reached. */
function startPatrolLeg(level, guard) {
  const next = guard.waypointTiles[(guard.waypointIndex + 1) % guard.waypointTiles.length];
  guard.path = findPath(
    level,
    Math.floor(guard.x / TILE),
    Math.floor(guard.y / TILE),
    next[0],
    next[1],
  );
  guard.pathIndex = 0;
  guard.pathTargetKey = '';
}

export function raiseAlarm(guards, player) {
  for (const g of guards) {
    g.state = GUARD_CHASE;
    g.suspicion = 100;
    g.alarmTimer = GUARD.alarmSeconds;
    g.target = { x: player.x, y: player.y };
    g.loseTimer = 0;
    g.path = [];
    g.pathIndex = 0;
    g.pathTargetKey = '';
  }
  playAlarm();
}

export function updateGuard(level, guard, guards, player, dt, events) {
  const sees = guardSeesPlayer(level, guard, player);
  guard.sawPlayer = sees;

  if (sees && guard.state !== GUARD_CHASE) {
    const d = dist(guard.x, guard.y, player.x, player.y);
    const rate = d < 110 ? GUARD.fillPerSecondNear : GUARD.fillPerSecondFar;
    const before = guard.suspicion;
    guard.suspicion = Math.min(100, guard.suspicion + rate * dt);
    if (before < 50 && guard.suspicion >= 50) {
      guard.state = GUARD_SUSPECT;
      guard.target = { x: player.x, y: player.y };
      guard.path = [];
      guard.pathIndex = 0;
      guard.pathTargetKey = '';
      playSuspicious();
      events.push('suspicious');
    }
    if (guard.suspicion >= 100) {
      raiseAlarm(guards, player);
      events.push('alarm');
      return;
    }
  } else if (!sees && guard.state !== GUARD_CHASE) {
    guard.suspicion = Math.max(0, guard.suspicion - GUARD.drainPerSecond * dt);
    if (guard.suspicion < 50 && guard.state === GUARD_SUSPECT) guard.state = GUARD_CALM;
  }

  if (guard.state === GUARD_CHASE) {
    if (sees) {
      guard.target = { x: player.x, y: player.y };
      guard.loseTimer = 0;
    } else {
      guard.loseTimer += dt;
    }
    guard.alarmTimer -= dt;
    if (guard.target) {
      ensurePath(level, guard, guard.target.x, guard.target.y);
      followPath(guard, GUARD.chaseSpeed, dt);
    }
    if (guard.loseTimer > 3.5 || guard.alarmTimer <= 0) {
      guard.state = GUARD_SEARCH;
      guard.searchTimer = GUARD.searchSeconds;
      guard.suspicion = 60;
      guard.path = [];
      guard.pathIndex = 0;
      guard.pathTargetKey = '';
    }
    return;
  }

  if (guard.state === GUARD_SUSPECT || guard.state === GUARD_SEARCH) {
    if (guard.target) {
      ensurePath(level, guard, guard.target.x, guard.target.y);
      const arrived = followPath(guard, GUARD.investigateSpeed, dt);
      if (arrived) {
        guard.pauseTimer += dt;
        // Look around while searching.
        guard.angle += dt * 1.4;
        const limit = guard.state === GUARD_SEARCH ? guard.searchTimer : 1.6;
        if (guard.pauseTimer > limit) {
          guard.pauseTimer = 0;
          guard.state = GUARD_RETURN;
          guard.target = null;
          guard.path = [];
          guard.pathIndex = 0;
          guard.pathTargetKey = '';
        }
      }
    } else {
      guard.state = GUARD_RETURN;
    }
    return;
  }

  if (guard.state === GUARD_RETURN) {
    const home = guard.waypoints[0];
    ensurePath(level, guard, home.x, home.y);
    const arrived = followPath(guard, GUARD.patrolSpeed, dt);
    if (arrived) {
      guard.state = GUARD_CALM;
      guard.waypointIndex = 0;
      guard.path = [];
      guard.pathIndex = 0;
      guard.pathTargetKey = '';
    }
    return;
  }

  // Patrol: follow the path to the next waypoint, pause and look around there.
  if (guard.pauseTimer > 0) {
    guard.pauseTimer -= dt;
    guard.angle += dt * 0.9;
    if (guard.pauseTimer <= 0) startPatrolLeg(level, guard);
    return;
  }
  if (guard.path.length === 0 && guard.pathIndex === 0) startPatrolLeg(level, guard);
  const arrived = followPath(guard, GUARD.patrolSpeed, dt);
  if (arrived) {
    guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypointTiles.length;
    guard.pauseTimer = GUARD.pauseAtWaypoint;
    guard.path = [];
    guard.pathIndex = 0;
  }
}

/** A noise at (x, y) pulls every calm guard within earshot to investigate. */
export function hearNoise(guards, x, y, radius) {
  for (const g of guards) {
    if (g.state === GUARD_CHASE) continue;
    if (dist(g.x, g.y, x, y) <= radius) {
      g.state = GUARD_SUSPECT;
      g.target = { x, y };
      g.suspicion = Math.max(g.suspicion, 55);
      g.path = [];
      g.pathIndex = 0;
      g.pathTargetKey = '';
    }
  }
}
