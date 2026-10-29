import * as THREE from 'three'
import type { Builder } from '../kit/builder'
import { seeded } from '../engine/textures'
import { HALL } from './layout'

// Scene 2 (Reference 2): a small, dim inner chamber beyond the hall's doorway. Massive dressed
// blocks with deep joints, a stepped doorway into an inner cell, a generic guardian relief,
// a fluted pilaster, and one thin slit in the roof that drops a shaft of light onto a low
// stone platform — where the map will appear.

/** the hall's doorway is centred here; the chamber is centred on it */
export const CX = (HALL.rowX + 0.6 + HALL.wallX) / 2

export const CHAMBER = {
  /** local to CX */
  x0: -3.0,
  x1: 3.0,
  z0: HALL.end - 1.3, // inner face of the passage
  z1: HALL.end - 8.6,
  h: 4.6,
  platform: { x: CX, z: HALL.end - 5.0, w: 2.6, d: 1.8, h: 0.55 },
}

/** A wall of big dressed blocks between (a) and (b) in its own plane, built course by course. */
function blockWall(b: Builder, len: number, height: number, rand: () => number, skip?: (x: number, y: number, w: number, h: number) => boolean) {
  let y = 0
  while (y < height - 0.05) {
    const ch = Math.min(height - y, 0.55 + rand() * 0.3)
    let x = 0
    while (x < len - 0.05) {
      const w = Math.min(len - x, 0.8 + rand() * 0.9)
      if (!skip || !skip(x, y, w, ch)) {
        // dark backing behind each block so the joints read deep
        b.box('void', [w + 0.02, ch + 0.02, 0.04], [x + w / 2, y + ch / 2, -0.13])
        const proud = (rand() - 0.5) * 0.04
        b.add('stone', new THREE.BoxGeometry(w - 0.025, ch - 0.025, 0.25 + proud), {
          pos: [x + w / 2, y + ch / 2, proud / 2],
          rot: [(rand() - 0.5) * 0.006, (rand() - 0.5) * 0.006, (rand() - 0.5) * 0.004],
          uv: { mode: 'world', tile: 1.1 + rand() * 0.5 },
        })
      }
      x += w
    }
    y += ch
  }
}

/** A generic standing guardian in relief, ~2.1 m, facing local +Z, feet at the origin. */
function guardian(b: Builder) {
  const m = 'stone'
  const add = (g: THREE.BufferGeometry, pos: [number, number, number], rot: [number, number, number] = [0, 0, 0], scale?: [number, number, number]) => b.add(m, g, { pos, rot, scale, uv: { mode: 'world', tile: 1.2 } })
  // pedestal
  b.box(m, [0.9, 0.18, 0.32], [0, 0.09, 0.06])
  // legs, weight on one hip (tribhanga)
  add(new THREE.CylinderGeometry(0.075, 0.1, 0.85, 10), [-0.1, 0.62, 0.12], [0, 0, 0.08])
  add(new THREE.CylinderGeometry(0.075, 0.1, 0.85, 10), [0.14, 0.6, 0.12], [0, 0, -0.18])
  // lower garment, flared, with sashes
  add(new THREE.CylinderGeometry(0.22, 0.27, 0.42, 14, 1, false, -Math.PI / 2, Math.PI), [0.03, 1.13, 0.06], [0, 0, 0.1], [1, 1, 0.55])
  add(new THREE.TorusGeometry(0.2, 0.025, 6, 16, Math.PI), [0.03, 1.18, 0.1], [0, 0, Math.PI + 0.1], [1, 0.5, 1])
  // torso, turned at the waist
  add(new THREE.CylinderGeometry(0.17, 0.14, 0.5, 12, 1, false, -Math.PI / 2, Math.PI), [-0.02, 1.58, 0.06], [0, 0, -0.08], [1, 1, 0.7])
  add(new THREE.SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), [-0.04, 1.8, 0.06], [0, 0, -0.08], [1.25, 0.5, 0.7])
  // necklace
  add(new THREE.TorusGeometry(0.11, 0.018, 6, 16, Math.PI), [-0.04, 1.76, 0.13], [0, 0, Math.PI], [1, 0.9, 1])
  // head with a tall crown
  add(new THREE.SphereGeometry(0.11, 14, 10), [-0.06, 1.98, 0.1], [0, 0, 0], [0.9, 1.1, 0.8])
  add(new THREE.CylinderGeometry(0.06, 0.11, 0.26, 10), [-0.07, 2.18, 0.08])
  add(new THREE.SphereGeometry(0.045, 8, 6), [-0.07, 2.33, 0.08])
  // halo plate behind
  add(new THREE.CylinderGeometry(0.24, 0.24, 0.04, 20), [-0.06, 2.05, -0.02], [Math.PI / 2, 0, 0])
  // one arm raised with a flower, one resting on the club/hip
  add(new THREE.CylinderGeometry(0.04, 0.05, 0.42, 8), [-0.27, 1.84, 0.12], [0, 0, 0.55])
  add(new THREE.CylinderGeometry(0.035, 0.04, 0.34, 8), [-0.36, 2.1, 0.13], [0, 0, -0.3])
  add(new THREE.SphereGeometry(0.06, 8, 6), [-0.32, 2.3, 0.14])
  add(new THREE.CylinderGeometry(0.04, 0.05, 0.45, 8), [0.24, 1.47, 0.12], [0, 0, -0.35])
  add(new THREE.CylinderGeometry(0.045, 0.06, 1.2, 8), [0.38, 0.75, 0.14], [0, 0, 0.06])
  add(new THREE.SphereGeometry(0.09, 10, 8), [0.41, 1.36, 0.14])
}

export function buildChamber(b: Builder) {
  b.group([CX, 0, 0], 0, () => chamber(b))
}

function chamber(b: Builder) {
  const C = CHAMBER
  const rand = seeded(732)
  const W = C.x1 - C.x0
  const D = C.z0 - C.z1
  const door = HALL.door

  // floor: worn flagstones, the same as the hall
  b.box('floor', [W, 0.2, D], [(C.x0 + C.x1) / 2, -0.1, (C.z0 + C.z1) / 2], { uv: { mode: 'world', tile: 2.4 } })

  // entrance wall (inside face), around the passage from the hall
  b.group([C.x1, 0, C.z0 - 0.02], Math.PI, () =>
    blockWall(b, W, C.h, rand, (x, y, w) => y < door.h + 0.15 && x + w > W / 2 - door.w / 2 - 0.1 && x < W / 2 + door.w / 2 + 0.1),
  )
  // side walls; each group turns so the wall faces into the room
  b.group([C.x0 + 0.02, 0, C.z0], Math.PI / 2, () => blockWall(b, D, C.h, rand))
  b.group([C.x1 - 0.02, 0, C.z1], -Math.PI / 2, () => blockWall(b, D, C.h, rand))

  // far wall with a stepped doorway into the inner cell
  const cellW = 1.5
  const cellH = 2.2
  const sill = 0.45
  b.group([C.x0, 0, C.z1 + 0.02], 0, () =>
    blockWall(b, W, C.h, rand, (x, y, w) => {
      const c0 = W / 2 - cellW / 2 - 0.55
      return y < sill + cellH + 0.55 && x + w > c0 && x < c0 + cellW + 1.1
    }),
  )
  // solid fill around the opening (the coursed blocks there were skipped)
  const fillW = cellW + 1.1 + 2 * 1.8
  const fillH = sill + cellH + 0.55 + 0.9
  b.box('ashlar', [(fillW - cellW) / 2, fillH, 0.4], [-(cellW / 2 + (fillW - cellW) / 4), fillH / 2, C.z1 - 0.05], { uv: { mode: 'world', tile: 1.4 } })
  b.box('ashlar', [(fillW - cellW) / 2, fillH, 0.4], [cellW / 2 + (fillW - cellW) / 4, fillH / 2, C.z1 - 0.05], { uv: { mode: 'world', tile: 1.4 } })
  b.box('ashlar', [cellW + 0.2, fillH - sill - cellH, 0.4], [0, sill + cellH + (fillH - sill - cellH) / 2, C.z1 - 0.05], { uv: { mode: 'world', tile: 1.4 } })
  // frame: three receding jambs and lintels
  for (let k = 0; k < 3; k++) {
    const o = 0.55 - k * 0.18
    const z = C.z1 + 0.18 + k * 0.08
    b.box('stone', [0.2, cellH + o, 0.3], [-cellW / 2 - o / 2 - 0.1, sill + (cellH + o) / 2, z])
    b.box('stone', [0.2, cellH + o, 0.3], [cellW / 2 + o / 2 + 0.1, sill + (cellH + o) / 2, z])
    b.box('stone', [cellW + o + 0.4, 0.22, 0.3], [0, sill + cellH + o + 0.11, z])
  }
  // carved jamb panels, as in the reference
  b.box('panel', [0.36, 1.4, 0.06], [-cellW / 2 - 0.55, sill + 1.0, C.z1 + 0.38])
  b.box('panel', [0.36, 1.4, 0.06], [cellW / 2 + 0.55, sill + 1.0, C.z1 + 0.38])
  // raised sill (threshold) and the cell behind it
  b.box('stone', [cellW + 1.4, sill, 0.9], [0, sill / 2, C.z1 + 0.15])
  b.box('stone', [cellW, 0.05, 1.4], [0, sill, C.z1 - 0.7])
  b.box('stone', [0.2, cellH + 0.4, 1.6], [-cellW / 2 - 0.1, sill + (cellH + 0.4) / 2, C.z1 - 0.7])
  b.box('stone', [0.2, cellH + 0.4, 1.6], [cellW / 2 + 0.1, sill + (cellH + 0.4) / 2, C.z1 - 0.7])
  b.box('stone', [cellW + 0.4, 0.2, 1.6], [0, sill + cellH + 0.1, C.z1 - 0.7])
  b.group([-cellW / 2, sill, C.z1 - 1.5], 0, () => blockWall(b, cellW, cellH, rand))

  // guardian relief in a shallow frame on the right wall
  b.group([C.x1 - 0.14, 0, C.z1 + 2.0], -Math.PI / 2, () => {
    b.box('stone', [1.3, 0.12, 0.3], [0, 2.62, 0.05])
    b.box('stone', [0.14, 2.6, 0.24], [-0.6, 1.3, 0.04])
    b.box('stone', [0.14, 2.6, 0.24], [0.6, 1.3, 0.04])
    guardian(b)
  })
  // fluted pilaster on the left wall
  b.group([C.x0 + 0.16, 0, C.z0 - 1.6], Math.PI / 2, () => {
    b.box('stone', [0.9, 0.3, 0.3], [0, 0.15, 0])
    for (let i = 0; i < 6; i++) b.box('stone', [0.1, 3.2, 0.12], [-0.3 + i * 0.12, 1.9, 0.06])
    b.box('stone', [0.95, 0.35, 0.34], [0, 3.65, 0])
  })

  // roof of big slabs with one narrow slit above the platform
  const P = { ...C.platform, x: 0 }
  const slitZ = P.z
  for (let z = C.z0; z > C.z1; ) {
    const d = 0.9 + rand() * 0.4
    const z2 = Math.max(C.z1, z - d)
    const mid = (z + z2) / 2
    if (!(slitZ < z + 0.05 && slitZ > z2 - 0.05)) {
      b.box('stone', [W + 0.4, 0.45, z - z2 - 0.02], [(C.x0 + C.x1) / 2, C.h + 0.22, mid])
    } else {
      // this course leaves a slit 14 cm wide across the middle
      const sw = 0.14
      const side = (W + 0.4 - sw) / 2
      b.box('stone', [side, 0.45, z - z2 - 0.02], [C.x0 - 0.2 + side / 2, C.h + 0.22, mid])
      b.box('stone', [side, 0.45, z - z2 - 0.02], [C.x1 + 0.2 - side / 2, C.h + 0.22, mid])
    }
    z = z2
  }

  // the platform: stepped base and a dressed top (its top is drawn separately so it can glow)
  b.box('stone', [P.w + 0.5, 0.16, P.d + 0.5], [P.x, 0.08, P.z])
  b.box('stone', [P.w + 0.2, 0.16, P.d + 0.2], [P.x, 0.24, P.z])
  b.box('stone', [P.w, P.h - 0.34, P.d], [P.x, 0.32 + (P.h - 0.34) / 2, P.z])
}
