import * as THREE from 'three'
import { Builder, type V3 } from '../kit/builder'
import { seeded } from '../engine/textures'
import { buildChamber } from './chamber'

// The pillared hallway of the entry flow (Reference 1: a South Indian mandapa corridor).
// Units are metres. The corridor runs along -Z; the left side is a solid wall, the right
// side opens onto a bright courtyard. 1 unit = 1 m.

export { HALL } from './layout'
import { HALL } from './layout'

/** A box whose six faces each show one panel of the 3-panel medallion atlas. */
function panelBox(b: Builder, size: V3, pos: V3, variant: number, rotY = 0) {
  const g = new THREE.BoxGeometry(...size)
  const uv = g.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setX(i, (uv.getX(i) * 0.94 + 0.03 + variant) / 3)
  b.add('panel', g, { pos, rot: [0, rotY, 0], uv: { mode: 'native' } })
}

/** Stepped neck between two medallion cubes: fillets narrowing to a chamfered core and back. */
function neck(b: Builder, y: number, h: number, w: number) {
  const steps = [0.94, 0.84, 0.74]
  const sh = h * 0.13
  let yy = y
  for (const k of steps) {
    b.box('stone', [w * k, sh, w * k], [0, yy + sh / 2, 0])
    yy += sh
  }
  const core = h - sh * 6
  // chamfered (octagonal) core
  b.add('stone', new THREE.CylinderGeometry(w * 0.4, w * 0.4, core, 8), { pos: [0, yy + core / 2, 0], rot: [0, Math.PI / 8, 0] })
  yy += core
  for (const k of [...steps].reverse()) {
    b.box('stone', [w * k, sh, w * k], [0, yy + sh / 2, 0])
    yy += sh
  }
}

/** One temple pillar standing at the origin of the current group, beam bearing at HALL.beamY. */
function pillar(b: Builder, rand: () => number) {
  const W = 0.64
  const v = () => Math.floor(rand() * 3)
  b.box('stone', [W + 0.18, 0.1, W + 0.18], [0, 0.05, 0])
  panelBox(b, [W, 0.82, W], [0, 0.1 + 0.41, 0], v())
  neck(b, 0.92, 0.42, W)
  panelBox(b, [W * 0.95, 0.62, W * 0.95], [0, 1.34 + 0.31, 0], v())
  neck(b, 1.96, 0.42, W * 0.95)
  panelBox(b, [W * 0.92, 0.56, W * 0.92], [0, 2.38 + 0.28, 0], v())
  // neck and capital
  b.add('stone', new THREE.CylinderGeometry(W * 0.36, W * 0.38, 0.2, 8), { pos: [0, 3.04, 0], rot: [0, Math.PI / 8, 0] })
  b.box('stone', [W * 1.05, 0.08, W * 1.05], [0, 3.18, 0])
  // corbel brackets (potika), two stepped tiers, along both axes
  for (const [len, y, t] of [[1.0, 3.27, 0.11], [1.36, 3.42, 0.14]] as const) {
    b.box('stone', [len, t, 0.34], [0, y, 0])
    b.box('stone', [0.34, t, len * 0.8], [0, y, 0])
  }
  b.colliderBox([0, 1.8, 0], [W / 2, 1.8, W / 2])
}

export function buildHall(low: boolean) {
  const b = new Builder()
  const rand = seeded(1180)
  const H = HALL
  const len = H.start - H.end
  const midZ = (H.start + H.end) / 2

  // floor of the hall (on a low plinth) and the courtyard below it
  b.box('floor', [H.rowX + 0.6 - H.wallX, 0.3, len + 4], [(H.rowX + 0.6 + H.wallX) / 2, -0.15, midZ + 2], { uv: { mode: 'world', tile: 3.2 } })
  b.box('floor', [60, 0.3, 90], [H.rowX + 0.6 + 30, -0.6, midZ], { uv: { mode: 'world', tile: 3.2 } })
  // plinth edge moulding on the courtyard side
  b.box('stone', [0.12, 0.42, len + 4], [H.rowX + 0.64, -0.24, midZ + 2])
  b.box('stone', [0.2, 0.08, len + 4], [H.rowX + 0.62, -0.02, midZ + 2])

  // solid wall on the left, coursed ashlar, with a carved band
  b.box('ashlar', [0.5, H.ceilY + 0.3, len + 4], [H.wallX - 0.25, (H.ceilY + 0.3) / 2, midZ + 2], { uv: { mode: 'world', tile: 2.6 } })
  b.add('beam', new THREE.BoxGeometry(0.06, 0.32, len + 4), { pos: [H.wallX + 0.03, 2.55, midZ + 2], uv: { mode: 'frieze', y0: 2.39, h: 0.32 } })

  // two rows of pillars
  for (let i = 0; i < H.pairs; i++) {
    const z = H.start - 1.2 - i * H.spacing
    for (const x of [-H.rowX, H.rowX]) b.group([x, 0, z], 0, () => pillar(b, rand))
    // engaged pilasters on the wall opposite each left pillar
    b.group([H.wallX + 0.1, 0, z], 0, () => {
      b.box('stone', [0.2, H.beamY, 0.5], [0, H.beamY / 2, 0])
    })
  }

  // carved beams along each row and along the wall
  for (const x of [-H.rowX, H.rowX, H.wallX + 0.22]) {
    b.add('beam', new THREE.BoxGeometry(0.52, H.ceilY - H.beamY, len + 2), { pos: [x, (H.beamY + H.ceilY) / 2, midZ + 1], uv: { mode: 'frieze', y0: H.beamY, h: H.ceilY - H.beamY } })
  }
  // ceiling: long stone slabs laid across, each a little uneven
  // dark backing shows through the joints between slabs
  b.box('void', [H.rowX + 0.3 - H.wallX, 0.05, H.start - H.end + 1], [(H.rowX + 0.3 + H.wallX) / 2, H.ceilY + 0.24, (H.start + H.end) / 2])
  for (let z = H.start + 0.5; z > H.end; ) {
    const slab = 0.32 + rand() * 0.12
    const dy = (rand() - 0.5) * 0.03
    const w = H.rowX + 0.3 - H.wallX
    b.box('stone', [w, 0.2, slab - 0.03], [(H.rowX + 0.3 + H.wallX) / 2, H.ceilY + 0.1 + dy, z - slab / 2], { uv: { mode: 'world', tile: 2.2 + rand() } })
    z -= slab
  }
  // eave over the courtyard side
  b.box('stone', [0.9, 0.22, len + 2], [H.rowX + 0.45, H.ceilY + 0.24, midZ + 1])

  // far end: a wall with a stepped doorway into the chamber
  const D = H.door
  const endZ = H.end
  const wallW = H.rowX + 0.6 - H.wallX
  const cx = (H.rowX + 0.6 + H.wallX) / 2
  const sideW = (wallW - D.w) / 2
  b.box('ashlar', [sideW, H.ceilY, 0.6], [cx - D.w / 2 - sideW / 2, H.ceilY / 2, endZ], { uv: { mode: 'world', tile: 2.6 } })
  b.box('ashlar', [sideW, H.ceilY, 0.6], [cx + D.w / 2 + sideW / 2, H.ceilY / 2, endZ], { uv: { mode: 'world', tile: 2.6 } })
  b.box('ashlar', [D.w, H.ceilY - D.h, 0.6], [cx, D.h + (H.ceilY - D.h) / 2, endZ], { uv: { mode: 'world', tile: 2.6 } })
  // stepped frame (three receding jambs) and a threshold step
  for (let k = 0; k < 3; k++) {
    const o = 0.38 - k * 0.12
    const z = endZ + 0.32 + k * 0.06
    b.box('ashlar', [0.14, D.h + o, 0.1], [cx - D.w / 2 - o / 2 - 0.07, (D.h + o) / 2, z])
    b.box('ashlar', [0.14, D.h + o, 0.1], [cx + D.w / 2 + o / 2 + 0.07, (D.h + o) / 2, z])
    b.box('ashlar', [D.w + o + 0.28, 0.14, 0.1], [cx, D.h + o + 0.07, z])
  }
  b.box('stone', [D.w + 0.8, 0.12, 0.7], [cx, 0.06, endZ + 0.55])
  b.box('ashlar', [0.12, D.h, 1.6], [cx - D.w / 2 - 0.06, D.h / 2, endZ - 0.5])
  b.box('ashlar', [0.12, D.h, 1.6], [cx + D.w / 2 + 0.06, D.h / 2, endZ - 0.5])
  b.box('ashlar', [D.w + 0.4, 0.3, 1.6], [cx, D.h + 0.15, endZ - 0.5])
  b.box('floor', [D.w + 0.4, 0.12, 1.6], [cx, -0.06, endZ - 0.5])


  buildChamber(b)

  // across the courtyard: a matching colonnade, seen through the pillars as in the reference
  if (!low) {
    const X = 15
    b.box('floor', [5.5, 0.5, len + 30], [X + 1.2, -0.35, midZ + 6], { uv: { mode: 'world', tile: 3.2 } })
    for (let i = 0; i < H.pairs + 4; i++) {
      const z = H.start + 9 - i * H.spacing
      for (const x of [X, X + 2.6]) b.group([x, -0.1, z], Math.PI, () => pillar(b, rand))
    }
    for (const x of [X, X + 2.6]) b.add('beam', new THREE.BoxGeometry(0.52, 0.42, len + 30), { pos: [x, H.beamY + 0.1, midZ + 6], uv: { mode: 'frieze', y0: H.beamY - 0.1, h: 0.42 } })
    b.box('stone', [4.2, 0.3, len + 30], [X + 1.3, H.ceilY + 0.15, midZ + 6], { uv: { mode: 'world', tile: 3 } })
    b.box('ashlar', [0.5, H.ceilY + 0.6, len + 30], [X + 3.6, (H.ceilY + 0.6) / 2 - 0.3, midZ + 6], { uv: { mode: 'world', tile: 2.6 } })
  }
  return b
}

/** Where the walker is along the hall: progress 0..1 → camera position and look target. */
export function hallCamera(p: number, t: number, still: boolean) {
  const z0 = HALL.start + 3
  const z1 = HALL.end + 2.6
  const z = z0 + (z1 - z0) * p
  const sway = still ? 0 : 1
  const x = 0.15 + Math.sin(p * 5.5) * 0.12 * sway + Math.sin(t * 0.35) * 0.02 * sway
  const y = 1.62 + Math.sin(t * 0.6) * 0.012 * sway
  return {
    pos: new THREE.Vector3(x, y, z),
    look: new THREE.Vector3(0.05 + Math.sin(t * 0.21) * 0.05 * sway, 1.52, z - 8),
  }
}
