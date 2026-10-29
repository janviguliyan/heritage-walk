import * as THREE from 'three'
import type { Builder, V3 } from './builder'
import type { MatKey } from './materials'
import { amalakaGeometry, kalashaGeometry } from './geometry'
import { figureStatue, gajaSimhaStatue, horseStatue, POSES, suryaStatue } from './statues'

// Parametric temple parts. Every function draws in the builder's current group frame;
// "local +X" is the part's front unless noted. 1 unit = 1 m.

export function friezeBox(b: Builder, size: V3, pos: V3, rotY = 0) {
  b.add('frieze', new THREE.BoxGeometry(...size), {
    pos,
    rot: [0, rotY, 0],
    uv: { mode: 'frieze', y0: pos[1] - size[1] / 2, h: size[1] },
  })
}

export interface Moulding {
  h: number
  /** positive = recessed from the nominal face, negative = projecting */
  inset: number
  mat: MatKey
}

/** Stacked mouldings of a Kalinga temple base (pabhaga), bottom to top. Heights are relative and get scaled. */
export const BASE_PROFILE: Moulding[] = [
  { h: 0.45, inset: -0.35, mat: 'khondalite' },
  { h: 0.3, inset: -0.15, mat: 'khondalite' },
  { h: 1.1, inset: 0.12, mat: 'frieze' },
  { h: 0.25, inset: -0.1, mat: 'khondalite' },
  { h: 1.2, inset: 0.18, mat: 'frieze' },
  { h: 0.3, inset: -0.05, mat: 'khondalite' },
  { h: 0.6, inset: 0.12, mat: 'frieze' },
  { h: 0.3, inset: -0.25, mat: 'khondalite' },
]

/** Plinth / platform: a stack of mouldings over a rectangle centred at the local origin, from y=0 to y=h. */
export function plinth(b: Builder, lx: number, lz: number, h: number, profile = BASE_PROFILE, collide = true) {
  const total = profile.reduce((s, m) => s + m.h, 0)
  let y = 0
  for (const m of profile) {
    const hh = (m.h / total) * h
    const size: V3 = [lx - 2 * m.inset, hh, lz - 2 * m.inset]
    const pos: V3 = [0, y + hh / 2, 0]
    if (m.mat === 'frieze') friezeBox(b, size, pos)
    else b.box(m.mat, size, pos)
    y += hh
  }
  if (collide) {
    const top = profile[profile.length - 1]
    b.colliderBox([0, h / 2, 0], [lx / 2 - top.inset, h / 2, lz / 2 - top.inset])
  }
}

/** Stairs ascending along local +X from the origin (bottom front edge centre). Walkable ramp collider. */
export function stairs(b: Builder, run: number, rise: number, width: number, mat: MatKey = 'khondalite') {
  const n = Math.max(2, Math.round(rise / 0.28))
  for (let i = 0; i < n; i++) {
    const h = ((i + 1) / n) * rise
    b.box(mat, [run / n, h, width], [((i + 0.5) / n) * run, h / 2, 0])
  }
  // side cheeks
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const h = ((i + 1) / 4) * rise + 0.5
      b.box('khondalite', [run / 4, h, 0.6], [((i + 0.5) / 4) * run, h / 2, s * (width / 2 + 0.3)], { collide: true })
    }
  }
  const w = width / 2
  b.colliderHull([
    [-0.05, 0, -w],
    [-0.05, 0, w],
    // a short flat landing past the top covers any lip where the ramp meets the platform
    [run + 0.8, 0, -w],
    [run + 0.8, 0, w],
    [run + 0.8, rise, -w],
    [run + 0.8, rise, w],
    [run, rise, -w],
    [run, rise, w],
    [-0.05, 0.02, -w],
  ])
}

/** Square pillar on a base; `broken` gives an irregular snapped top. */
export function pillar(b: Builder, pos: V3, h: number, w = 1.4, broken = false, rand = Math.random) {
  b.group(pos, 0, () => {
    b.box('khondalite', [w + 0.4, 0.45, w + 0.4], [0, 0.225, 0])
    const shaft = broken ? h - 0.45 : h - 0.95
    friezeBox(b, [w, shaft, w], [0, 0.45 + shaft / 2, 0])
    if (broken) {
      b.add('khondalite', new THREE.BoxGeometry(w * 0.7, 0.4, w * 0.6), {
        pos: [(rand() - 0.5) * 0.3, h + 0.1, (rand() - 0.5) * 0.3],
        rot: [rand() * 0.3, rand(), rand() * 0.3],
      })
    } else {
      b.box('khondalite', [w + 0.3, 0.3, w + 0.3], [0, h - 0.35, 0])
      b.box('khondalite', [w + 0.6, 0.2, w + 0.6], [0, h - 0.1, 0])
    }
    b.colliderBox([0, h / 2, 0], [w / 2 + 0.2, h / 2, w / 2 + 0.2])
  })
}

export interface PidhaOpts {
  /** base width (square) */
  w: number
  /** number of pidha slabs in each tier */
  tiers: number[]
  slab?: number
  recess?: number
  step?: number
  kanti?: number
  /** add musician figures on the terraces between tiers */
  figures?: boolean
  crown?: boolean
}

/** Stepped (pidha) pyramid roof from y=0; returns its height including the crown. */
export function pidhaRoof(b: Builder, o: PidhaOpts) {
  const slab = o.slab ?? 0.5
  const recess = o.recess ?? 0.3
  const step = o.step ?? 1.1
  const kanti = o.kanti ?? 1.8
  let w = o.w
  let y = 0
  o.tiers.forEach((count, t) => {
    for (let i = 0; i < count; i++) {
      b.box('khondalite', [w, slab, w], [0, y + slab / 2, 0])
      // slight upturned corners of the slab
      b.box('khondalite', [w - 0.5, recess, w - 0.5], [0, y + slab + recess / 2, 0])
      y += slab + recess
      w -= step
    }
    if (t < o.tiers.length - 1) {
      const kw = w - 1.2
      friezeBox(b, [kw, kanti, kw], [0, y + kanti / 2, 0])
      if (o.figures) {
        const r = kw / 2 + 0.25
        for (let k = 0; k < 4; k++) {
          for (const off of [-0.32, 0.32]) {
            const a = (k * Math.PI) / 2
            const along = off * kw
            b.group([Math.cos(a) * r - Math.sin(a) * along, y, -Math.sin(a) * r - Math.cos(a) * along], a, () => figure(b, 1.7))
          }
        }
      }
      y += kanti
      w -= 1.6
    }
  })
  if (o.crown !== false) {
    const bw = Math.max(2, w * 0.75)
    b.box('khondalite', [bw, 1.1, bw], [0, y + 0.55, 0])
    y += 1.1
    const R = Math.min(4.2, Math.max(0.5, w * 0.38))
    const H = R * 0.42
    b.add('khondalite', amalakaGeometry(R, H), { pos: [0, y, 0] })
    y += H
    b.add('khondalite', new THREE.SphereGeometry(R * 0.55, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), {
      pos: [0, y - 0.05, 0],
      scale: [1, 0.35, 1],
    })
    y += R * 0.18
    const KH = R * 0.75
    b.add('khondalite', kalashaGeometry(R * 0.32, KH), { pos: [0, y, 0] })
    y += KH
  }
  return y
}

let figureCount = 0
/** Restart the pose sequence: every build of a scene must place the same figures. */
export const resetFigures = () => {
  figureCount = 0
}
/** A standing musician or maiden, ~h tall, facing local +X (poses cycle). */
export function figure(b: Builder, h: number) {
  const pose = POSES[figureCount++ % POSES.length]
  b.add('carved', figureStatue(pose, Math.round(h * 20) / 20).clone(), {})
}

/** A Konark horse in harness on its pedestal, facing local +X. Broken parts optional. */
export function horse(b: Builder, broken: { head?: boolean; forelegs?: boolean } = {}) {
  b.box('khondalite', [3.6, 0.7, 1.6], [0, 0.35, 0])
  b.box('khondalite', [3.8, 0.15, 1.8], [0, 0.72, 0])
  const v = broken.forelegs ? 'broken' : broken.head ? 'nohead' : 'whole'
  b.add('carved', horseStatue(v).clone(), { pos: [0, 0.78, 0] })
  b.colliderBox([0, 1.9, 0], [1.9, 1.9, 0.8])
}

/** Gaja-simha: a lion rampant over a crouching elephant, on a pedestal, facing local +X. */
export function gajaSimha(b: Builder) {
  b.box('khondalite', [4.2, 1.4, 2.2], [0, 0.7, 0])
  b.box('khondalite', [4.5, 0.25, 2.5], [0, 1.45, 0])
  b.add('carved', gajaSimhaStatue().clone(), { pos: [-0.2, 1.55, 0] })
  b.colliderBox([0, 2.5, 0], [2.25, 2.5, 1.25])
}

/** Niche framing on a wall face at local x=0 (wall behind, -X). Returns nothing; the figure goes at the origin. */
export function niche(b: Builder, w: number, h: number) {
  const m: MatKey = 'khondalite'
  // 2 cm proud of the wall it is set into, so the two faces never fight for the same depth
  b.box('recess', [0.5, h, w], [-0.23, h / 2, 0])
  b.box(m, [0.5, h + 0.4, 0.45], [0.2, (h + 0.4) / 2, w / 2 + 0.22])
  b.box(m, [0.5, h + 0.4, 0.45], [0.2, (h + 0.4) / 2, -w / 2 - 0.22])
  b.box(m, [0.7, 0.35, w + 1.2], [0.25, -0.17, 0])
  b.box(m, [0.6, 0.4, w + 1.0], [0.2, h + 0.6, 0])
  for (let i = 0; i < 3; i++) b.box(m, [0.5 - i * 0.1, 0.3, w + 0.6 - i * 0.6], [0.15, h + 0.95 + i * 0.32, 0])
}

/** Surya image in chlorite, ~3.4 m tall, facing local +X: on a pedestal with seven small horses. */
export function surya(b: Builder) {
  b.add('chlorite', suryaStatue().clone(), {})
}

/** Broken wall: segments of varied height between local x0..x1 at z, with rubble on top. */
export function ruinWall(
  b: Builder,
  x0: number,
  x1: number,
  z: number,
  thick: number,
  minH: number,
  maxH: number,
  segs: number,
  rand: () => number,
  mat: MatKey = 'khondalite',
) {
  const len = (x1 - x0) / segs
  for (let i = 0; i < segs; i++) {
    const h = minH + (maxH - minH) * rand()
    const cx = x0 + (i + 0.5) * len
    b.box(mat, [len + 0.02, h, thick], [cx, h / 2, z], { collide: true })
    for (let k = 0; k < 2; k++) {
      const s = 0.5 + rand() * 0.7
      b.add(mat, new THREE.BoxGeometry(s * 1.6, s * 0.7, s), {
        pos: [cx + (rand() - 0.5) * len * 0.6, h + s * 0.25, z + (rand() - 0.5) * thick * 0.5],
        rot: [(rand() - 0.5) * 0.4, rand() * 3, (rand() - 0.5) * 0.4],
      })
    }
  }
}

/** Loose fallen blocks scattered in a rectangle; big ones collide. */
export function rubble(b: Builder, cx: number, cz: number, sx: number, sz: number, count: number, rand: () => number, mat: MatKey = 'khondalite') {
  for (let i = 0; i < count; i++) {
    const s = 0.4 + rand() * 1.1
    const x = cx + (rand() - 0.5) * sx
    const z = cz + (rand() - 0.5) * sz
    const rotY = rand() * Math.PI
    b.add(mat, new THREE.BoxGeometry(s * 1.5, s * 0.8, s), {
      pos: [x, s * 0.32, z],
      rot: [(rand() - 0.5) * 0.25, rotY, (rand() - 0.5) * 0.25],
    })
    if (s > 0.9) b.colliderBox([x, s * 0.4, z], [s * 0.7, s * 0.4, s * 0.45], rotY)
  }
}

/** Gate tower: laterite block with a small pidha cap, centred at origin. */
export function gateTower(b: Builder, w: number, h: number) {
  b.box('laterite', [w, h, w], [0, h / 2, 0], { collide: true })
  b.box('khondalite', [w + 0.5, 0.4, w + 0.5], [0, h + 0.2, 0])
  b.group([0, h + 0.4, 0], 0, () => pidhaRoof(b, { w: w - 0.2, tiers: [3], slab: 0.35, recess: 0.2, step: 0.7 }))
}

/** Low perimeter wall from (x0,z0) to (x1,z1), axis-aligned. */
export function wall(b: Builder, x0: number, z0: number, x1: number, z1: number, h: number, thick: number, mat: MatKey = 'laterite') {
  const cx = (x0 + x1) / 2
  const cz = (z0 + z1) / 2
  const lx = Math.abs(x1 - x0) || thick
  const lz = Math.abs(z1 - z0) || thick
  b.box(mat, [lx, h, lz], [cx, h / 2, cz], { collide: true })
  b.box(mat, [lx + (lx === thick ? 0.3 : 0), 0.25, lz + (lz === thick ? 0.3 : 0)], [cx, h + 0.12, cz])
}
