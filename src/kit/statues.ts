import type * as THREE from 'three'
import { BufferGeometry, Float32BufferAttribute } from 'three'
import { Sculpt, type V } from './sculpt'

// Konark's sculpture, sculpted as smooth forms (see sculpt.ts). Every statue faces local +X,
// stands on y = 0 and is built once, then placed by the scene. Proportions follow the
// surviving pieces: harnessed horses heavy with jewellery, the colossal war horse and war
// elephant, rampant lions, and the musicians and maidens of the walls and terraces.

const cache = new Map<string, THREE.BufferGeometry>()
let skip = false
/** While set, statues come back as empty placeholders (for builds that discard sculpture). */
export const skipSculpture = (v: boolean) => {
  skip = v
}
const once = (key: string, make: () => THREE.BufferGeometry) => {
  if (skip && !cache.has(key)) {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3))
    g.setAttribute('normal', new Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3))
    return g
  }
  let g = cache.get(key)
  if (!g) cache.set(key, (g = make()))
  return g
}


/** where the neck band sits: on the neck's axis, 60% of the way up */
const NECK_BAND: V = [1.148, 2.33, 0]

/** A harnessed Konark horse. pose: 'stride' (one foreleg raised) or 'rear'. */
function horseForm(f: Sculpt, o: { pose?: 'stride' | 'rear'; head?: boolean; forelegs?: boolean } = {}) {
  const rear = o.pose === 'rear'
  const lift = rear ? 0.35 : 0
  // body: barrel, deep chest, rounded haunch and croup, withers
  f.ellipsoid([0, 1.55 + lift * 0.4, 0], [1.0, 0.52, 0.46], [0, 0, lift * 0.35], 0.18)
  f.ellipsoid([0.82, 1.68 + lift, 0], [0.5, 0.6, 0.45], [0, 0, 0.2], 0.16)
  f.ellipsoid([-0.82, 1.68, 0], [0.56, 0.58, 0.47], [0, 0, 0], 0.16)
  f.sphere([-0.95, 1.95, 0], 0.36, 0.14)
  f.ellipsoid([0.6, 2.02 + lift * 0.8, 0], [0.38, 0.24, 0.24], [0, 0, 0.3], 0.12)
  // neck, arched, and the crest of the mane
  const n0: V = [0.95, 2.0 + lift, 0]
  const n1: V = [1.28, 2.55 + lift, 0]
  const n2: V = [1.42, 2.88 + lift, 0]
  f.chain([n0, n1, n2], [0.36, 0.27, 0.2], 0.12)
  // strands of the mane falling to both sides of the crest
  for (let i = 0; i < 14; i++) {
    const t = i / 13
    for (const sd of [-1, 1]) f.limb([0.86 + t * 0.48, 2.22 + lift + t * 0.78, 0.02 * sd], [0.92 + t * 0.48, 2.0 + lift + t * 0.74, 0.16 * sd], 0.022, 0.012, 0.012)
  }
  for (let i = 0; i < 7; i++) {
    const t = i / 6
    f.ellipsoid([0.88 + t * 0.48 - 0.12, 2.15 + lift + t * 0.8 + 0.14, 0], [0.16, 0.11, 0.09], [0, 0, 0.9], 0.06)
    for (const s of [-1, 1]) f.ellipsoid([0.88 + t * 0.48 - 0.06, 2.05 + lift + t * 0.8, 0.13 * s], [0.12, 0.16, 0.04], [0.3 * s, 0, 0.5], 0.05)
  }
  if (o.head !== false) {
    // head: wide jaw tapering to the muzzle; ears, eyes, nostrils
    f.ellipsoid([1.48, 2.82 + lift, 0], [0.2, 0.17, 0.15], [0, 0, -0.6], 0.08)
    f.limb([1.5, 2.8 + lift, 0], [1.86, 2.35 + lift, 0], 0.17, 0.12, 0.08)
    f.sphere([1.88, 2.31 + lift, 0], 0.13, 0.05)
    for (const s of [-1, 1]) {
      f.limb([1.4, 2.98 + lift, 0.08 * s], [1.36, 3.2 + lift, 0.1 * s], 0.05, 0.015, 0.03)
      // the eye: a socket under a bony brow, a rounded eyeball
      f.sphere([1.56, 2.82 + lift, 0.14 * s], 0.045).cut(0.015)
      f.ellipsoid([1.565, 2.82 + lift, 0.128 * s], [0.028, 0.022, 0.018], [0, 0, 0], 0.006)
      f.ellipsoid([1.53, 2.87 + lift, 0.14 * s], [0.05, 0.018, 0.03], [0, 0, -0.5], 0.015)
      f.sphere([1.95, 2.3 + lift, 0.07 * s], 0.03).cut(0.01)
      // flared nostril rim
      f.torus([1.94, 2.3 + lift, 0.075 * s], 0.032, 0.008, [Math.PI / 2, 0, 0], 0.006)
      // bridle: cheek straps and jewelled browband
      f.limb([1.5, 2.95 + lift, 0.14 * s], [1.78, 2.42 + lift, 0.13 * s], 0.022, 0.022, 0.01)
    }
    f.torus([1.75, 2.48 + lift, 0], 0.15, 0.025, [0, 0, Math.PI / 2 - 0.9], 0.01)
    // the line of the mouth, the bit and a jewelled rosette on the cheek strap
  {
    // a jewelled band round the neck (it also hides where the finer head mesh begins)
    const c: V = [NECK_BAND[0], NECK_BAND[1] + lift, NECK_BAND[2]]
    f.torus(c, 0.31, 0.042, [0, 0, -0.54], 0.012)
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2
      const r = 0.34
      f.sphere([c[0] + Math.cos(a) * r * 0.857, c[1] - Math.cos(a) * r * 0.514, c[2] + Math.sin(a) * r], 0.028, 0.008)
    }
  }
    f.limb([1.72, 2.36 + lift, 0.0], [1.95, 2.24 + lift, 0.0], 0.006, 0.004, 0.003)
    f.limb([1.78, 2.33 + lift, -0.13], [1.78, 2.33 + lift, 0.13], 0.012, 0.012).cut(0.008)
    for (const s2 of [-1, 1]) {
      f.torus([1.62, 2.66 + lift, 0.15 * s2], 0.04, 0.01, [Math.PI / 2, 0, 0], 0.005)
      f.sphere([1.62, 2.66 + lift, 0.155 * s2], 0.022, 0.006)
    }
    f.torus([1.47, 2.95 + lift, 0], 0.17, 0.025, [0, 0, Math.PI / 2 - 0.3], 0.01)
    for (let i = 0; i < 5; i++) f.sphere([1.42 + i * 0.03, 3.0 + lift - i * 0.05, 0], 0.035, 0.01)
  }
  // muscle: the shoulder and the gaskin, and the line of the belly
  for (const z of [-1, 1]) {
    f.ellipsoid([0.72, 1.85 + lift, 0.3 * z], [0.32, 0.4, 0.1], [0, 0, 0.35], 0.12)
    f.ellipsoid([-0.82, 1.62, 0.32 * z], [0.3, 0.36, 0.1], [0, 0, -0.25], 0.12)
  }
  // legs: shoulder, elbow, knee, fetlock, hoof
  const foreleg = (z: number, raised: boolean) => {
    if (o.forelegs === false) return f.limb([0.85, 1.5 + lift, z], [0.9, 1.0 + lift, z], 0.16, 0.12, 0.08)
    if (raised || rear) {
      const pts: V[] = [[0.85, 1.55 + lift, z], [1.1, 1.25 + lift, z], [1.2, 1.55 + lift, z], [1.3, 1.25 + lift, z]]
      f.chain(pts, [0.2, 0.125, 0.1, 0.088], 0.07)
      f.sphere([1.1, 1.25 + lift, z], 0.11, 0.04)
      f.ellipsoid([1.33, 1.18 + lift, z], [0.09, 0.07, 0.08], [0, 0, 0.8], 0.03)
    } else {
      f.chain([[0.82, 1.45, z], [0.86, 0.95, z], [0.86, 0.5, z], [0.88, 0.14, z]], [0.2, 0.12, 0.095, 0.088], 0.07)
      // knee and fetlock joints, and a hoof with its rim
      f.ellipsoid([0.87, 0.92, z], [0.11, 0.12, 0.1], [0, 0, 0], 0.04)
      f.sphere([0.88, 0.24, z], 0.1, 0.04)
      f.ellipsoid([0.92, 0.08, z], [0.13, 0.09, 0.12], [0, 0, 0], 0.03)
    }
  }
  const hindleg = (z: number) => {
    f.chain([[-0.85, 1.55, z], [-0.68, 1.05, z], [-0.95, 0.68, z], [-0.92, 0.14, z]], [0.26, 0.15, 0.1, 0.088], 0.08)
    // the hock, the fetlock, the hoof
    f.ellipsoid([-0.95, 0.7, z], [0.13, 0.11, 0.1], [0, 0, 0], 0.04)
    f.sphere([-0.92, 0.24, z], 0.1, 0.04)
    f.ellipsoid([-0.89, 0.08, z], [0.13, 0.09, 0.12], [0, 0, 0], 0.03)
  }
  foreleg(0.24, true)
  foreleg(-0.24, false)
  hindleg(0.26)
  hindleg(-0.26)
  // tail, falling in a braid
  f.chain([[-1.25, 2.0, 0], [-1.48, 1.75, 0], [-1.52, 1.35, 0], [-1.45, 1.0, 0]], [0.1, 0.11, 0.09, 0.05], 0.06)
  // harness: breast collar hung with bells, girth, saddle cloth with tassels, crupper
  f.torus([0.82, 1.82 + lift, 0], 0.5, 0.045, [0, 0, Math.PI / 2 - 0.4], 0.02)
  for (let i = 0; i < 9; i++) {
    const a = -1.25 + i * 0.31
    const c: V = [1.12 + Math.cos(a) * 0.05, 1.62 + lift - Math.abs(Math.sin(a)) * 0.05 + Math.cos(a) * -0.15, Math.sin(a) * 0.5]
    // a bell on the collar, with its mouth cut
    f.sphere(c, 0.055, 0.015)
    f.sphere([c[0], c[1] - 0.04, c[2]], 0.03).cut(0.01)
  }
  // rosettes along the collar, between the bells
  for (let i = 0; i < 8; i++) {
    const a = -1.1 + i * 0.31
    f.torus([1.2, 1.82 + lift + Math.sin(a) * 0.02, Math.sin(a) * 0.48], 0.03, 0.008, [0, 0, Math.PI / 2], 0.004)
  }
  f.torus([0.2, 1.55, 0], 0.55, 0.04, [0, 0, Math.PI / 2], 0.02)
  f.box([-0.05, 2.08, 0], [0.42, 0.05, 0.5], 0.04, 0, 0.06)
  for (const s of [-1, 1]) {
    f.box([-0.05, 1.72, 0.47 * s], [0.4, 0.33, 0.035], 0.03, 0, 0.04)
    // the saddle cloth's beaded border
    for (let i = 0; i < 12; i++) f.sphere([-0.43 + i * 0.07, 1.42, 0.5 * s], 0.018, 0.005)
    f.torus([-0.05, 1.75, 0.5 * s], 0.13, 0.012, [Math.PI / 2, 0, 0], 0.006)
    for (let i = 0; i < 6; i++) f.limb([-0.38 + i * 0.13, 1.4, 0.49 * s], [-0.38 + i * 0.13, 1.25, 0.5 * s], 0.03, 0.02, 0.01)
  }
  f.torus([-1.15, 1.8, 0], 0.42, 0.035, [0, 0, Math.PI / 2 + 0.3], 0.02)
}

export function horseStatue(variant: 'whole' | 'nohead' | 'broken' = 'whole') {
  return once(`horse-${variant}`, () => {
    const f = new Sculpt()
    horseForm(f, { pose: 'stride', head: variant !== 'nohead' && variant !== 'broken', forelegs: variant !== 'broken' })
    // the stone support under the belly, as carved
    f.box([-0.1, 0.65, 0], [0.4, 0.7, 0.22], 0.05, 0, 0.12)
    // the head is what visitors look at closely: meshed finer from the neck band forward
    return f.mesh(variant === 'whole' ? 0.034 : 0.044, variant === 'whole' ? [{ min: [0.95, 1.95, -0.36], max: [2.06, 3.3, 0.36], cell: 0.015, plane: { p: NECK_BAND, n: [0.514, 0.857, 0] } }] : [])
  })
}

/** The colossal war horse (south side): a horse in full harness, a warrior at its head, a fallen foe beneath. */
export function warHorseStatue() {
  return once('warhorse', () => {
    const f = new Sculpt()
    horseForm(f, { pose: 'rear' })
    // warrior beside the head, sword raised
    const w = (p: V): V => [p[0] + 1.7, p[1], p[2] + 0.75]
    f.chain([w([0, 0.05, -0.12]), w([0, 0.85, -0.1]), w([0, 1.05, 0])], [0.09, 0.11, 0.14], 0.06)
    f.chain([w([0, 0.05, 0.12]), w([0.05, 0.85, 0.1]), w([0, 1.05, 0])], [0.09, 0.11, 0.14], 0.06)
    f.ellipsoid(w([0, 1.15, 0]), [0.2, 0.26, 0.24], [0, 0, 0], 0.08)
    f.ellipsoid(w([0, 1.55, 0]), [0.17, 0.3, 0.24], [0, 0, 0], 0.08)
    f.sphere(w([0.02, 1.98, 0]), 0.13, 0.05)
    f.limb(w([0, 2.08, 0]), w([0, 2.25, 0]), 0.1, 0.04, 0.03)
    f.chain([w([0, 1.75, 0.22]), w([0.1, 2.05, 0.35]), w([0.15, 2.35, 0.3])], [0.06, 0.05, 0.045], 0.04)
    f.box(w([0.18, 2.85, 0.3]), [0.025, 0.5, 0.05], 0.01, 0, 0.02)
    f.chain([w([0, 1.75, -0.22]), w([0.15, 1.5, -0.3]), w([0.25, 1.4, -0.25])], [0.06, 0.05, 0.045], 0.04)
    f.ellipsoid(w([0.28, 1.45, -0.32]), [0.05, 0.25, 0.25], [0, 0, 0], 0.03)
    // the fallen foe beneath the hooves
    f.limb([0.2, 0.22, 0.1], [1.0, 0.25, -0.2], 0.18, 0.15, 0.08)
    f.sphere([1.15, 0.28, -0.25], 0.15, 0.05)
    f.limb([0.2, 0.2, 0.1], [-0.4, 0.15, 0.3], 0.11, 0.08, 0.06)
    // support
    f.box([-0.1, 0.65, 0], [0.45, 0.7, 0.24], 0.05, 0, 0.12)
    return f.mesh(0.035, [{ min: [0.95, 2.3, -0.36], max: [2.06, 3.65, 0.36], cell: 0.018, plane: { p: [NECK_BAND[0], NECK_BAND[1] + 0.35, 0], n: [0.514, 0.857, 0] } }])
  })
}

/** The colossal war elephant (north side), a man caught in its trunk. */
export function warElephantStatue() {
  return once('elephant', () => {
    const f = new Sculpt()
    f.ellipsoid([0, 2.1, 0], [1.65, 1.15, 1.02], [0, 0, 0.05], 0.3)
    f.ellipsoid([-0.95, 2.0, 0], [0.8, 1.0, 0.95], [0, 0, 0], 0.25)
    f.ellipsoid([1.5, 2.55, 0], [0.72, 0.82, 0.68], [0, 0, 0.2], 0.25)
    for (const s of [-1, 1]) {
      f.sphere([1.65, 3.05, 0.25 * s], 0.32, 0.15)
      // ears, flared
      f.ellipsoid([1.15, 2.55, 0.7 * s], [0.45, 0.65, 0.07], [0.2 * s, -0.5 * s, 0], 0.1)
      // tusks
      f.chain([[1.95, 2.05, 0.25 * s], [2.35, 1.75, 0.3 * s], [2.6, 1.8, 0.3 * s]], [0.08, 0.06, 0.03], 0.03)
      f.sphere([1.92, 2.5, 0.33 * s], 0.05).cut(0.02)
    }
    // trunk curling down and forward
    f.chain([[2.05, 2.3, 0], [2.4, 1.7, 0], [2.5, 1.05, 0.05], [2.25, 0.6, 0.2], [1.95, 0.7, 0.3]], [0.32, 0.24, 0.18, 0.13, 0.1], 0.1)
    for (let i = 0; i < 8; i++) f.torus([2.3 + i * 0.025, 1.95 - i * 0.15, 0], 0.24 - i * 0.015, 0.02, [0, 0, Math.PI / 2], 0.01)
    // the man in the trunk
    f.limb([1.9, 0.6, 0.35], [2.6, 1.0, 0.45], 0.12, 0.1, 0.05)
    f.sphere([2.75, 1.1, 0.5], 0.12, 0.04)
    // legs, columnar, with toenails
    for (const [x, z] of [[1.0, 0.55], [1.0, -0.55], [-1.05, 0.55], [-1.05, -0.55]] as const) {
      f.limb([x, 1.7, z], [x, 0.15, z], 0.46, 0.4, 0.18)
      f.ellipsoid([x + 0.05, 0.1, z], [0.4, 0.12, 0.38], [0, 0, 0], 0.06)
      for (const dz of [-0.15, 0, 0.15]) f.sphere([x + 0.38, 0.09, z + dz], 0.07, 0.02)
    }
    f.chain([[-1.6, 2.3, 0], [-1.85, 1.6, 0], [-1.8, 1.0, 0]], [0.08, 0.06, 0.07], 0.05)
    // harness: caparison over the back, neck chain with bells, girth
    // the caparison: a cloth over the back, falling in a curve down both flanks, with a fringe
    f.ellipsoid([0.05, 2.2, 0], [0.85, 1.2, 1.08], [0, 0, 0], 0.05)
    for (const s of [-1, 1]) for (let i = 0; i < 9; i++) f.limb([-0.7 + i * 0.18, 1.42, 1.0 * s], [-0.7 + i * 0.18, 1.25, 0.98 * s], 0.04, 0.025, 0.015)
    f.torus([0.95, 2.35, 0], 0.95, 0.07, [0, 0, Math.PI / 2 - 0.2], 0.03)
    for (const s of [-1, 1]) f.sphere([1.1, 1.5, 0.45 * s], 0.11, 0.03)
    f.torus([0, 2.1, 0], 1.12, 0.06, [0, 0, Math.PI / 2], 0.03)
    return f.mesh(0.055)
  })
}

/** A lion, rampant (as on the stairs and the roof), facing +X: the Odishan lion, deep-chested and
 *  thick-limbed, its mane worked in rings of snail curls, jaws open. */
function lionForm(f: Sculpt, s = 1) {
  const p = (q: V): V => [q[0] * s, q[1] * s, q[2] * s]
  const k = (v: number) => v * s
  // body: haunch, belly rising to a deep chest
  f.limb(p([-0.45, 0.85, 0]), p([0.22, 1.5, 0]), k(0.36), k(0.44), k(0.15))
  f.ellipsoid(p([-0.5, 0.78, 0]), [k(0.44), k(0.42), k(0.4)], [0, 0, 0], k(0.12))
  f.ellipsoid(p([0.2, 1.42, 0]), [k(0.3), k(0.42), k(0.38)], [0, 0, 0.5], k(0.12))
  f.ellipsoid(p([-0.1, 1.0, 0]), [k(0.3), k(0.36), k(0.3)], [0, 0, 0.8], k(0.1))
  // head: broad skull, heavy brow, a short square muzzle, jaws open
  const H: V = [0.45, 1.98, 0]
  f.sphere(p(H), k(0.32), k(0.1))
  f.ellipsoid(p([0.62, 2.07, 0]), [k(0.12), k(0.07), k(0.26)], [0, 0, -0.3], k(0.05))
  f.ellipsoid(p([0.74, 1.9, 0]), [k(0.18), k(0.13), k(0.17)], [0, 0, -0.15], k(0.05))
  f.ellipsoid(p([0.7, 1.74, 0]), [k(0.15), k(0.05), k(0.13)], [0, 0, 0.25], k(0.04))
  f.ellipsoid(p([0.86, 1.82, 0]), [k(0.1), k(0.05), k(0.11)], [0, 0, 0.3]).cut(k(0.02))
  f.sphere(p([0.9, 1.95, 0]), k(0.06), k(0.02))
  for (const z of [-1, 1]) {
    // bulging eyes in deep sockets, the nostrils, a fang at each corner of the mouth
    f.sphere(p([0.68, 2.05, 0.13 * z]), k(0.065)).cut(k(0.02))
    f.sphere(p([0.66, 2.05, 0.13 * z]), k(0.05), k(0.01))
    f.sphere(p([0.93, 1.95, 0.04 * z]), k(0.025)).cut(k(0.008))
    f.limb(p([0.86, 1.86, 0.08 * z]), p([0.9, 1.78, 0.08 * z]), k(0.025), k(0.008), k(0.008))
    f.limb(p([0.82, 1.73, 0.07 * z]), p([0.86, 1.8, 0.07 * z]), k(0.022), k(0.007), k(0.008))
    // ears, small and rounded, set high
    f.ellipsoid(p([0.38, 2.3, 0.2 * z]), [k(0.07), k(0.1), k(0.04)], [0.4 * z, 0, 0], k(0.03))
  }
  // the mane: two rings of snail curls round the face and a beard of curls under the jaw
  for (const [x, r, n, cr] of [[0.42, 0.36, 15, 0.1], [0.24, 0.47, 19, 0.115], [0.08, 0.5, 19, 0.11]] as const) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + x
      const c: V = [x, 1.98 + Math.sin(a) * r, Math.cos(a) * r]
      f.sphere(p(c), k(cr), k(0.04))
      f.sphere(p([c[0] + cr * 0.75, c[1], c[2]]), k(cr * 0.35)).cut(k(0.015))
    }
  }
  for (let i = 0; i < 5; i++) f.sphere(p([0.55 - i * 0.04, 1.62 - i * 0.07, (i - 2) * 0.09]), k(0.08), k(0.03))
  for (const z of [-1, 1]) {
    // forelegs raised, thick, paws spread with claws out
    f.chain([p([0.3, 1.45, 0.27 * z]), p([0.62, 1.28, 0.33 * z]), p([0.88, 1.52, 0.3 * z])], [k(0.17), k(0.13), k(0.11)], k(0.07))
    f.ellipsoid(p([0.9, 1.56, 0.3 * z]), [k(0.1), k(0.07), k(0.1)], [0, 0, 0.6], k(0.03))
    for (const dz of [-0.07, -0.023, 0.023, 0.07]) f.limb(p([0.95, 1.6, (0.3 + dz) * z]), p([1.04, 1.64, (0.3 + dz) * z]), k(0.03), k(0.01), k(0.008))
    // haunches crouched, a heavy thigh
    f.ellipsoid(p([-0.42, 0.72, 0.3 * z]), [k(0.34), k(0.3), k(0.12)], [0, 0, -0.5], k(0.1))
    f.chain([p([-0.5, 0.75, 0.3 * z]), p([-0.08, 0.45, 0.32 * z]), p([-0.32, 0.12, 0.32 * z]), p([0.02, 0.07, 0.32 * z])], [k(0.27), k(0.15), k(0.11), k(0.1)], k(0.08))
    for (const dz of [-0.05, 0, 0.05]) f.limb(p([0.05, 0.06, (0.32 + dz) * z]), p([0.14, 0.04, (0.32 + dz) * z]), k(0.03), k(0.012), k(0.008))
  }
  // tail sweeping up behind, ending in a tuft
  f.chain([p([-0.85, 0.6, 0]), p([-1.12, 0.95, 0]), p([-1.0, 1.4, 0]), p([-0.78, 1.5, 0])], [k(0.08), k(0.07), k(0.06), k(0.05)], k(0.05))
  f.sphere(p([-0.72, 1.55, 0]), k(0.12), k(0.04))
}

export function lionStatue() {
  return once('lion', () => {
    const f = new Sculpt()
    lionForm(f)
    return f.mesh(0.04)
  })
}

/** Gaja-simha: a lion rampant on a crouching elephant (the pair guarding the east stairs). */
export function gajaSimhaStatue() {
  return once('gajasimha', () => {
    const f = new Sculpt()
    // the elephant, crushed down onto its knees: a heavy body, the great head low and forward
    f.ellipsoid([-0.1, 0.72, 0], [1.15, 0.6, 0.7], [0, 0, 0.05], 0.2)
    f.ellipsoid([-0.85, 0.7, 0], [0.5, 0.55, 0.62], [0, 0, 0], 0.15)
    f.sphere([1.15, 0.92, 0], 0.55, 0.2)
    for (const z of [-1, 1]) {
      // the domes of the forehead, the ears pressed back, eyes, tusks
      f.sphere([1.38, 1.22, 0.2 * z], 0.28, 0.12)
      f.ellipsoid([0.88, 0.95, 0.58 * z], [0.38, 0.5, 0.07], [0.25 * z, -0.35 * z, 0], 0.08)
      f.sphere([1.5, 1.0, 0.33 * z], 0.05).cut(0.02)
      f.chain([[1.58, 0.62, 0.24 * z], [1.88, 0.42, 0.3 * z], [2.02, 0.52, 0.3 * z]], [0.075, 0.055, 0.03], 0.03)
      // legs folded under: forelegs stretched forward on the ground, hind legs tucked
      f.limb([0.75, 0.42, 0.45 * z], [1.25, 0.16, 0.48 * z], 0.27, 0.2, 0.1)
      f.ellipsoid([1.3, 0.14, 0.48 * z], [0.2, 0.13, 0.2], [0, 0, 0], 0.05)
      for (const dz of [-0.1, 0, 0.1]) f.sphere([1.48, 0.1, 0.48 * z + dz], 0.05, 0.015)
      f.limb([-0.75, 0.45, 0.5 * z], [-0.25, 0.16, 0.52 * z], 0.3, 0.2, 0.1)
      f.ellipsoid([-0.2, 0.14, 0.52 * z], [0.2, 0.13, 0.18], [0, 0, 0], 0.05)
    }
    // trunk, ringed, falling between the forelegs and curling up at the tip
    const trunk: V[] = [[1.6, 0.92, 0], [1.82, 0.58, 0], [1.88, 0.22, 0.02], [2.05, 0.1, 0.05], [2.15, 0.25, 0.06]]
    f.chain(trunk, [0.26, 0.19, 0.14, 0.1, 0.08], 0.08)
    for (let i = 0; i < 7; i++) {
      const t = i / 6
      f.torus([1.68 + t * 0.2, 0.8 - t * 0.55, 0], 0.22 - t * 0.07, 0.014, [0, 0, 0.5 - t * 0.5], 0.008)
    }
    // tail, and the caparison: a chain of bells at the neck and a fringed cloth over the back
    f.chain([[-1.3, 0.85, 0], [-1.45, 0.5, 0], [-1.42, 0.25, 0]], [0.06, 0.05, 0.06], 0.04)
    for (let i = 0; i < 9; i++) {
      const a = -1.2 + i * 0.3
      f.sphere([0.98, 0.95 + Math.cos(a) * 0.55 - 0.55, Math.sin(a) * 0.6], 0.05, 0.015)
    }
    for (const z of [-1, 1]) for (let i = 0; i < 8; i++) f.limb([-0.7 + i * 0.18, 0.62, 0.7 * z], [-0.7 + i * 0.18, 0.46, 0.68 * z], 0.035, 0.022, 0.012)
    // the lion astride it, hind feet on the elephant's back, forepaws over its head
    const lf = new Sculpt()
    lionForm(lf, 1.25)
    for (const p of lf.prims) {
      const d = p.d
      p.d = (x, y, z) => d(x + 0.35, y - 1.12, z)
      p.c = [p.c[0] - 0.35, p.c[1] + 1.12, p.c[2]]
      f.prims.push(p)
    }
    return f.mesh(0.04)
  })
}

/** A makara (crocodile-like river creature) waterspout, projecting along +X. */
export function makaraSpout() {
  return once('makara', () => {
    const f = new Sculpt()
    f.box([0.1, 0, 0], [0.18, 0.16, 0.18], 0.04, 0, 0.05)
    f.ellipsoid([0.4, 0.04, 0], [0.26, 0.15, 0.15], [0, 0, 0.1], 0.08)
    f.limb([0.55, 0.06, 0], [0.95, 0.1, 0], 0.12, 0.08, 0.06)
    f.limb([0.55, -0.06, 0], [0.88, -0.07, 0], 0.08, 0.05, 0.04)
    f.limb([0.6, 0.0, 0], [0.92, 0.01, 0], 0.05, 0.03).cut(0.02)
    f.chain([[0.95, 0.12, 0], [1.05, 0.25, 0], [0.98, 0.33, 0]], [0.06, 0.05, 0.03], 0.03)
    for (const z of [-1, 1]) {
      f.sphere([0.48, 0.15, 0.1 * z], 0.05, 0.02)
      f.sphere([0.5, 0.17, 0.12 * z], 0.025).cut(0.01)
      f.ellipsoid([0.3, 0.12, 0.14 * z], [0.1, 0.07, 0.03], [0, 0, -0.4], 0.03)
    }
    return f.mesh(0.022)
  })
}

/** Surya as at Konark's sanctum niches: standing straight, crowned, haloed, a lotus in each
 *  raised hand, booted, on a pedestal with seven small horses. ~3.4 m, facing +X. */
export function suryaStatue() {
  return once('surya', () => {
    const f = new Sculpt()
    // pedestal with the seven horses and the charioteer Aruna
    f.box([0, 0.27, 0], [0.38, 0.27, 0.9], 0.03, 0, 0.03)
    for (let i = 0; i < 7; i++) {
      const z = -0.66 + i * 0.22
      f.ellipsoid([0.36, 0.33, z], [0.12, 0.08, 0.05], [0, 0, 0.2], 0.03)
      f.limb([0.43, 0.38, z], [0.5, 0.48, z], 0.04, 0.03, 0.02)
    }
    f.ellipsoid([0.42, 0.62, 0], [0.08, 0.12, 0.08], [0, 0, 0], 0.03)
    // legs in boots, a straight stance
    for (const z of [-0.14, 0.14]) {
      f.limb([0.02, 0.58, z], [0.0, 1.3, z * 0.9], 0.1, 0.12, 0.06)
      f.ellipsoid([0.04, 0.6, z], [0.13, 0.08, 0.09], [0, 0, 0], 0.05)
      f.limb([0.0, 1.3, z * 0.9], [-0.01, 1.85, z * 0.7], 0.12, 0.15, 0.08)
    }
    // the long lower garment with a central pleat, belt, sash
    f.limb([0.04, 1.9, 0], [0.12, 0.85, 0], 0.08, 0.13, 0.06)
    f.ellipsoid([0.0, 1.95, 0], [0.18, 0.15, 0.28], [0, 0, 0], 0.08)
    f.torus([0.0, 2.02, 0], 0.27, 0.03, [0, 0, 0], 0.02)
    f.chain([[0.16, 2.0, -0.2], [0.2, 1.7, 0], [0.16, 2.0, 0.2]], [0.025, 0.03, 0.025], 0.015)
    // torso, chest, the sacred thread, necklaces
    f.ellipsoid([0.0, 2.32, 0], [0.16, 0.3, 0.27], [0, 0, 0], 0.1)
    f.ellipsoid([0.04, 2.52, 0], [0.15, 0.15, 0.3], [0, 0, 0], 0.08)
    f.limb([0.13, 2.68, -0.18], [0.15, 2.05, 0.2], 0.015, 0.015, 0.01)
    f.torus([0.06, 2.62, 0], 0.17, 0.02, [0, 0, Math.PI / 2 - 0.25], 0.01)
    f.torus([0.07, 2.56, 0], 0.22, 0.025, [0, 0, Math.PI / 2 - 0.3], 0.01)
    // head, serene, with a tall jewelled crown and ear ornaments
    f.limb([0.0, 2.7, 0], [0.0, 2.8, 0], 0.07, 0.065, 0.04)
    f.ellipsoid([0.02, 2.93, 0], [0.11, 0.14, 0.11], [0, 0, 0], 0.04)
    f.sphere([0.12, 2.92, 0], 0.025, 0.01)
    for (const z of [-0.05, 0.05]) f.sphere([0.11, 2.96, z], 0.02).cut(0.008)
    f.limb([0.0, 3.03, 0], [0.0, 3.38, 0], 0.13, 0.07, 0.04)
    for (let i = 0; i < 4; i++) f.torus([0.0, 3.07 + i * 0.08, 0], 0.13 - i * 0.015, 0.012, [0, 0, 0], 0.006)
    for (const z of [-0.11, 0.11]) f.ellipsoid([0.0, 2.85, z], [0.03, 0.06, 0.02], [0, 0, 0], 0.01)
    // the halo behind the head
    f.ellipsoid([-0.12, 3.0, 0], [0.03, 0.42, 0.42], [0, 0, 0], 0.03)
    f.torus([-0.1, 3.0, 0], 0.4, 0.025, [0, 0, Math.PI / 2], 0.01)
    // arms raised from the elbow, each holding a full-blown lotus at the shoulder
    for (const z of [-1, 1]) {
      f.chain([[0.0, 2.6, 0.26 * z], [0.1, 2.3, 0.34 * z], [0.24, 2.55, 0.36 * z]], [0.065, 0.055, 0.045], 0.04)
      f.torus([0.1, 2.3, 0.34 * z], 0.06, 0.012, [0, 0, Math.PI / 2], 0.006)
      f.limb([0.24, 2.55, 0.36 * z], [0.26, 2.95, 0.38 * z], 0.02, 0.018, 0.01)
      for (let p = 0; p < 8; p++) {
        const a = (p / 8) * Math.PI * 2
        f.ellipsoid([0.26 + Math.cos(a) * 0.08, 3.02, 0.38 * z + Math.sin(a) * 0.08], [0.06, 0.03, 0.035], [0, -a, 0.5], 0.02)
      }
      f.sphere([0.26, 3.04, 0.38 * z], 0.04, 0.02)
      // a small attendant at each side
      f.chain([[0.05, 0.55, 0.62 * z], [0.04, 1.0, 0.6 * z]], [0.05, 0.07], 0.04)
      f.ellipsoid([0.05, 1.12, 0.6 * z], [0.07, 0.12, 0.08], [0, 0, 0], 0.04)
      f.sphere([0.06, 1.3, 0.6 * z], 0.06, 0.02)
    }
    return f.mesh(0.026, [{ min: [-0.1, 2.72, -0.16], max: [0.18, 3.1, 0.16], cell: 0.011 }])
  })
}

export type FigurePose = 'drum' | 'cymbals' | 'flute' | 'dance' | 'mirror' | 'veena'

/** A Konark maiden or musician in tribhanga (thrice-bent) stance, ~h tall, facing +X. */
function figureForm(f: Sculpt, pose: FigurePose, h = 1.75, flat = 1) {
  const s = h / 1.75
  const P = (x: number, y: number, z: number): V => [x * s * flat, y * s, z * s]
  const k = (v: number) => v * s
  const sway = pose === 'dance' ? 0.09 : 0.06
  // legs: weight on one, the other bent across
  f.chain([P(0.02, 0.05, -0.1), P(0.0, 0.48, -0.09), P(-0.02, 0.9, -0.06 + sway)], [k(0.05), k(0.065), k(0.1)], k(0.05))
  if (pose === 'dance') f.chain([P(0.05, 0.4, 0.22), P(0.1, 0.55, 0.12), P(0.0, 0.92, 0.04 + sway)], [k(0.05), k(0.065), k(0.1)], k(0.05))
  else f.chain([P(0.06, 0.05, 0.08), P(0.08, 0.5, 0.05), P(-0.02, 0.9, 0.06 + sway)], [k(0.05), k(0.065), k(0.1)], k(0.05))
  for (const z of [-0.1, pose === 'dance' ? 0.22 : 0.08]) f.ellipsoid(P(0.06, 0.03, z), [k(0.09), k(0.035), k(0.04)], [0, 0, 0], k(0.02))
  // hips, swung out; the lower garment and the jewelled girdle
  f.ellipsoid(P(-0.01, 0.98, sway), [k(0.15), k(0.13), k(0.2)], [0.15, 0, 0], k(0.06))
  for (const z of [-0.08, 0.08]) f.ellipsoid(P(0.0, 0.72, z + sway * 0.6), [k(0.09), k(0.24), k(0.085)], [0.08, 0, 0], k(0.06))
  // the sari, gathered at the waist and falling between the legs in pleats
  f.limb(P(0.06, 0.95, sway), P(0.1, 0.15, 0.0), k(0.05), k(0.07), k(0.04))
  for (const z of [-0.045, -0.015, 0.015, 0.045]) f.limb(P(0.1, 0.8, z + sway), P(0.13 + Math.abs(z), 0.12, z * 1.3), k(0.01), k(0.016), k(0.008))
  // the sari's border, a ridge round the shins
  for (const z of [-0.1, 0.08]) f.torus(P(0.02, 0.32, z + (pose === 'dance' && z > 0 ? 0.14 : 0)), k(0.06), k(0.008), [0, 0, 0], k(0.005))
  f.torus(P(0.0, 1.0, sway), k(0.19), k(0.018), [0.15, 0, 0], k(0.01))
  for (let i = 0; i < 5; i++) f.sphere(P(0.17, 0.94 - i * 0.03, sway - 0.08 + i * 0.04), k(0.018), k(0.008))
  // torso, turned back the other way; breasts; necklace
  f.ellipsoid(P(-0.01, 1.2, sway * 0.3), [k(0.1), k(0.16), k(0.13)], [-0.12, 0, 0], k(0.06))
  f.ellipsoid(P(-0.01, 1.38, 0), [k(0.11), k(0.1), k(0.17)], [0, 0, 0], k(0.05))
  for (const z of [-0.07, 0.07]) f.sphere(P(0.08, 1.33, z), k(0.07), k(0.04))
  f.torus(P(0.02, 1.43, 0), k(0.1), k(0.012), [0, 0, Math.PI / 2 - 0.2], k(0.008))
  // a second, longer necklace with a pendant between the breasts
  f.torus(P(0.03, 1.39, 0), k(0.13), k(0.009), [0, 0, Math.PI / 2 - 0.35], k(0.005))
  f.ellipsoid(P(0.12, 1.29, 0), [k(0.012), k(0.022), k(0.016)], [0, 0, 0], k(0.006))
  // girdle loops hanging over the hips
  for (let i = 0; i < 4; i++) f.torus(P(0.11, 0.9 - i * 0.02, sway + (i - 1.5) * 0.06), k(0.035), k(0.006), [Math.PI / 2, 0, 0], k(0.004))
  // anklets
  f.torus(P(0.02, 0.1, -0.1), k(0.055), k(0.012), [0, 0, 0], k(0.006))
  f.torus(P(pose === 'dance' ? 0.05 : 0.06, pose === 'dance' ? 0.42 : 0.1, pose === 'dance' ? 0.22 : 0.08), k(0.052), k(0.012), [0, 0, 0], k(0.006))
  // neck, head (tilted), hair bun, crown, earrings
  f.limb(P(-0.01, 1.47, 0), P(0.0, 1.55, -sway * 0.3), k(0.045), k(0.04), k(0.03))
  f.ellipsoid(P(0.01, 1.63, -sway * 0.4), [k(0.075), k(0.095), k(0.075)], [0.12, 0, 0], k(0.03))
  // the face: full cheeks, almond eyes under arched brows, a straight nose, a smiling mouth
  const hz = -sway * 0.4
  for (const z of [-0.028, 0.028]) {
    f.ellipsoid(P(0.075, 1.645, hz + z), [k(0.012), k(0.008), k(0.02)], [0, 0, 0], k(0.006))
    f.ellipsoid(P(0.08, 1.648, hz + z), [k(0.006), k(0.004), k(0.014)], [0, 0, 0]).cut(k(0.004))
    f.limb(P(0.075, 1.665, hz + z * 1.5), P(0.077, 1.668, hz + z * 0.35), k(0.005), k(0.004), k(0.003))
    f.ellipsoid(P(0.055, 1.6, hz + z * 1.4), [k(0.02), k(0.02), k(0.016)], [0, 0, 0], k(0.012))
    f.ellipsoid(P(0.0, 1.63, hz + z * 2.75), [k(0.012), k(0.022), k(0.008)], [0, 0, 0], k(0.006))
  }
  f.limb(P(0.08, 1.648, hz), P(0.093, 1.612, hz), k(0.008), k(0.012), k(0.006))
  f.ellipsoid(P(0.083, 1.588, hz), [k(0.008), k(0.005), k(0.02)], [0, 0, 0], k(0.005))
  f.limb(P(0.088, 1.59, hz - 0.016), P(0.088, 1.59, hz + 0.016), k(0.0025), k(0.0025)).cut(k(0.003))
  f.ellipsoid(P(0.074, 1.57, hz), [k(0.016), k(0.012), k(0.02)], [0, 0, 0], k(0.008))
  f.sphere(P(-0.08, 1.67, -sway * 0.4), k(0.065), k(0.03))
  f.limb(P(0.0, 1.69, -sway * 0.4), P(0.0, 1.76, -sway * 0.4), k(0.06), k(0.03), k(0.02))
  f.sphere(P(0.07, 1.64, -sway * 0.4), k(0.015), k(0.006))
  for (const z of [-0.075, 0.075]) f.sphere(P(0.0, 1.57, z - sway * 0.4), k(0.02), k(0.006))
  // arms by pose
  const sh = [P(0.0, 1.43, -0.15), P(0.0, 1.43, 0.15)]
  const arm = (a: V, e: V, w: V) => {
    f.chain([a, e, w], [k(0.04), k(0.033), k(0.026)], k(0.025))
    // an armlet above the elbow
    f.torus([(a[0] * 2 + e[0]) / 3, (a[1] * 2 + e[1]) / 3, (a[2] * 2 + e[2]) / 3], k(0.042), k(0.009), [0, 0, Math.PI / 2], k(0.004))
    f.sphere(w, k(0.03), k(0.015))
    f.torus(w, k(0.03), k(0.008), [0, 0, Math.PI / 2], k(0.004))
  }
  switch (pose) {
    case 'drum':
      arm(sh[0], P(0.08, 1.2, -0.2), P(0.18, 1.05, -0.12))
      arm(sh[1], P(0.08, 1.2, 0.2), P(0.18, 1.05, 0.12))
      f.limb(P(0.2, 1.05, -0.17), P(0.2, 1.05, 0.17), k(0.075), k(0.065), k(0.02))
      for (const z of [-0.17, 0.17]) f.torus(P(0.2, 1.05, z), k(0.07), k(0.01), [Math.PI / 2, 0, 0], k(0.005))
      break
    case 'cymbals':
      arm(sh[0], P(0.1, 1.35, -0.25), P(0.22, 1.5, -0.05))
      arm(sh[1], P(0.1, 1.35, 0.25), P(0.22, 1.5, 0.05))
      for (const z of [-0.04, 0.04]) f.ellipsoid(P(0.25, 1.5, z), [k(0.06), k(0.06), k(0.015)], [0, 0, 0], k(0.01))
      break
    case 'flute':
      arm(sh[0], P(0.12, 1.32, -0.22), P(0.13, 1.55, -0.08))
      arm(sh[1], P(0.12, 1.32, 0.18), P(0.13, 1.55, 0.18))
      f.limb(P(0.12, 1.58, -0.12), P(0.12, 1.54, 0.3), k(0.015), k(0.015), k(0.005))
      break
    case 'dance':
      arm(sh[0], P(0.02, 1.62, -0.25), P(0.04, 1.85, -0.18))
      arm(sh[1], P(0.06, 1.3, 0.28), P(0.12, 1.15, 0.38))
      break
    case 'mirror':
      arm(sh[0], P(0.1, 1.3, -0.24), P(0.18, 1.52, -0.12))
      f.ellipsoid(P(0.2, 1.6, -0.1), [k(0.015), k(0.07), k(0.055)], [0, 0, 0], k(0.01))
      arm(sh[1], P(0.0, 1.2, 0.22), P(0.04, 1.0, 0.24))
      break
    case 'veena':
      arm(sh[0], P(0.12, 1.25, -0.2), P(0.16, 1.2, 0.05))
      arm(sh[1], P(0.1, 1.38, 0.24), P(0.16, 1.48, 0.2))
      f.limb(P(0.16, 1.05, -0.3), P(0.16, 1.55, 0.3), k(0.02), k(0.02), k(0.01))
      f.sphere(P(0.16, 1.08, -0.27), k(0.08), k(0.02))
      break
  }
}

/** A standing figure in the round (the terrace musicians). */
export function figureStatue(pose: FigurePose, h = 1.75) {
  return once(`fig-${pose}-${h}`, () => {
    const f = new Sculpt()
    figureForm(f, pose, h)
    // these stand high on the roof terraces: no close-up detail needed
    return f.mesh(0.03 * (h / 1.75))
  })
}

/** A figure in deep relief for a wall niche: flattened front-to-back, backed by its slab. */
export function reliefFigure(pose: FigurePose, h: number) {
  return once(`relief-${pose}-${h}`, () => {
    const f = new Sculpt()
    figureForm(f, pose, h, 0.55)
    return f.mesh(0.026 * (h / 1.1))
  })
}

export const POSES: FigurePose[] = ['drum', 'cymbals', 'flute', 'dance', 'mirror', 'veena']
