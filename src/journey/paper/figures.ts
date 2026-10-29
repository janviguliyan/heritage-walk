import * as THREE from 'three'
import { capsule, circle, cloud, cut, ellipse, holes, poly, rect, ring, smooth, star } from './kit'

// Cut-paper figures for the Konark story. Each returns a THREE.Group whose parts sit a few
// hundredths apart in depth, so they shadow one another like layered card. Figures that move
// (horse legs, an artisan's arm) expose their pivots in userData.

type XY = [number, number]
const g = () => new THREE.Group()

/** A sun: a glowing disc, a petalled halo, and two rings of rays turning against each other
 *  (userData.rays turns one way; its child the other). */
export function sun(r: number, color = '#ffcf6a', rays = '#f2a43a') {
  const o = g()
  const rr = cut(star(0, 0, r * 1.62, r * 1.14, 16), rays, -0.09, { glow: 0.5, shadow: false })
  const inner = cut(star(0, 0, r * 1.38, r * 1.08, 24, Math.PI / 24), '#ffc25a', 0.03, { glow: 0.6, shadow: false })
  rr.add(inner)
  const petals: THREE.Shape[] = []
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2
    petals.push(ellipse(Math.cos(a) * r * 1.02, Math.sin(a) * r * 1.02, r * 0.16, r * 0.09, a))
  }
  const halo = cut([circle(0, 0, r * 1.06), ...petals], '#ffb347', -0.03, { glow: 0.75, shadow: false })
  const disc = cut(holes(circle(0, 0, r), Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2
    return circle(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78, r * 0.045)
  })), color, 0, { glow: 1.1, shadow: false })
  const face = cut(ring(0, 0, r * 0.62, r * 0.56), '#ffe3a0', 0.04, { glow: 1.0, shadow: false })
  o.add(rr, halo, disc, face, sunGlow(r * 5.5))
  o.userData.rays = rr
  return o
}

let glowTex: THREE.CanvasTexture | null = null
/** Light spilling round the sun onto the sky: a soft additive disc. */
function sunGlow(size: number) {
  if (!glowTex) {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const x = c.getContext('2d')!
    const grd = x.createRadialGradient(128, 128, 0, 128, 128, 128)
    grd.addColorStop(0, 'rgba(255,214,140,0.85)')
    grd.addColorStop(0.25, 'rgba(255,170,90,0.35)')
    grd.addColorStop(1, 'rgba(255,140,60,0)')
    x.fillStyle = grd
    x.fillRect(0, 0, 256, 256)
    glowTex = new THREE.CanvasTexture(c)
    glowTex.colorSpace = THREE.SRGBColorSpace
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }))
  m.position.z = -0.2
  return m
}

/** A cloud in two tones of card: a shadowed under-layer, offset, and the lit puffs over it. */
export function puff(cx: number, cy: number, w: number, h: number, seed: number, light = '#fff6e6', shade = '#e8cfae', glow = 0) {
  const o = g()
  o.add(cut(cloud(cx + h * 0.12, cy - h * 0.14, w * 1.02, h, seed), shade, -0.03, { glow: glow * 0.6 }))
  o.add(cut(cloud(cx, cy, w, h * 0.92, seed + 11), light, 0, { glow }))
  return o
}

/** A galloping horse facing right, hooves at y = 0, about 1.9 long. */
export function horse(coat = '#f4e9d4', mane = '#d7b27a', jewel = '#e0a032') {
  const o = g()
  const far = new THREE.Color(coat).multiplyScalar(0.78).getStyle()
  const legs: THREE.Group[] = []
  const leg = (x: number, y: number, z: number, color: string) => {
    const hip = g()
    hip.position.set(x, y, z)
    hip.add(cut(capsule(0, 0, 0, -0.38, 0.12, 0.06), color, 0))
    const knee = g()
    knee.position.set(0, -0.38, 0.005)
    knee.add(cut(capsule(0, 0, 0, -0.36, 0.055, 0.045), color, 0))
    knee.add(cut(poly([[-0.07, -0.34], [0.08, -0.34], [0.07, -0.44], [-0.06, -0.44]]), '#6b4a2a', 0.01))
    hip.add(knee)
    hip.userData.knee = knee
    legs.push(hip)
    return hip
  }
  // far legs first (darker, behind), then the body, then near legs
  o.add(leg(0.46, 0.86, -0.05, far), leg(-0.42, 0.9, -0.05, far))
  // body, arched neck and head as one outline
  const body = smooth([
    [-0.55, 1.12], [-0.15, 1.07], [0.22, 1.16], [0.42, 1.44], [0.6, 1.72], [0.72, 1.8], [0.8, 1.74],
    [0.95, 1.55], [1.07, 1.41], [1.03, 1.34], [0.9, 1.36], [0.76, 1.42], [0.68, 1.34], [0.63, 1.12],
    [0.62, 0.92], [0.42, 0.76], [0.0, 0.71], [-0.36, 0.75], [-0.6, 0.84], [-0.68, 1.0],
  ], 0.5)
  const ears = [poly([[0.66, 1.76], [0.66, 1.96], [0.75, 1.79]]), poly([[0.72, 1.78], [0.76, 1.95], [0.8, 1.77]])]
  const tail = smooth([[-0.6, 1.08], [-0.86, 1.24], [-1.1, 1.18], [-1.02, 1.04], [-0.8, 1.0], [-0.64, 0.95]])
  o.add(cut([body, ...ears, tail], coat, 0))
  // mane: plumes along the crest of the neck, and a crest plume between the ears
  const plumes = [0, 1, 2, 3, 4].map((i) => {
    const t = i / 4
    return ellipse(0.24 + t * 0.4 - 0.06, 1.2 + t * 0.52 + 0.03, 0.14, 0.055, 1.0)
  })
  o.add(cut([...plumes, ellipse(0.69, 2.0, 0.055, 0.15, -0.3)], mane, 0.035))
  // harness: bridle, a jewelled collar with bells, a saddle cloth, and an eye
  o.add(cut([capsule(0.94, 1.52, 0.78, 1.66, 0.025), capsule(0.94, 1.52, 0.9, 1.36, 0.022), capsule(0.6, 1.04, 0.42, 1.34, 0.04)], jewel, 0.04))
  o.add(cut([0, 1, 2].map((i) => circle(0.55 - i * 0.06, 1.0 + i * 0.12, 0.04)), jewel, 0.05))
  o.add(cut(smooth([[-0.3, 1.13], [0.14, 1.15], [0.12, 0.86], [-0.06, 0.8], [-0.28, 0.86]], 0.3), '#b0303a', 0.04))
  o.add(cut([capsule(-0.3, 0.86, 0.12, 0.86, 0.025)], jewel, 0.055))
  o.add(cut(circle(0.83, 1.6, 0.025), '#2b170a', 0.05))
  o.add(leg(0.4, 0.84, 0.06, coat), leg(-0.46, 0.88, 0.06, coat))
  o.userData.legs = legs
  return o
}

/** Swing a horse's legs through a gallop; phase in radians. */
export function gallop(h: THREE.Group, phase: number) {
  const legs = h.userData.legs as THREE.Group[]
  // far front, far back, near front, near back
  const off = [0, Math.PI, 0.6, Math.PI + 0.6]
  const front = [true, false, true, false]
  legs.forEach((hip, i) => {
    const p = phase + off[i]
    hip.rotation.z = front[i] ? 0.55 * Math.sin(p) + 0.15 : 0.5 * Math.sin(p) - 0.1
    const knee = hip.userData.knee as THREE.Group
    knee.rotation.z = front[i] ? -Math.max(0, Math.sin(p + 1.2)) * 1.3 : Math.max(0, Math.sin(p - 1.0)) * 0.9
  })
}

/** A person in profile facing right, feet at y = 0, about 1.7 tall. */
export function person(opts: { skin?: string; cloth?: string; sash?: string; crown?: boolean; turban?: boolean; arm?: 'down' | 'point' | 'raise' | 'work'; scale?: number } = {}) {
  const skin = opts.skin ?? '#7a4a2c'
  const cloth = opts.cloth ?? '#f1e2c4'
  const o = g()
  const far = g()
  far.position.set(0.02, 1.32, -0.04)
  far.add(cut(capsule(0, 0, 0.18, -0.48, 0.06, 0.05), new THREE.Color(skin).multiplyScalar(0.8).getStyle(), 0))
  o.add(far)
  // legs, then the dhoti over them
  o.add(cut([capsule(-0.06, 0.62, -0.1, 0.04, 0.07, 0.05), capsule(0.08, 0.62, 0.14, 0.04, 0.07, 0.05)], skin, -0.02))
  o.add(cut([poly([[-0.1, 0.03], [0.04, 0.03], [0.02, -0.02], [-0.14, -0.02]]), poly([[0.1, 0.03], [0.26, 0.03], [0.24, -0.02], [0.08, -0.02]])], '#3a2412', -0.01))
  o.add(cut(smooth([[-0.2, 0.98], [0.2, 0.98], [0.3, 0.5], [0.22, 0.42], [0.02, 0.5], [-0.2, 0.44], [-0.26, 0.5]], 0.3), cloth, 0))
  // torso, head
  o.add(cut(smooth([[-0.16, 0.95], [0.18, 0.95], [0.2, 1.3], [0.12, 1.42], [-0.1, 1.42], [-0.18, 1.3]], 0.3), skin, 0.01))
  o.add(cut([circle(0.04, 1.58, 0.14), poly([[0.1, 1.55], [0.2, 1.52], [0.12, 1.47]]), rect(-0.02, 1.38, 0.1, 0.1)], skin, 0.015))
  if (opts.sash) o.add(cut([capsule(-0.14, 1.36, 0.16, 0.98, 0.045), rect(-0.2, 0.92, 0.42, 0.08)], opts.sash, 0.03))
  if (opts.crown) {
    const c = poly([[-0.1, 1.66], [0.16, 1.66], [0.14, 1.78], [0.09, 1.72], [0.03, 1.86], [-0.03, 1.72], [-0.08, 1.78]])
    o.add(cut([c, circle(0.03, 1.88, 0.03)], '#e8b04a', 0.03))
    o.add(cut([circle(-0.12, 1.52, 0.09), capsule(-0.12, 1.5, -0.16, 1.32, 0.05)], '#2b170a', 0.005))
  } else if (opts.turban) {
    o.add(cut(smooth([[-0.12, 1.62], [0.14, 1.64], [0.16, 1.74], [0.02, 1.8], [-0.14, 1.74]], 0.4), opts.sash ?? '#c4562e', 0.03))
  } else {
    o.add(cut([circle(-0.06, 1.68, 0.07), circle(-0.08, 1.58, 0.1)], '#2b170a', 0.005))
  }
  // near arm, from the shoulder: a pivot for gestures
  const arm = g()
  arm.position.set(0.04, 1.33, 0.04)
  arm.add(cut(capsule(0, 0, 0.02, -0.3, 0.055, 0.045), skin, 0))
  const fore = g()
  fore.position.set(0.02, -0.3, 0.005)
  fore.add(cut([capsule(0, 0, 0.0, -0.26, 0.045, 0.04), circle(0, -0.29, 0.05)], skin, 0))
  arm.add(fore)
  arm.userData.fore = fore
  const pose = opts.arm ?? 'down'
  if (pose === 'point') {
    arm.rotation.z = 1.35
    fore.rotation.z = 0.15
  } else if (pose === 'raise') {
    arm.rotation.z = 2.5
    fore.rotation.z = 0.3
  } else if (pose === 'work') {
    arm.rotation.z = 0.9
    fore.rotation.z = 1.0
  } else arm.rotation.z = 0.15
  o.add(arm)
  o.userData.arm = arm
  o.scale.setScalar(opts.scale ?? 1)
  return o
}

/** Surya in his chariot: a seated, haloed figure with two raised lotuses. */
export function surya() {
  const o = g()
  o.add(cut(circle(0, 1.55, 0.5), '#ffcf6a', -0.08, { glow: 0.6, shadow: false }))
  o.add(cut(star(0, 1.55, 0.62, 0.5, 20), '#f2a43a', -0.1, { glow: 0.35, shadow: false }))
  const skin = '#c87a3e'
  o.add(cut(smooth([[-0.28, 0.6], [0.28, 0.6], [0.3, 1.2], [0.15, 1.36], [-0.15, 1.36], [-0.3, 1.2]], 0.3), skin, 0))
  o.add(cut(circle(0, 1.52, 0.17), skin, 0.01))
  o.add(cut(poly([[-0.17, 1.62], [0.17, 1.62], [0.14, 1.82], [0.06, 1.74], [0, 1.94], [-0.06, 1.74], [-0.14, 1.82]]), '#e8b04a', 0.03))
  o.add(cut([capsule(-0.26, 1.24, -0.42, 0.98, 0.06), capsule(-0.42, 0.98, -0.42, 1.42, 0.05), capsule(0.26, 1.24, 0.42, 0.98, 0.06), capsule(0.42, 0.98, 0.42, 1.42, 0.05)], skin, 0.02))
  // lotuses
  for (const x of [-0.42, 0.42]) {
    const petals = [-0.7, -0.35, 0, 0.35, 0.7].map((a) => ellipse(x + Math.sin(a) * 0.08, 1.56 + Math.cos(a) * 0.06, 0.05, 0.11, -a))
    o.add(cut(petals, '#e86a6a', 0.04))
  }
  o.add(cut([rect(-0.3, 0.58, 0.6, 0.12), capsule(-0.18, 1.3, 0.18, 0.86, 0.04)], '#e8b04a', 0.03))
  return o
}

/** A chariot wheel seen face-on: rim, 8 thick and 8 thin spokes, hub, medallions. */
export function wheel(r: number, opts: { colors?: [string, string, string]; beads?: boolean } = {}) {
  const [stone, light, dark] = opts.colors ?? ['#a87d52', '#c9a273', '#6b4a2a']
  const o = g()
  const spin = g()
  o.add(spin)
  spin.add(cut(ring(0, 0, r, r * 0.83), stone, 0.0))
  spin.add(cut(ring(0, 0, r * 0.86, r * 0.8), dark, -0.02, { shadow: false }))
  const thin: THREE.Shape[] = []
  const thick: THREE.Shape[] = []
  const meds: THREE.Shape[] = []
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    const c = Math.cos(a)
    const s = Math.sin(a)
    if (i % 2) thin.push(capsule(c * r * 0.2, s * r * 0.2, c * r * 0.84, s * r * 0.84, r * 0.025))
    else {
      thick.push(capsule(c * r * 0.2, s * r * 0.2, c * r * 0.84, s * r * 0.84, r * 0.06, r * 0.045))
      meds.push(circle(c * r * 0.52, s * r * 0.52, r * 0.1))
    }
  }
  spin.add(cut(thin, light, 0.03))
  spin.add(cut(thick, stone, 0.06))
  spin.add(cut(meds, light, 0.1))
  spin.add(cut(meds.map((_, i) => {
    const a = (i / 8) * Math.PI * 2
    return circle(Math.cos(a) * r * 0.52, Math.sin(a) * r * 0.52, r * 0.05)
  }), dark, 0.13))
  spin.add(cut(circle(0, 0, r * 0.22), stone, 0.1))
  spin.add(cut(ring(0, 0, r * 0.16, r * 0.1), light, 0.14))
  spin.add(cut(circle(0, 0, r * 0.07), dark, 0.17))
  if (opts.beads) {
    const beads: THREE.Shape[] = []
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2
      beads.push(circle(Math.cos(a) * r * 0.915, Math.sin(a) * r * 0.915, r * 0.026))
    }
    spin.add(cut(beads, light, 0.04))
  }
  o.userData.spin = spin
  return o
}

/**
 * Konark from the side: plinth with wheels, the stepped jagamohana, and the deul's tower
 * (full, a ruin, or not yet built). Tiers are separate groups (userData.tiers) so they can
 * rise one by one. Base at y = 0, about 9 wide.
 */
export function temple(opts: { tower: 'full' | 'ruin' | 'none'; stone?: string; dark?: string; light?: string }) {
  const stone = opts.stone ?? '#8a6444'
  const dark = opts.dark ?? '#5b3d22'
  const light = opts.light ?? '#b48a5e'
  const o = g()
  const tiers: THREE.Group[] = []
  const tier = (build: (t: THREE.Group) => void) => {
    const t = g()
    build(t)
    o.add(t)
    tiers.push(t)
    return t
  }
  // plinth with its moulding bands
  tier((t) => {
    t.add(cut(rect(-4.4, 0, 8.8, 1.0), stone, 0))
    t.add(cut([rect(-4.5, 0.86, 9.0, 0.14), rect(-4.5, 0, 9.0, 0.1)], light, 0.04))
    t.add(cut(rect(-4.4, 0.36, 8.8, 0.08), dark, 0.04))
  })
  // wheels along the plinth
  tier((t) => {
    for (let i = 0; i < 6; i++) {
      const w = wheel(0.42, { colors: [light, '#d8b385', dark] })
      w.position.set(-3.6 + i * 1.44, 0.48, 0.08)
      t.add(w)
    }
  })
  // the deul (sanctuary) behind, on the left
  if (opts.tower !== 'none') {
    tier((t) => {
      t.position.z = -0.35
      const base: XY[] = [[-4.1, 1.0], [-1.1, 1.0], [-1.1, 2.6], [-4.1, 2.6]]
      if (opts.tower === 'ruin') {
        t.add(cut(poly([[-4.1, 1.0], [-1.1, 1.0], [-1.1, 2.0], [-1.6, 2.35], [-2.1, 2.1], [-2.7, 2.5], [-3.3, 2.15], [-3.8, 2.4], [-4.1, 2.1]]), dark, 0))
      } else {
        t.add(cut(poly(base), dark, 0))
        // curvilinear tower, ribbed
        const sh = new THREE.Shape()
        sh.moveTo(-4.0, 2.6)
        sh.bezierCurveTo(-4.05, 5.0, -3.4, 6.6, -2.95, 6.9)
        sh.lineTo(-2.25, 6.9)
        sh.bezierCurveTo(-1.8, 6.6, -1.15, 5.0, -1.2, 2.6)
        sh.closePath()
        t.add(cut(sh, dark, 0))
        const ribs: THREE.Shape[] = []
        for (let k = 0; k < 9; k++) ribs.push(rect(-3.95 + k * 0.012, 2.9 + k * 0.42, 2.7 - k * 0.024 - k * 0.07, 0.05))
        t.add(cut(ribs, stone, 0.03))
        t.add(cut([ellipse(-2.6, 7.05, 0.62, 0.16), rect(-2.75, 6.85, 0.3, 0.12)], stone, 0.03))
        t.add(cut([poly([[-2.75, 7.15], [-2.45, 7.15], [-2.52, 7.5], [-2.68, 7.5]]), circle(-2.6, 7.6, 0.09)], '#d9a441', 0.04))
      }
    })
  }
  // the jagamohana: walls, then three tiers of the pyramidal roof, then the crown
  tier((t) => {
    t.add(cut(rect(-0.9, 1.0, 4.4, 1.6), stone, 0))
    t.add(cut([rect(0.75, 1.0, 1.1, 1.25)], dark, 0.03))
    t.add(cut([rect(-0.9, 2.5, 4.4, 0.12), rect(-0.9, 1.6, 4.4, 0.06)], light, 0.03))
  })
  const step = (y: number, w: number) =>
    tier((t) => {
      t.add(cut(poly([[1.3 - w / 2, y], [1.3 + w / 2, y], [1.3 + w / 2 - 0.35, y + 0.5], [1.3 - w / 2 + 0.35, y + 0.5]]), stone, 0))
      t.add(cut(rect(1.3 - w / 2 + 0.1, y + 0.48, w - 0.2, 0.1), light, 0.03))
      // figures on the terrace
      const figs: THREE.Shape[] = []
      const n = Math.round(w / 0.55)
      for (let k = 0; k < n; k++) {
        const x = 1.3 - w / 2 + 0.45 + (k * (w - 0.9)) / Math.max(1, n - 1)
        figs.push(capsule(x, y + 0.6, x, y + 0.82, 0.05), circle(x, y + 0.88, 0.05))
      }
      if (w < 4.6) t.add(cut(figs, dark, 0.04))
    })
  step(2.6, 4.8)
  step(3.25, 3.8)
  step(3.9, 2.8)
  tier((t) => {
    t.add(cut(poly([[0.55, 4.55], [2.05, 4.55], [1.7, 5.0], [0.9, 5.0]]), stone, 0))
    t.add(cut([ellipse(1.3, 5.1, 0.55, 0.14)], light, 0.02))
    t.add(cut([poly([[1.15, 5.2], [1.45, 5.2], [1.38, 5.5], [1.22, 5.5]]), circle(1.3, 5.6, 0.08)], '#d9a441', 0.03))
  })
  // stairs and the lions at the east end
  tier((t) => {
    t.add(cut(poly([[3.5, 0], [4.9, 0], [4.9, 0.2], [4.6, 0.2], [4.6, 0.45], [4.3, 0.45], [4.3, 0.7], [4.0, 0.7], [4.0, 1.0], [3.5, 1.0]]), light, 0.12))
  })
  o.userData.tiers = tiers
  return o
}
