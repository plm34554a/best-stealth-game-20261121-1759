// The three estates of The Gilded Hedge, drawn as text maps.
// Legend: '#' hedge wall, '.' flagstones, 'B' moonbush (cover: you are hidden
// inside it), 'P' where Wren starts, 'K' a silver key, 'E' the garden gate
// (the exit — it only opens once every key on the level is pocketed).
// Guards are listed separately with their patrol waypoints in tile coordinates.
export const LEVELS = [
  {
    name: 'I · Moonlit Garden',
    brief: 'Two lantern guards. Pocket both silver keys, then slip out the gate unseen.',
    map: [
      '############################',
      '#P....B.....#......K.......#',
      '#.....B.....#..............#',
      '#..####.....#....####......#',
      '#..#........#....#.........#',
      '#..#...B....#....#...B.....#',
      '#..#........#....#.........#',
      '#.....####..#....####..B...#',
      '#.....#........K...........#',
      '#..B..#....####......#.....#',
      '#.....#....#.........#..B..#',
      '#..####....#....B....#.....#',
      '#..........................#',
      '#....B......####......B....#',
      '#..........#.........#.....#',
      '#..K.......#....B....#.....#',
      '#..........#.........#..E..#',
      '############################',
    ],
    guards: [
      { waypoints: [[6, 2], [20, 2], [20, 6], [6, 6]] },
      { waypoints: [[20, 14], [16, 14], [16, 10], [20, 10]] },
    ],
  },
  {
    name: 'II · The Gilded Hall',
    brief: 'Three guards, tighter patrols. The hall floor is open — use the moonbushes.',
    map: [
      '############################',
      '#P......#.......B.....K....#',
      '#.......#..................#',
      '#..B....#....####....B.....#',
      '#.......#....#.............#',
      '#..###..#....#..####...#...#',
      '#.......#....#......#..#...#',
      '#..B....#....#..B...#..#...#',
      '#.......#....#......#..#...#',
      '#....####....#......#......#',
      '#..........................#',
      '#..K....B....####......B...#',
      '#..........#......#........#',
      '#....#.....#..K...#....#...#',
      '#....#.....#......#....#...#',
      '#.B..#..B..#......#..B.#.E.#',
      '#....#.....#......#....#...#',
      '############################',
    ],
    guards: [
      { waypoints: [[4, 1], [7, 1], [7, 4], [4, 4]] },
      { waypoints: [[22, 10], [22, 13], [19, 13], [19, 10]] },
      { waypoints: [[8, 16], [8, 11], [17, 11], [17, 16]] },
    ],
  },
  {
    name: 'III · The Vault Terrace',
    brief: 'Four guards and long sightlines. Crouch in the bushes, throw pebbles to pull guards away.',
    map: [
      '############################',
      '#P....B....#......K....B...#',
      '#..........#...............#',
      '#..####....#....####...#...#',
      '#..#.......#....#......#...#',
      '#..#..B....#....#..B...#...#',
      '#..#.......#....#......#...#',
      '#.....#####.....#####......#',
      '#..........................#',
      '#..B.....#....K....#...B...#',
      '#........#.........#.......#',
      '#..###...#....B....#..###..#',
      '#........#.........#.......#',
      '#....B...#....####.#...B...#',
      '#..........................#',
      '#..K......B........B....#..#',
      '#.........................E#',
      '############################',
    ],
    guards: [
      { waypoints: [[3, 1], [12, 1], [12, 5], [2, 5]] },
      { waypoints: [[24, 2], [16, 2], [15, 6], [24, 6]] },
      { waypoints: [[6, 13], [13, 13], [13, 9], [6, 9]] },
      { waypoints: [[22, 15], [22, 9], [15, 9], [15, 15]] },
    ],
  },
];

/** Tile character at (tx, ty); walls outside the map. */
export function tileAt(level, tx, ty) {
  if (ty < 0 || ty >= level.map.length) return '#';
  const row = level.map[ty];
  if (tx < 0 || tx >= row.length) return '#';
  return row[tx];
}

export function isWall(level, tx, ty) {
  return tileAt(level, tx, ty) === '#';
}

export function isBush(level, tx, ty) {
  return tileAt(level, tx, ty) === 'B';
}

/** Pixel centre of a tile. */
export function tileCentre(tx, ty) {
  return { x: tx * 40 + 20, y: ty * 40 + 20 };
}
