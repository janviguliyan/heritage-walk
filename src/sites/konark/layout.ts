// Footprints of the Konark complex in metres (+X east, +Z south). Shared by the 3D scene
// and the hand-drawn site plan. Positions are approximate (see the brief's "Facts to verify").
export const LAYOUT = {
  enclosure: { x0: -95, x1: 105, z0: -75, z1: 75 },
  nataMandir: { x: 46, size: 24, h: 4 },
  chariot: { x0: -62, x1: 12, half: 18, h: 4.5 },
  jagamohana: { x: -5, w: 28 },
  deul: { x: -42, w: 26.5 },
  mayadevi: { x: -75, z: 45 },
}

// lawn parterres [x0, z0, x1, z1]: two broad bands north and south of the paved court,
// split by cross paths, plus the west lawn behind the deul
export const LAWNS: [number, number, number, number][] = [
  ...[[-91, -60], [-56, -20], [-16, 22], [26, 60], [64, 101]].flatMap(([x0, x1]) => [
    [x0, -71, x1, -40] as [number, number, number, number],
    [x0, -35, x1, -26] as [number, number, number, number],
    [x0, 26, x1, 35] as [number, number, number, number],
    [x0, 40, x1, 71] as [number, number, number, number],
  ]),
  [-91, -20, -72, 20],
  [64, -20, 76, -14],
  [64, 14, 76, 20],
]
// foundations of lesser buildings: [x, z, width, depth, height]
export const RUINS: [number, number, number, number, number][] = [
  [-36, 54, 13, 10, 1.4],
  [-8, 57, 10, 8, 1.1],
  [44, 55, 16, 9, 1.0],
  [80, 54, 9, 9, 0.9],
  [-38, -56, 12, 12, 1.2],
  [8, -55, 18, 10, 1.3],
  [44, -56, 10, 8, 0.9],
  [-80, -56, 8, 8, 0.8],
]

/** The site as flat shapes for the walk's corner map: [x0, z0, x1, z1, kind]. */
export function plan2d() {
  const L = LAYOUT
  const E = L.enclosure
  const areas: [number, number, number, number, string][] = [[E.x0, E.z0, E.x1, E.z1, 'court']]
  for (const [x0, z0, x1, z1] of LAWNS) areas.push([x0, z0, x1, z1, 'lawn'])
  for (const [x, z, w, d] of RUINS) areas.push([x - w / 2, z - d / 2, x + w / 2, z + d / 2, 'ruin'])
  const N = L.nataMandir
  areas.push([N.x - N.size / 2, -N.size / 2, N.x + N.size / 2, N.size / 2, 'temple'])
  areas.push([L.chariot.x0, -L.chariot.half, L.chariot.x1, L.chariot.half, 'temple'])
  areas.push([L.jagamohana.x - L.jagamohana.w / 2, -L.jagamohana.w / 2, L.jagamohana.x + L.jagamohana.w / 2, L.jagamohana.w / 2, 'main'])
  areas.push([L.deul.x - L.deul.w / 2, -L.deul.w / 2, L.deul.x + L.deul.w / 2, L.deul.w / 2, 'temple'])
  areas.push([L.mayadevi.x - 6.5, L.mayadevi.z - 6.5, L.mayadevi.x + 6.5, L.mayadevi.z + 6.5, 'temple'])
  areas.push([E.x0, E.z0, E.x1, E.z1, 'wall'])
  return { areas }
}
