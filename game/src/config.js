// Shared tuning for The Gilded Hedge: tile size, speeds, sight and sound.
// One place for every number the other modules read, so balancing is a single edit.
export const TILE = 40;
export const VIEW_W = 1120;
export const VIEW_H = 720;

export const PLAYER = {
  radius: 13,
  walkSpeed: 150,
  sprintSpeed: 235,
  crouchSpeed: 82,
  // How far a guard can see the player, in pixels, by stance.
  seenRange: 190,
  crouchSeenRange: 118,
  bushSeenRange: 62,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 62,
  chaseSpeed: 148,
  investigateSpeed: 105,
  viewRange: 205,
  halfAngle: 0.61, // ~35 degrees each side of facing
  turnSpeed: 2.6,
  pauseAtWaypoint: 1.4,
  // Suspicion 0..100. Fills while the player is seen, drains while hidden.
  fillPerSecondNear: 95,
  fillPerSecondFar: 42,
  drainPerSecond: 26,
  catchDistance: 22,
  alarmSeconds: 7,
  searchSeconds: 5,
};

export const NOISE = {
  sprintRadius: 130,
  walkRadius: 0,
  crouchRadius: 0,
  pebbleRadius: 150,
  pebbleThrowRange: 320,
};

export const COLOURS = {
  night: '#0b1020',
  floorA: '#232a3a',
  floorB: '#202636',
  wall: '#3d4a63',
  wallTop: '#55648a',
  bush: '#1d4d2e',
  bushLeaf: '#2f7a44',
  exit: '#ffd166',
  key: '#ffe066',
  player: '#e8b4ff',
  guard: '#ffcf5c',
  coneCalm: 'rgba(255, 214, 110, 0.20)',
  coneAlert: 'rgba(255, 84, 72, 0.30)',
  coneSuspect: 'rgba(255, 170, 60, 0.26)',
};
