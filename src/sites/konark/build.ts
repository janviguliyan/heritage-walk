// Building the Konark scene: pure geometry, no React — so it can run in a Web Worker.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { Builder } from '../../kit/builder'
import { seeded } from '../../engine/textures'
import type { WheelPlacement } from '../../kit/StaticWorld'
import { wheelGeometry } from '../../kit/geometry'
import type { Banyan, Broadleaf, Palm, Shrub, TreePlacement } from '../../kit/Trees'
import {
  BASE_PROFILE,
  figure,
  resetFigures,
  gajaSimha,
  gateTower,
  horse,
  niche,
  plinth,
  rubble,
  ruinWall,
  stairs,
  surya,
  wall,
} from '../../kit/parts'

// Konark Sun Temple, assembled from kit parts. 1 unit = 1 m.
// Axes: +X = east, -Z = north. The complex faces east; visitors enter at the east gate.
// Footprints follow the brief's site table; positions are approximate (see "Facts to verify").

import { LAWNS, LAYOUT, RUINS } from './layout'
import { makaraSpout, skipSculpture } from '../../kit/statues'
import { carvedPillar, carvedTier, PANCHARATHA, pidhaRathaRoof, rathaCourse, rathaReach, warElephant, warHorse } from '../../kit/ratha'
import type { MatKey } from '../../kit/materials'
export { LAYOUT }


const PI = Math.PI


export function buildKonark() {
  // deterministic: the bake, the walk and the stone miniature must all build the same scene
  resetFigures()
  const b = new Builder({ lightmap: true })
  const rand = seeded(1250)
  const E = LAYOUT.enclosure

  // --- ground: forest floor outside; inside, a paved court around the temple and mown
  // lawn parterres edged with laterite kerbs, divided by paths (after aerial photos) -----
  b.box('lawn', [2400, 0.2, 2400], [0, -0.1, 0], { uv: { mode: 'world', tile: 9 } })
  b.colliderBox([0, -1, 0], [400, 1, 400])
  b.box('path', [E.x1 - E.x0 - 2, 0.06, E.z1 - E.z0 - 2], [(E.x0 + E.x1) / 2, 0.03, 0], { uv: { mode: 'world', tile: 3.6 } })
  // the approach from the east gate
  b.box('path', [44, 0.07, 9], [E.x1 + 20, 0.035, 0], { uv: { mode: 'world', tile: 3.6 } })
  for (const p of LAWNS) {
    const [x0, z0, x1, z1] = p
    b.box('lawn', [x1 - x0, 0.12, z1 - z0], [(x0 + x1) / 2, 0.06, (z0 + z1) / 2], { uv: { mode: 'world', tile: 5 } })
    // kerbs
    const k = 0.3
    b.box('laterite', [x1 - x0 + k, 0.2, k], [(x0 + x1) / 2, 0.1, z0], { uv: { mode: 'world', tile: 1.2 } })
    b.box('laterite', [x1 - x0 + k, 0.2, k], [(x0 + x1) / 2, 0.1, z1], { uv: { mode: 'world', tile: 1.2 } })
    b.box('laterite', [k, 0.2, z1 - z0], [x0, 0.1, (z0 + z1) / 2], { uv: { mode: 'world', tile: 1.2 } })
    b.box('laterite', [k, 0.2, z1 - z0], [x1, 0.1, (z0 + z1) / 2], { uv: { mode: 'world', tile: 1.2 } })
  }

  // --- foundations of lesser shrines, the kitchen and a Vaishnava temple, in the lawns ---
  for (const [x, z, w, d, h] of RUINS) {
    b.group([x, 0, z], 0, () => {
      plinth(b, w, d, h, BASE_PROFILE.slice(0, 5))
      b.group([0, h, 0], 0, () => {
        ruinWall(b, -w / 2 + 1, w / 2 - 1, d / 2 - 1, 0.9, 0.2, 1.4, Math.max(2, Math.round(w / 3)), rand, 'laterite')
        ruinWall(b, -w / 2 + 1, w / 2 - 1, -d / 2 + 1, 0.9, 0.2, 1.1, Math.max(2, Math.round(w / 3)), rand, 'khondalite')
      })
    })
  }
  rubble(b, 62, -48, 14, 8, 10, rand, 'laterite')

  // --- enclosure wall and gates (laterite) -----------------------------------
  const WH = 3.2
  const WT = 1.5
  wall(b, E.x1, E.z0, E.x1, -5, WH, WT)
  wall(b, E.x1, 5, E.x1, E.z1, WH, WT)
  wall(b, E.x0, E.z0, E.x0, E.z1, WH, WT)
  for (const z of [E.z0, E.z1]) {
    wall(b, E.x0, z, -4, z, WH, WT)
    wall(b, 4, z, E.x1, z, WH, WT)
    for (const x of [-6, 6]) b.group([x, 0, z], 0, () => gateTower(b, 3.6, 5))
  }
  for (const z of [-7.5, 7.5]) b.group([E.x1, 0, z], 0, () => gateTower(b, 5, 7))

  // --- nata mandir: high roofless platform with broken pillars -----------------
  const N = LAYOUT.nataMandir
  b.group([N.x, 0, 0], 0, () => {
    // the high platform in the stepped plan, every course carved with dancers and musicians
    const courses: [MatKey, number, number][] = [
      ['khondalite', 0.4, 0.55],
      ['frieze', 0.9, 0.3],
      ['khondalite', 0.25, 0.4],
      ['frieze', 1.1, 0.15],
      ['khondalite', 0.25, 0.35],
      ['frieze', 0.8, 0.1],
      ['khondalite', 0.3, 0.3],
    ]
    let y = 0
    for (const [m, h, g] of courses) {
      rathaCourse(b, m, N.size - 1.8, y, h, g, PANCHARATHA, 2)
      y += h
    }
    b.colliderBox([0, N.h / 2, 0], [N.size / 2, N.h / 2, N.size / 2])
    // sixteen pillars, all broken to different heights
    for (const x of [-9, -3, 3, 9]) {
      for (const z of [-9, -3, 3, 9]) {
        const h = 0.9 + rand() * 3.4
        b.group([x, N.h, z], 0, () => carvedPillar(b, h, true, rand))
      }
    }
  })
  b.group([N.x + N.size / 2 + 8, 0, 0], PI, () => stairs(b, 8, N.h, 8))
  b.group([N.x - N.size / 2 - 8, 0, 0], 0, () => stairs(b, 8, N.h, 8))
  for (const z of [-7.5, 7.5]) b.group([N.x + N.size / 2 + 10.5, 0, z], 0, () => gajaSimha(b))

  // --- the chariot plinth carrying jagamohana and deul -----------------------
  const C = LAYOUT.chariot
  const len = C.x1 - C.x0
  b.group([(C.x0 + C.x1) / 2, 0, 0], 0, () => plinth(b, len, C.half * 2, C.h))
  b.group([C.x1 + 8, 0, 0], PI, () => stairs(b, 8, C.h, 9))
  b.group([C.x0 - 8, 0, 0], 0, () => stairs(b, 8, C.h, 8))
  b.group([LAYOUT.jagamohana.x, 0, C.half + 8], PI / 2, () => stairs(b, 8, C.h, 7))
  b.group([LAYOUT.jagamohana.x, 0, -C.half - 8], -PI / 2, () => stairs(b, 8, C.h, 7))

  // seven horses at the east front; several broken, as today
  const horses: [number, { head?: boolean; forelegs?: boolean }][] = [
    [-16, { head: true }],
    [-12, {}],
    [-8, { forelegs: true }],
    [8, { head: true, forelegs: true }],
    [12, {}],
    [16, { forelegs: true }],
    [20, { head: true }],
  ]
  for (const [z, broken] of horses) b.group([C.x1 + 5, 0, z], 0, () => horse(b, broken), 1.15)

  // --- jagamohana (audience hall): pancharatha walls banded with carving, its doorways
  // sealed (as since 1903), and a three-tier pidha roof with musicians and great lions ------
  const J = LAYOUT.jagamohana
  b.group([J.x, C.h, 0], 0, () => {
    const w = J.w
    // pabhaga: five mouldings in the stepped plan
    const base: [MatKey, number, number][] = [
      ['khondalite', 0.5, 0.7],
      ['frieze', 0.6, 0.35],
      ['khondalite', 0.3, 0.55],
      ['frieze', 0.6, 0.25],
      ['khondalite', 0.35, 0.5],
    ]
    let y = 0
    for (const [m, h, g] of base) {
      rathaCourse(b, m, w, y, h, g, PANCHARATHA, 2)
      y += h
    }
    b.colliderBox([0, 1.2, 0], [rathaReach(w) + 0.7, 1.2, rathaReach(w) + 0.7])
    const y0 = y
    const wallH = 10
    // the wall in the stepped plan, with carved bands at sill, middle and top
    // the wall (jangha) in two tiers of carved niches, divided by a moulding band (bandhana),
    // as on the standing walls today
    rathaCourse(b, 'khondalite', w - 0.3, y0, wallH, 0, PANCHARATHA, 2.4)
    rathaCourse(b, 'khondalite', w, y0, 0.35, 0.12)
    carvedTier(b, w, y0 + 0.35, 4.1, rand, { door: 4.2 })
    rathaCourse(b, 'khondalite', w, y0 + 4.45, 0.3, 0.2)
    rathaCourse(b, 'frieze', w, y0 + 4.75, 0.6, 0.12)
    rathaCourse(b, 'khondalite', w, y0 + 5.35, 0.3, 0.2)
    carvedTier(b, w, y0 + 5.65, 4.0, rand, { door: 4.2 })
    rathaCourse(b, 'khondalite', w, y0 + 9.65, 0.35, 0.15)
    b.colliderBox([0, y0 + wallH / 2, 0], [rathaReach(w) + 0.3, wallH / 2, rathaReach(w) + 0.3])
    for (let k = 0; k < 4; k++) {
      b.group([0, 0, 0], (k * PI) / 2, () => {
        const f = rathaReach(w)
        if (k !== 2) {
          // the great doorway: receding chlorite jambs and lintel, filled with laterite
          for (let j = 0; j < 4; j++) {
            const o = j * 0.35
            b.box('chlorite', [0.5, 7 - o, 0.55], [f + 0.25 - j * 0.12, y0 + (7 - o) / 2, 3.4 - o])
            b.box('chlorite', [0.5, 7 - o, 0.55], [f + 0.25 - j * 0.12, y0 + (7 - o) / 2, -3.4 + o])
            b.box('chlorite', [0.5, 0.55, 7.4 - o * 2], [f + 0.25 - j * 0.12, y0 + 7 - o, 0])
          }
          b.box('khondalite', [0.4, 5.6, 5.2], [f + 0.05, y0 + 2.8, 0], { uv: { mode: 'world', tile: 0.9 } })
          b.box('khondalite', [1.4, 0.8, 9.5], [f + 0.4, y0 + 7.6, 0])
        }
        // pilasters on the anurathas
        for (const z of [-w * 0.26, w * 0.26]) b.box('khondalite', [0.4, wallH - 1, 0.9], [f - PANCHARATHA.rahaOut + PANCHARATHA.anuOut + 0.15, y0 + wallH / 2, z])
      })
    }
    // baranda: the heavy cornice
    rathaCourse(b, 'khondalite', w, y0 + wallH, 0.5, 0.35)
    rathaCourse(b, 'frieze', w, y0 + wallH + 0.5, 0.7, 0.2)
    rathaCourse(b, 'khondalite', w, y0 + wallH + 1.2, 0.4, 0.5)
    b.group([0, y0 + wallH + 1.6, 0], 0, () => pidhaRathaRoof(b, { w: w + 0.6, tiers: [6, 5, 4], figures: true, lions: true }, figure))
  })

  // --- the colossal war horses (south) and war elephants (north), on their pedestals ----
  for (const x of [-18, -34]) {
    b.group([x, 0, 24.5], -PI / 2, () => warHorse(b))
    b.group([x, 0, -24.5], PI / 2, () => warElephant(b))
  }

  // --- antarala and the ruined deul (sanctuary) -------------------------------
  b.box('khondalite', [10, 4, 14], [-24, C.h + 2, 0], { collide: true })
  const D = LAYOUT.deul
  b.group([D.x, C.h, 0], 0, () => {
    const w = D.w
    rathaCourse(b, 'khondalite', w - 2, 0, 0.5, 0.5, PANCHARATHA, 2)
    rathaCourse(b, 'frieze', w - 2, 0.5, 1.0, 0.2)
    rathaCourse(b, 'khondalite', w - 2, 1.5, 0.5, 0.35, PANCHARATHA, 2)
    b.colliderBox([0, 1, 0], [w / 2, 1, w / 2])
    // the surviving lower walls of the sanctuary: carved mouldings, then one storey of niches
    // and miniature shrines, broken off at uneven heights; the interior is a mound of fill
    rathaCourse(b, 'khondalite', w - 3, 2, 3.6, 0, PANCHARATHA, 2.4)
    carvedTier(b, w - 3, 2, 3.4, rand, { door: 3.2, doorFaces: [1, 2, 3], ruined: true })
    b.colliderBox([0, 3.8, 0], [w / 2 - 0.6, 1.8, w / 2 - 0.6])
    b.add('khondalite', new THREE.SphereGeometry((w - 5) / 2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), { pos: [0, 5.2, 0], scale: [1, 0.22, 1] })
    rubble(b, 0, 0, w - 8, w - 8, 18, rand)
    // three Surya images in chlorite niches: south, west and north faces
    for (const [rot, label] of [[-PI / 2, 'S'], [PI, 'W'], [PI / 2, 'N']] as const) {
      void label
      b.group([0, 2.0, 0], rot, () => {
        b.group([w / 2 + 1.2, 0, 0], 0, () => {
          b.box('khondalite', [1.2, 6.5, 7], [-0.6, 3.25, 0], { collide: true })
          niche(b, 2.6, 3.8)
          surya(b)
        })
      })
    }
  })
  rubble(b, -80, 16, 14, 14, 22, rand)
  rubble(b, -45, -28, 40, 8, 26, rand)
  rubble(b, -82, -42, 10, 12, 10, rand, 'laterite')

  // --- Mayadevi Temple, south-west -------------------------------------------
  const M = LAYOUT.mayadevi
  b.group([M.x, 0, M.z], 0, () => {
    // sanctum and porch on carved plinths in the stepped plan (as excavated)
    for (const [x, w, h] of [[0, 10, 1.7], [10.5, 8, 1.4]] as const) {
      b.group([x, 0, 0], 0, () => {
        const courses: [MatKey, number, number][] = [
          ['khondalite', 0.3, 0.45],
          ['frieze', 0.45, 0.25],
          ['khondalite', 0.22, 0.35],
          ['frieze', 0.45, 0.15],
          ['khondalite', h - 1.42, 0.3],
        ]
        let y = 0
        for (const [m, ch, g] of courses) {
          rathaCourse(b, m, w, y, ch, g, PANCHARATHA, 1.6)
          y += ch
        }
        b.colliderBox([0, h / 2, 0], [w / 2 + 0.9, h / 2, w / 2 + 0.9])
        // makara waterspouts at the corners of the plinth
        for (let k = 0; k < 4; k++)
          b.group([0, 0, 0], (k * PI) / 2 + PI / 4, () => b.add('carved', makaraSpout().clone(), { pos: [w * 0.66, h - 0.3, 0] }))
        // walls standing to a few metres, carved and broken
        rathaCourse(b, 'khondalite', w - 1.4, h, 2.6, 0, PANCHARATHA, 2)
        carvedTier(b, w - 1.4, h, 2.6, rand, { door: 1.6, doorFaces: x === 0 ? [0] : [0, 2], ruined: true })
        b.colliderBox([0, h + 1.2, 0], [w / 2 - 0.2, 1.2, w / 2 - 0.2])
      })
    }
    b.group([16.9, 0, 0], PI, () => stairs(b, 1.4, 1.4, 3))
  })

  // the twenty-four wheels, part of the static (baked) scene
  const wheel = wheelGeometry(1.5)
  for (const w of wheelPlacements()) {
    b.add('carved', wheel.clone(), { pos: w.pos, rot: [0, w.rotY, w.spin] })
    b.colliderBox(w.pos, [1.6, 1.6, 0.45], w.rotY)
  }
  wheel.dispose()

  return b
}

export function wheelPlacements(): WheelPlacement[] {
  const C = LAYOUT.chariot
  const xs = [10, 6, 2, ...Array.from({ length: 9 }, (_, i) => -11.5 - i * 6)]
  const out: WheelPlacement[] = []
  xs.forEach((x, i) => {
    out.push({ pos: [x, 1.62, C.half + 0.55], rotY: 0, spin: i * 0.37 })
    out.push({ pos: [x, 1.62, -C.half - 0.55], rotY: PI, spin: i * 0.53 })
  })
  return out
}

function inside(x: number, z: number, pad: number) {
  const E = LAYOUT.enclosure
  return x > E.x0 - pad && x < E.x1 + pad && z > E.z0 - pad && z < E.z1 + pad
}

/** A few casuarinas toward the sea (east), as along the Odisha coast. */
export function treePlacements(low: boolean): TreePlacement[] {
  const rand = seeded(86)
  const trees: TreePlacement[] = []
  while (trees.length < (low ? 50 : 140)) {
    const x = 150 + rand() * 260
    const z = (rand() - 0.5) * 420
    if (Math.abs(z) < 16 && x < 170) continue
    trees.push({ x, z, h: 12 + rand() * 8 })
  }
  return trees
}

/** The green belt around the enclosure, thinning outward, with an open lawn strip kept clear
 *  outside the wall (as at the site today, where the compound reads against grass). */
export function broadleafPlacements(low: boolean): Broadleaf[] {
  const rand = seeded(91)
  const out: Broadleaf[] = []
  const n = low ? 320 : 760
  let guard = 0
  while (out.length < n && guard++ < n * 20) {
    // denser toward the near belt, but not right up against the wall
    const ring = Math.pow(rand(), 1.3) * 250 + 16
    const a = rand() * Math.PI * 2
    const E = LAYOUT.enclosure
    const x = (E.x0 + E.x1) / 2 + Math.cos(a) * ((E.x1 - E.x0) / 2 + ring)
    const z = Math.sin(a) * ((E.z1 - E.z0) / 2 + ring)
    if (inside(x, z, 5)) continue
    if (x > 100 && x < 170 && Math.abs(z) < 16) continue // the approach stays open
    const r = 3.2 + rand() * 3.6
    out.push({ x, z, r, h: r * (1.7 + rand() * 0.6) })
  }
  // shade trees along the inner wall
  const E = LAYOUT.enclosure
  for (let x = E.x0 + 7; x < E.x1 - 7; x += low ? 30 : 22) {
    if (Math.abs(x) < 12) continue
    for (const z of [E.z0 + 4.5, E.z1 - 4.5]) {
      const r = 2.6 + rand() * 1.6
      out.push({ x: x + (rand() - 0.5) * 3, z, r, h: r * 2 })
    }
  }
  // a couple of old trees in the lawns (the banyan is its own tree: banyanPlacement)
  out.push({ x: -66, z: -33, r: 5.5, h: 11 })
  out.push({ x: 70, z: 47, r: 5, h: 10 })
  return out
}

/** The great banyan south of the nata mandir. */
export function banyanPlacement(): Banyan {
  return { x: 30, z: 33, r: 10, h: 12 }
}

/** Flowering shrubs in rows along the lawn edges, by the paved court. */
export function shrubPlacements(low: boolean): Shrub[] {
  const rand = seeded(17)
  const out: Shrub[] = []
  const step = low ? 6 : 3.4
  for (const z of [27.2, -27.2, 41.2, -41.2]) {
    for (let x = -88; x < 100; x += step) {
      if ([-58, -18, 24, 62].some((p) => Math.abs(x - p) < 3.5)) continue
      out.push({ x: x + (rand() - 0.5) * 0.4, z, r: 0.5 + rand() * 0.15, bloom: rand() > 0.55 ? 1 : 0 })
    }
  }
  return out
}

export function palmPlacements(): Palm[] {
  const rand = seeded(29)
  const out: Palm[] = []
  for (let i = 0; i < 46; i++) {
    const x = 110 + rand() * 120
    const z = (rand() - 0.5) * 300
    if (Math.abs(z) < 14) continue
    out.push({ x, z, h: 11 + rand() * 6 })
  }
  for (const [x, z] of [[96, -66], [92, 66], [-88, 66], [-88, -66]]) out.push({ x, z, h: 12 + rand() * 3 })
  return out
}

/** Vertex-clustering simplification: snap every vertex to a grid of `cell` metres (each cell's
 *  vertices merge to their average), drop triangles that collapse, and keep each one once. */
function clusterSimplify(g: THREE.BufferGeometry, cell: number) {
  const pos = g.attributes.position as THREE.BufferAttribute
  const idx = g.index ? (g.index.array as ArrayLike<number>) : null
  const n = idx ? idx.length : pos.count
  const ids = new Map<string, number>()
  const sum: number[] = []
  const cnt: number[] = []
  const of = new Int32Array(pos.count)
  for (let v = 0; v < pos.count; v++) {
    const x = pos.getX(v)
    const y = pos.getY(v)
    const z = pos.getZ(v)
    const k = `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`
    let id = ids.get(k)
    if (id === undefined) {
      id = cnt.length
      ids.set(k, id)
      sum.push(0, 0, 0)
      cnt.push(0)
    }
    sum[id * 3] += x
    sum[id * 3 + 1] += y
    sum[id * 3 + 2] += z
    cnt[id]++
    of[v] = id
  }
  const seen = new Set<string>()
  const out: number[] = []
  for (let t = 0; t < n; t += 3) {
    const a = of[idx ? idx[t] : t]
    const b = of[idx ? idx[t + 1] : t + 1]
    const c = of[idx ? idx[t + 2] : t + 2]
    if (a === b || b === c || a === c) continue
    const key = [a, b, c].sort((p, q) => p - q).join(',')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(a, b, c)
  }
  const verts = new Float32Array(cnt.length * 3)
  for (let i = 0; i < cnt.length; i++) for (let k = 0; k < 3; k++) verts[i * 3 + k] = sum[i * 3 + k] / cnt[i]
  const r = new THREE.BufferGeometry()
  r.setAttribute('position', new THREE.BufferAttribute(verts, 3))
  r.setIndex(out)
  r.computeVertexNormals()
  const flat = r.toNonIndexed()
  r.dispose()
  flat.deleteAttribute('uv')
  return flat
}

/** The temple's architecture as one plain mesh (no ground, no sculpture): for the stone miniature. */
export function konarkMiniature({ minArea = 0.002, sculpture = true } = {}) {
  // without sculpture, don't spend time sculpting it
  if (!sculpture) skipSculpture(true)
  const meshes = buildKonark().build()
  skipSculpture(false)
  const parts: THREE.BufferGeometry[] = []
  for (const [key, g] of meshes) {
    const mat = key.split('#')[0]
    if (['lawn', 'grass', 'path', 'sand'].includes(mat) || (mat === 'carved' && !sculpture)) {
      g.dispose()
      continue
    }
    // sculpture: too fine to keep, too important to drop: cluster it into solid low forms
    if (mat === 'carved') {
      parts.push(clusterSimplify(g, 0.22))
      g.dispose()
      continue
    }
    // at tablet scale (about 1:75) small carved details are invisible: keep the forms only
    const src = g.index ? g.toNonIndexed() : g
    const pos = src.attributes.position as THREE.BufferAttribute
    const nor = src.attributes.normal as THREE.BufferAttribute
    const keepP: number[] = []
    const keepN: number[] = []
    const A = new THREE.Vector3()
    const B = new THREE.Vector3()
    const C = new THREE.Vector3()
    for (let i = 0; i < pos.count; i += 3) {
      A.fromBufferAttribute(pos, i)
      B.fromBufferAttribute(pos, i + 1)
      C.fromBufferAttribute(pos, i + 2)
      const area = B.clone().sub(A).cross(C.clone().sub(A)).length() / 2
      if (area < minArea) continue
      for (let k = 0; k < 3; k++) {
        keepP.push(pos.getX(i + k), pos.getY(i + k), pos.getZ(i + k))
        keepN.push(nor.getX(i + k), nor.getY(i + k), nor.getZ(i + k))
      }
    }
    const bare = new THREE.BufferGeometry()
    bare.setAttribute('position', new THREE.Float32BufferAttribute(keepP, 3))
    bare.setAttribute('normal', new THREE.Float32BufferAttribute(keepN, 3))
    parts.push(bare)
    g.dispose()
  }
  const merged = mergeGeometries(parts, false)!
  for (const p of parts) p.dispose()
  return merged
}

