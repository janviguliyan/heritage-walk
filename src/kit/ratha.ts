import * as THREE from 'three'
import type { Builder, V3 } from './builder'
import type { MatKey } from './materials'
import { amalakaGeometry, kalashaGeometry } from './geometry'
import { lionStatue, POSES, reliefFigure, warElephantStatue, warHorseStatue } from './statues'

// Kalinga temples are not plain boxes: each face steps forward in vertical projections
// (rathas). A pancharatha plan has a wide central raha, a pair of anurathas, and corner
// kanikas. These helpers draw any horizontal course in that plan, so walls, mouldings,
// roof slabs and bands all share the same stepped silhouette. Local +X/-X/+Z/-Z are faces.

export interface RathaPlan {
  /** fraction of the face width taken by the central raha */
  raha: number
  /** how far the raha projects (m) */
  rahaOut: number
  /** fraction of the face width for each anuratha (placed beside the raha) */
  anu: number
  anuOut: number
}
export const PANCHARATHA: RathaPlan = { raha: 0.34, rahaOut: 0.9, anu: 0.14, anuOut: 0.45 }

/** One course of a stepped (ratha) plan, square of side w, from y to y+h; `grow` pads every edge. */
export function rathaCourse(b: Builder, mat: MatKey, w: number, y: number, h: number, grow = 0, plan = PANCHARATHA, uvTile?: number) {
  const add = (size: V3, pos: V3) => {
    if (mat === 'frieze') b.add('frieze', new THREE.BoxGeometry(...size), { pos, uv: { mode: 'frieze', y0: y, h } })
    else b.add(mat, new THREE.BoxGeometry(...size), { pos, uv: uvTile ? { mode: 'world', tile: uvTile } : undefined })
  }
  const W = w + grow * 2
  add([W, h, W], [0, y + h / 2, 0])
  const rw = w * plan.raha + grow * 2
  const aw = w * plan.anu + grow * 2
  const aOff = w * (plan.raha / 2 + plan.anu / 2 + 0.02)
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2
    const c = Math.cos(a)
    const s = Math.sin(a)
    // face normal is (c, 0, -s); along-face direction is (s, 0, c)
    const place = (out: number, width: number, along: number) => {
      const depth = out * 2
      const d = w / 2 - out / 2 + out
      const px = c * (d - out / 2) + s * along
      const pz = -s * (d - out / 2) + c * along
      const sx = Math.abs(c) > 0.5 ? depth : width
      const sz = Math.abs(c) > 0.5 ? width : depth
      add([sx + (Math.abs(c) > 0.5 ? grow : 0), h, sz + (Math.abs(c) > 0.5 ? 0 : grow)], [px, y + h / 2, pz])
    }
    place(plan.rahaOut + grow, rw, 0)
    place(plan.anuOut + grow, aw, aOff)
    place(plan.anuOut + grow, aw, -aOff)
  }
}

/** Outer half-width including the raha projection. */
export const rathaReach = (w: number, plan = PANCHARATHA) => w / 2 + plan.rahaOut

/** A rampant lion (jhapa-simha) leaping from the roof, ~h tall, facing local +X. */
export function lion(b: Builder, h = 3) {
  b.add('carved', lionStatue().clone(), { scale: [h / 2.4, h / 2.4, h / 2.4] })
}

export interface PidhaDeulOpts {
  w: number
  tiers: number[]
  slab?: number
  gap?: number
  step?: number
  kanthi?: number
  figures?: boolean
  lions?: boolean
}

/** A pidha roof in pancharatha plan: slabs with carved fascias, terraces of musicians, lions on the raha, crown. */
export function pidhaRathaRoof(b: Builder, o: PidhaDeulOpts, figure: (b: Builder, h: number) => void) {
  const slab = o.slab ?? 0.55
  const gap = o.gap ?? 0.28
  const step = o.step ?? 0.95
  const kanthi = o.kanthi ?? 2.0
  let w = o.w
  let y = 0
  o.tiers.forEach((count, t) => {
    for (let i = 0; i < count; i++) {
      // the slab: a carved fascia under a rounded drip that overhangs it (three thin courses
      // stepping out and back), so each slab reads as one heavy, shadow-casting band
      rathaCourse(b, 'frieze', w, y, slab * 0.6, 0)
      rathaCourse(b, 'khondalite', w, y + slab * 0.6, slab * 0.12, 0.1)
      rathaCourse(b, 'khondalite', w, y + slab * 0.72, slab * 0.16, 0.2)
      rathaCourse(b, 'khondalite', w, y + slab * 0.88, slab * 0.12, 0.12)
      // on each raha, a miniature shrine (pidha-mundi) standing proud of the fascia
      for (let k = 0; k < 4; k++)
        b.group([0, 0, 0], (k * Math.PI) / 2, () => {
          const [fx] = rathaSegments(w)[0]
          const mw = Math.min(1.4, w * 0.1)
          b.box('khondalite', [0.36, slab * 0.5, mw], [fx + 0.16, y + slab * 0.3, 0])
          b.box('recess', [0.1, slab * 0.32, mw * 0.4], [fx + 0.3, y + slab * 0.28, 0])
          b.add('khondalite', new THREE.CylinderGeometry(mw * 0.36, mw * 0.36, 0.38, 12, 1, false, 0, Math.PI), { pos: [fx + 0.16, y + slab * 0.55, 0], rot: [0, Math.PI / 2, Math.PI / 2] })
        })
      rathaCourse(b, 'recess', w - 0.9, y + slab, gap, 0)
      y += slab + gap
      w -= step
    }
    if (t < o.tiers.length - 1) {
      const kw = w - 1.4
      // the kanthi between tiers: a recessed band carved with figures, not a dark gap
      rathaCourse(b, 'frieze', kw, y, kanthi, 0)
      rathaCourse(b, 'khondalite', kw + 0.4, y, 0.25, 0)
      if (o.figures) {
        const r = kw / 2 + 0.4
        for (let k = 0; k < 4; k++) {
          for (const off of [-0.36, -0.12, 0.12, 0.36]) {
            const a = (k * Math.PI) / 2
            const along = off * kw
            b.group([Math.cos(a) * r - Math.sin(a) * along, y + 0.25, -Math.sin(a) * r - Math.cos(a) * along], a, () => figure(b, 1.75))
          }
        }
      }
      if (o.lions) {
        // a great lion leaping out from the raha of each face
        for (let k = 0; k < 4; k++) {
          const a = (k * Math.PI) / 2
          const r = rathaReach(w) + 0.6
          b.group([Math.cos(a) * r, y - 0.2, -Math.sin(a) * r], a, () => lion(b, 3.2))
        }
      }
      y += kanthi
      w -= 1.4
    }
  })
  // beki (neck), bell-shaped ghanta, amalaka and kalasha
  const bw = Math.max(2.4, w * 0.7)
  rathaCourse(b, 'recess', bw, y, 1.0, 0)
  y += 1.0
  const ghR = w * 0.42
  const ghanta = new THREE.LatheGeometry(
    [new THREE.Vector2(ghR, 0), new THREE.Vector2(ghR * 1.02, 0.4), new THREE.Vector2(ghR * 0.92, 1.2), new THREE.Vector2(ghR * 0.62, 2.0), new THREE.Vector2(ghR * 0.3, 2.4), new THREE.Vector2(0.01, 2.5)],
    32,
  )
  b.add('khondalite', ghanta, { pos: [0, y, 0], uv: { mode: 'world', tile: 3 } })
  // ribs on the ghanta
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    b.add('khondalite', new THREE.BoxGeometry(0.22, 1.8, 0.22), { pos: [Math.cos(a) * ghR * 0.84, y + 1.0, Math.sin(a) * ghR * 0.84], rot: [Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45] })
  }
  y += 2.2
  const R = Math.min(3.4, ghR * 0.5)
  b.add('khondalite', new THREE.CylinderGeometry(R * 0.4, R * 0.45, 0.5, 16), { pos: [0, y + 0.25, 0] })
  y += 0.5
  b.add('khondalite', amalakaGeometry(R, R * 0.42), { pos: [0, y, 0] })
  y += R * 0.42
  b.add('khondalite', kalashaGeometry(R * 0.3, R * 0.8), { pos: [0, y, 0] })
  y += R * 0.8
  return y
}

/** The colossal war horse of Konark's south side, on its pedestal. Faces local +X. */
export function warHorse(b: Builder) {
  b.box('khondalite', [5.2, 1.2, 2.4], [0, 0.6, 0])
  b.box('khondalite', [5.5, 0.25, 2.7], [0, 1.32, 0])
  b.add('carved', warHorseStatue().clone(), { pos: [-0.3, 1.45, -0.2], scale: [1.35, 1.35, 1.35] })
  b.colliderBox([0, 2.5, 0], [2.8, 2.5, 1.4])
}

/** The colossal war elephant of the north side, on its pedestal. Faces local +X. */
export function warElephant(b: Builder) {
  b.box('khondalite', [5.4, 1.2, 2.8], [0, 0.6, 0])
  b.box('khondalite', [5.7, 0.25, 3.1], [0, 1.32, 0])
  b.add('carved', warElephantStatue().clone(), { pos: [-0.3, 1.45, 0] })
  b.colliderBox([0, 2.5, 0], [3, 2.5, 1.6])
}

/** A richly carved pillar for the nata mandir: banded shaft with figures, square capital; broken optional. */
export function carvedPillar(b: Builder, h: number, broken: boolean, rand: () => number) {
  b.box('khondalite', [1.9, 0.35, 1.9], [0, 0.17, 0])
  b.box('khondalite', [1.7, 0.25, 1.7], [0, 0.47, 0])
  const shaft = broken ? h : h - 0.8
  // shaft in the pancharatha section: core plus a projection on each face
  const y0 = 0.6
  b.add('frieze', new THREE.BoxGeometry(1.3, shaft, 1.3), { pos: [0, y0 + shaft / 2, 0], uv: { mode: 'frieze', y0, h: Math.min(shaft, 1.6) } })
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2
    b.add('frieze', new THREE.BoxGeometry(0.2, shaft, 0.6), { pos: [Math.cos(a) * 0.72, y0 + shaft / 2, -Math.sin(a) * 0.72], rot: [0, a, 0], uv: { mode: 'frieze', y0: y0 + 0.4, h: Math.min(shaft, 1.6) } })
  }
  for (const t of [0.3, 0.62]) if (t * shaft < shaft - 0.3) b.box('khondalite', [1.55, 0.18, 1.55], [0, y0 + shaft * t, 0])
  if (!broken) {
    b.box('khondalite', [1.6, 0.35, 1.6], [0, y0 + shaft + 0.17, 0])
    b.box('khondalite', [2.0, 0.3, 2.0], [0, y0 + shaft + 0.5, 0])
  } else {
    b.add('khondalite', new THREE.BoxGeometry(1.0, 0.45, 0.8), { pos: [(rand() - 0.5) * 0.3, y0 + shaft + 0.1, (rand() - 0.5) * 0.3], rot: [rand() * 0.3, rand(), rand() * 0.3] })
  }
  b.colliderBox([0, (y0 + shaft) / 2, 0], [0.95, (y0 + shaft) / 2, 0.95])
}

/** The face segments of a stepped plan, for the +X face: [face offset, centre along, length]. */
export function rathaSegments(w: number, plan = PANCHARATHA): [number, number, number][] {
  const rw = w * plan.raha
  const aw = w * plan.anu
  const aOff = w * (plan.raha / 2 + plan.anu / 2 + 0.02)
  const kStart = aOff + aw / 2
  const kLen = w / 2 - kStart
  return [
    [w / 2 + plan.rahaOut, 0, rw],
    [w / 2 + plan.anuOut, aOff, aw],
    [w / 2 + plan.anuOut, -aOff, aw],
    [w / 2, kStart + kLen / 2, kLen],
    [w / 2, -(kStart + kLen / 2), kLen],
  ]
}

/**
 * One storey of carved wall on all four faces of a stepped plan: along every projection a
 * rhythm of niches holding figures in deep relief, miniature shrines (khakhara-mundi) and
 * pilasters with lattice panels — chosen and posed at random, so no two bays repeat.
 * `door` keeps the middle of the raha clear on the faces that have doorways (all but west).
 */
export function carvedTier(b: Builder, w: number, y: number, h: number, rand: () => number, o: { door?: number; doorFaces?: number[]; ruined?: boolean } = {}) {
  const doorFaces = o.doorFaces ?? [0, 1, 3]
  const segs = rathaSegments(w)
  for (let k = 0; k < 4; k++) {
    b.group([0, 0, 0], (k * Math.PI) / 2, () => {
      segs.forEach(([fx, c0, len], si) => {
        const n = Math.max(1, Math.round(len / 1.3))
        const step = len / n
        for (let i = 0; i < n; i++) {
          const c = c0 - len / 2 + step * (i + 0.5)
          if (o.door && doorFaces.includes(k) && si === 0 && Math.abs(c) < o.door) continue
          const r = rand()
          // a ruin keeps its lower walls; some bays have lost their tops
          const hh = o.ruined ? h * (0.55 + rand() * 0.45) : h
          bay(b, fx, y, hh, c, step, r < 0.56 ? 'niche' : r < 0.8 ? 'shrine' : 'jali', rand)
          if (o.ruined) {
            const s = 0.4 + rand() * 0.6
            b.add('khondalite', new THREE.BoxGeometry(0.5 + rand() * 0.6, s * 0.5, step * 0.7), { pos: [fx - 0.2, y + hh + 0.1, c], rot: [(rand() - 0.5) * 0.3, (rand() - 0.5) * 0.4, (rand() - 0.5) * 0.3] })
          }
        }
      })
    })
  }
}

function bay(b: Builder, fx: number, y: number, h: number, c: number, step: number, kind: 'niche' | 'shrine' | 'jali', rand: () => number) {
  const ew = step * 0.86
  // base and cap mouldings of the bay
  b.box('khondalite', [0.26, 0.14, ew], [fx + 0.05, y + 0.07, c])
  if (kind === 'niche') {
    // a deep niche: its frame (pilasters, lintel, stepped crown) stands ~30 cm proud of the wall
    b.box('recess', [0.12, h * 0.74, ew * 0.66], [fx - 0.02, y + 0.14 + h * 0.37, c])
    for (const s of [-1, 1]) {
      // banded pilasters: the frieze stacked in short courses up the shaft
      b.add('frieze', new THREE.BoxGeometry(0.34, h * 0.76, ew * 0.13), { pos: [fx + 0.13, y + 0.14 + h * 0.38, c + s * ew * 0.4], uv: { mode: 'frieze', y0: y + 0.14, h: 0.32 } })
      b.box('khondalite', [0.38, 0.08, ew * 0.17], [fx + 0.15, y + 0.14 + h * 0.76, c + s * ew * 0.4])
      b.box('khondalite', [0.38, 0.1, ew * 0.17], [fx + 0.15, y + 0.19, c + s * ew * 0.4])
    }
    b.add('frieze', new THREE.BoxGeometry(0.32, 0.16, ew * 0.94), { pos: [fx + 0.14, y + 0.14 + h * 0.76 + 0.08, c], uv: { mode: 'frieze', y0: y + 0.14 + h * 0.76, h: 0.16 } })
    // a stepped crown over the niche (a small pidha), with a kalasha
    for (let j = 0; j < 3; j++) b.box('khondalite', [0.36 - j * 0.06, 0.1, ew * (0.9 - j * 0.18)], [fx + 0.13 - j * 0.02, y + 0.14 + h * 0.77 + 0.16 + j * 0.1 + 0.05, c])
    b.add('khondalite', new THREE.SphereGeometry(0.07, 8, 6), { pos: [fx + 0.1, y + 0.14 + h * 0.77 + 0.54, c] })
    const fh = Math.round(h * 0.6 * 20) / 20
    const pose = POSES[Math.floor(rand() * POSES.length)]
    b.add('carved', reliefFigure(pose, fh).clone(), { pos: [fx - 0.02, y + 0.16, c], rot: [0, (rand() - 0.5) * 0.25, 0] })
  } else if (kind === 'shrine') {
    // khakhara-mundi: a shrine in miniature — base, body with a small niche, wagon-vault roof
    const bw = ew * 0.78
    b.box('khondalite', [0.3, h * 0.12, bw], [fx + 0.08, y + 0.14 + h * 0.06, c])
    b.box('khondalite', [0.24, h * 0.42, bw * 0.9], [fx + 0.05, y + 0.14 + h * 0.33, c])
    b.box('recess', [0.12, h * 0.26, bw * 0.4], [fx + 0.12, y + 0.14 + h * 0.32, c])
    b.box('khondalite', [0.3, 0.1, bw], [fx + 0.08, y + 0.14 + h * 0.55, c])
    b.add('khondalite', new THREE.CylinderGeometry(bw * 0.28, bw * 0.28, 0.3, 14, 1, false, 0, Math.PI), { pos: [fx + 0.06, y + 0.14 + h * 0.6, c], rot: [0, Math.PI / 2, Math.PI / 2] })
    for (const s of [-1, 0, 1]) b.add('khondalite', new THREE.ConeGeometry(0.05, 0.16, 8), { pos: [fx + 0.06, y + 0.14 + h * 0.6 + bw * 0.28 + 0.06, c + s * bw * 0.22] })
    // and above it, a lotus-medallion panel
    b.add('khondalite', new THREE.CylinderGeometry(bw * 0.2, bw * 0.2, 0.08, 16), { pos: [fx + 0.04, y + 0.14 + h * 0.84, c], rot: [0, 0, Math.PI / 2] })
  } else {
    // pilaster flanked by lattice (jali) panels
    b.box('khondalite', [0.22, h * 0.86, ew * 0.24], [fx + 0.07, y + 0.14 + h * 0.43, c])
    for (const s of [-1, 1]) b.box('frieze', [0.05, h * 0.8, ew * 0.3], [fx + 0.02, y + 0.14 + h * 0.4, c + s * ew * 0.3])
    for (let j = 0; j < 4; j++) b.box('khondalite', [0.25, 0.06, ew * 0.28], [fx + 0.08, y + 0.14 + h * (0.12 + j * 0.24), c])
  }
}
