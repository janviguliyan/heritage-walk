import * as THREE from 'three'
import { bird, capsule, circle, clamp01, cut, easeInOut, easeOutBack, ellipse, holes, palm, poly, rect, smooth, waves } from './kit'
import { gallop, horse, person, puff, sun, surya, temple, wheel } from './figures'

// The six scenes of the Konark story, each a small paper diorama. A scene's layers pop up
// back to front when it begins (Shot.layers), and fold away when the next one arrives.

type V3 = [number, number, number]
export type Shot = {
  group: THREE.Group
  layers: THREE.Object3D[]
  sky: [string, string]
  light: { pos: V3; color: string; intensity: number; ambient: number }
  cam: { from: V3; to: V3; lookFrom: V3; lookTo: V3 }
  /** s: seconds into the scene; k: 0..1 through its expected length */
  update: (s: number, k: number) => void
  /** one-off sounds on cue */
  cue?: (s: number, prev: number) => void
}

function layer(parent: THREE.Group, z: number, ...items: THREE.Object3D[]) {
  const l = new THREE.Group()
  l.position.z = z
  l.add(...items)
  parent.add(l)
  return l
}

/** A thin band of foam riding a wave's crest: the same curve, twice, a little apart. */
function foam(x0: number, x1: number, y: number, amp: number, wavelength: number, phase: number, thick: number) {
  const top: [number, number][] = []
  const steps = Math.ceil(((x1 - x0) / wavelength) * 16)
  for (let i = 0; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps
    const k = ((x - x0) / wavelength + phase) * Math.PI * 2
    top.push([x, y + amp * (1 - Math.abs(Math.sin(k / 2))) * 1.6 - amp * 0.6])
  }
  return poly([...top, ...top.map(([x, yy]) => [x, yy - thick] as [number, number]).reverse()])
}

/** A simple elephant in profile facing right, feet at y = 0, about 1.4 long. */
function elephant(color: string) {
  const o = new THREE.Group()
  o.add(
    cut(
      [
        smooth([[-0.6, 0.45], [-0.55, 0.9], [-0.1, 1.05], [0.35, 0.98], [0.62, 0.8], [0.7, 0.5], [0.5, 0.4], [-0.4, 0.38]]),
        smooth([[0.55, 0.95], [0.85, 0.85], [0.9, 0.5], [0.86, 0.15], [0.78, 0.1], [0.76, 0.5], [0.6, 0.6]], 0.4),
        capsule(-0.45, 0.45, -0.45, 0, 0.11),
        capsule(-0.15, 0.45, -0.15, 0, 0.11),
        capsule(0.25, 0.45, 0.25, 0, 0.11),
        capsule(0.5, 0.45, 0.5, 0, 0.11),
        capsule(-0.58, 0.8, -0.72, 0.45, 0.025),
      ],
      color,
      0,
    ),
  )
  o.add(cut(ellipse(0.45, 0.78, 0.18, 0.24, 0.2), new THREE.Color(color).multiplyScalar(0.8).getStyle(), 0.03))
  return o
}

/** Shot 1: dawn over the Bay of Bengal. */
function dawn(): Shot {
  const g = new THREE.Group()
  const s = sun(1.15)
  const sunL = layer(g, 0.2, s)
  s.position.set(2.6, -1.6, 0)
  const clouds = layer(g, 0.45, puff(-4.6, 3.0, 4.2, 0.8, 1, '#ffc7a8', '#d98a8a', 0.35), puff(4.8, 3.6, 3.0, 0.65, 2, '#ffc7a8', '#d98a8a', 0.35), puff(0.6, 4.3, 2.4, 0.5, 3, '#f7b39a', '#c67a84', 0.3))
  const seaCols = ['#3b6d86', '#2d5a72', '#21465c', '#163346']
  const seas = seaCols.map((c, i) => {
    const w = cut(waves(-13, 13, -0.55 - i * 0.62, -9, 0.16 + i * 0.03, 1.7 + i * 0.35, i * 0.37), c, 0)
    w.add(cut(foam(-13, 13, -0.55 - i * 0.62 + 0.005, 0.16 + i * 0.03, 1.7 + i * 0.35, i * 0.37, 0.045), new THREE.Color(c).lerp(new THREE.Color('#fff4e0'), 0.55).getStyle(), 0.03, { shadow: false }))
    // the sun's path on the water: gold flecks on each wave band
    const fl = cut(
      [0, 1, 2].map((k) => ellipse(2.6 + (k - 1) * (0.5 + i * 0.25) + Math.sin(i * 3 + k) * 0.2, -0.85 - i * 0.62 - k * 0.05, 0.28 - i * 0.03, 0.05)),
      '#ffcf6a',
      0.035,
      { glow: 0.8, shadow: false },
    )
    return layer(g, 0.75 + i * 0.4, w, fl)
  })
  const birds = layer(g, 2.4, cut([bird(-1.6, 2.2, 0.22), bird(-1.0, 2.5, 0.16), bird(-0.4, 2.15, 0.19)], '#2b1d2a', 0))
  return {
    group: g,
    layers: [sunL, clouds, ...seas, birds],
    sky: ['#1d2457', '#ff9d5c'],
    light: { pos: [3, 2.2, 8], color: '#ffd2a0', intensity: 2.4, ambient: 0.75 },
    cam: { from: [0, 0.2, 15], to: [0.4, 0.5, 12.2], lookFrom: [0, 0.2, 0], lookTo: [0.6, 0.4, 0] },
    update(t, k) {
      s.position.y = -1.6 + easeInOut(clamp01(k * 1.1)) * 2.6
      ;(s.userData.rays as THREE.Object3D).rotation.z = t * 0.05
      seas.forEach((l, i) => (l.position.x = Math.sin(t * 0.5 + i * 1.3) * (0.12 + i * 0.05)))
      clouds.position.x = -t * 0.08
      birds.position.set(t * 0.35, Math.sin(t * 0.8) * 0.12, birds.position.z)
    },
  }
}

/** Shot 2: the Sun's chariot and seven horses running through the clouds. */
function chariot(): Shot {
  const g = new THREE.Group()
  const s = sun(2.1)
  s.position.set(1.4, 1.5, 0)
  const back = layer(g, 0.1, s)
  const cloudsFar = layer(g, 0.5, puff(-6, 1.2, 4, 0.9, 4, '#fff1d6', '#e9c38e'), puff(2, 0.4, 5, 1.0, 5, '#fff1d6', '#e9c38e'), puff(9, 1.0, 4, 0.8, 6, '#fff1d6', '#e9c38e'))
  const team = new THREE.Group()
  const horses: THREE.Group[] = []
  for (let i = 0; i < 7; i++) {
    const h = horse()
    const row = i % 2
    h.position.set(0.9 + i * 0.62, -1.15 + row * 0.38 - i * 0.03, (6 - i) * 0.02 + row * -0.12)
    h.scale.setScalar(1.05)
    horses.push(h)
    team.add(h)
  }
  const reins = cut(horses.map((h) => capsule(-0.3, 0.3, h.position.x + 0.95, h.position.y + 1.5, 0.01)), '#e0a032', -0.08, { shadow: false })
  team.add(reins)
  const car = new THREE.Group()
  const w = wheel(1.05, { colors: ['#c98a3a', '#f0c070', '#7a4a1c'], beads: true })
  w.position.set(-1.6, -0.75, 0.25)
  const canopy = smooth([[-3.1, 2.0], [-0.1, 2.0], [-0.5, 2.35], [-1.6, 2.75], [-2.7, 2.35]], 0.35)
  // lotus scallops along the canopy's lower edge
  const scallops: THREE.Shape[] = []
  for (let i = 0; i < 9; i++) scallops.push(circle(-3.0 + i * 0.36, 2.0, 0.17))
  const bodyShape = holes(poly([[-2.9, -0.35], [-0.3, -0.35], [0.1, 0.25], [-0.2, 0.32], [-2.7, 0.22]]), [0, 1, 2, 3, 4].map((i) => circle(-2.5 + i * 0.48, -0.06, 0.08)))
  const body = cut([bodyShape, rect(-2.75, 0.2, 0.08, 1.9), rect(-0.5, 0.25, 0.08, 1.8), holes(canopy, [0, 1, 2, 3, 4, 5].map((i) => circle(-2.65 + i * 0.44, 2.28 + Math.sin(i * 0.6) * 0.06, 0.05))), ...scallops], '#a8283a', 0.1)
  const trim = cut([rect(-2.95, -0.2, 2.9, 0.08), rect(-3.05, 1.98, 2.95, 0.07), circle(-1.6, 2.86, 0.12), poly([[-1.66, 2.8], [-1.54, 2.8], [-1.6, 3.15]])], '#e8b04a', 0.16, { glow: 0.12 })
  const lining = cut(poly([[-2.85, 0.25], [-0.45, 0.25], [-0.45, 1.98], [-2.85, 1.98]]), '#5a1a22', -0.12)
  const god = surya()
  god.position.set(-1.6, -0.15, 0.05)
  god.scale.setScalar(0.95)
  car.add(lining, god, body, trim, w)
  const mid = layer(g, 1.0, car, team)
  const cloudsNear = layer(g, 2.2, puff(-7, -2.4, 5, 1.1, 7), puff(1, -2.7, 6, 1.2, 8), puff(9, -2.3, 5, 1.0, 9))
  return {
    group: g,
    layers: [back, cloudsFar, mid, cloudsNear],
    sky: ['#f5c45f', '#ea8448'],
    light: { pos: [-4, 4, 8], color: '#fff0cf', intensity: 2.6, ambient: 0.8 },
    cam: { from: [-0.6, 0.3, 14.5], to: [0.9, 0.5, 12.5], lookFrom: [-0.4, 0.3, 0], lookTo: [0.9, 0.3, 0] },
    update(t) {
      const rays = s.userData.rays as THREE.Object3D
      rays.rotation.z = -t * 0.08
      rays.children[0].rotation.z = t * 0.16
      horses.forEach((h, i) => {
        gallop(h, t * 7 + i * 0.9)
        h.userData.y ??= h.position.y
        h.position.y = h.userData.y + Math.abs(Math.sin(t * 7 + i * 0.9)) * 0.06
        h.rotation.z = Math.sin(t * 7 + i * 0.9 + 0.8) * 0.03
      })
      ;(w.userData.spin as THREE.Object3D).rotation.z = -t * 1.6
      mid.position.y = Math.sin(t * 1.3) * 0.06
      cloudsFar.position.x = 2 - ((t * 0.6) % 8)
      cloudsNear.position.x = 4 - ((t * 1.6) % 8)
    },
  }
}

/** Shot 3: the king on the shore, imagining the temple. */
function king(): Shot {
  const g = new THREE.Group()
  const sea = layer(g, 0.2, cut(waves(-13, 13, -0.2, -9, 0.06, 1.2, 0), '#4a8098', 0), cut(waves(-13, 13, -0.55, -9, 0.07, 1.5, 0.3), '#3b6f88', 0.15))
  const vision = temple({ tower: 'full', stone: '#f7dfa6', dark: '#f0cd86', light: '#fff0c8' })
  vision.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh) m.castShadow = false
  })
  vision.scale.setScalar(0.5)
  vision.position.set(2.2, -0.9, 0)
  const ghost = layer(g, 0.55, vision)
  const dune = layer(g, 0.9, cut(smooth([[-13, -9], [-13, -0.9], [-6, -0.7], [0, -1.05], [6, -0.75], [13, -0.95], [13, -9]], 0.2), '#e2c28f', 0))
  const palmsBack = layer(g, 1.25, cut([...palm(-6.2, -1.0, 3.4, 0.12), ...palm(-4.9, -1.0, 2.8, -0.1), ...palm(6.4, -0.9, 3.2, -0.15)], '#3d5a34', 0))
  const sand = layer(g, 1.6, cut(smooth([[-13, -9], [-13, -1.9], [-4, -1.7], [3, -2.05], [13, -1.8], [13, -9]], 0.2), '#d3ae78', 0))
  const k = person({ crown: true, cloth: '#f5e4c0', sash: '#b0303a', arm: 'point', skin: '#7a4a2c' })
  k.position.set(-2.6, -2.05, 0.1)
  k.scale.setScalar(1.25)
  const bearer = person({ turban: true, sash: '#c4562e', arm: 'raise', skin: '#6b3f24' })
  bearer.position.set(-3.5, -2.05, -0.15)
  bearer.scale.setScalar(1.15)
  const parasol = cut([capsule(-3.12, -0.1, -3.2, 0.25 + 1.2, 0.025), smooth([[-3.95, 1.25], [-2.45, 1.25], [-2.7, 1.6], [-3.2, 1.75], [-3.7, 1.6]], 0.4)], '#b0303a', -0.1)
  const fringe = cut([-3.85, -3.6, -3.35, -3.1, -2.85, -2.6].map((x) => circle(x, 1.22, 0.06)), '#e8b04a', -0.06)
  const scholar = person({ turban: true, sash: '#4c7d8f', arm: 'work', skin: '#835232', cloth: '#efe2c8' })
  scholar.position.set(-1.5, -2.05, -0.05)
  scholar.scale.set(-1.1, 1.1, 1.1)
  const leaf = cut(rect(-1.9, -0.75, 0.5, 0.1), '#c9a45c', 0.12)
  const people = layer(g, 2.0, parasol, fringe, bearer, k, scholar, leaf)
  const palmsFront = layer(g, 2.8, cut([...palm(-7.6, -3.5, 4.6, 0.18), ...palm(7.2, -3.6, 4.2, -0.2)], '#2a3f25', 0))
  return {
    group: g,
    layers: [sea, ghost, dune, palmsBack, sand, people, palmsFront],
    sky: ['#f2d39b', '#e7a86e'],
    light: { pos: [5, 4, 9], color: '#fff2d8', intensity: 2.5, ambient: 0.8 },
    cam: { from: [-1.2, 0, 14], to: [-0.6, 0.1, 11.4], lookFrom: [-0.5, 0, 0], lookTo: [-0.2, 0.0, 0] },
    update(t, kk) {
      // the temple appears in the air as he speaks, as if imagined
      const a = easeOutBack(clamp01((kk - 0.12) * 2.2))
      vision.position.y = -3.4 + a * 2.55
      vision.scale.setScalar(0.5 * (0.85 + 0.15 * clamp01(a)))
      vision.rotation.z = Math.sin(t * 0.6) * 0.004
      ;(k.userData.arm as THREE.Object3D).rotation.z = 1.35 + Math.sin(t * 1.4) * 0.05
      palmsFront.rotation.z = Math.sin(t * 0.7) * 0.004
      sea.position.x = Math.sin(t * 0.4) * 0.08
    },
  }
}

/** Shot 4: the temple rises, tier by tier, under the artisans' chisels. */
function build(): Shot {
  const g = new THREE.Group()
  const hills = layer(g, 0.1, cut(smooth([[-13, -9], [-13, -0.6], [-7, 0.2], [-3, -0.4], [3, 0.1], [8, -0.5], [13, 0], [13, -9]], 0.3), '#c9935d', 0))
  const t = temple({ tower: 'full', stone: '#b98c5c', dark: '#8a6040', light: '#dcb582' })
  t.scale.setScalar(0.62)
  t.position.set(-0.4, -1.6, 0)
  const tiers = t.userData.tiers as THREE.Group[]
  const poles: THREE.Shape[] = []
  // scaffolding around the tower only, where the work is
  for (let i = 0; i < 4; i++) poles.push(capsule(-2.9 + i * 0.68, -1.6, -2.9 + i * 0.68 + 0.04, 3.0 - Math.abs(i - 1.5) * 0.4, 0.025))
  for (let j = 0; j < 4; j++) poles.push(capsule(-3.0, -0.7 + j * 0.9, -0.7, -0.7 + j * 0.9, 0.02))
  const scaffold = cut(poles, '#8a6440', 0.5)
  const main = layer(g, 0.6, t, scaffold)
  const ramp = cut(poly([[3.2, -2.1], [7.5, -2.1], [3.2, -0.6]]), '#a97b4f', 0)
  const block = cut(rect(-0.25, 0, 0.5, 0.32), '#9b6d45', 0.05)
  const hauler = person({ turban: true, sash: '#c4562e', arm: 'point', skin: '#6b3f24' })
  hauler.scale.set(-0.9, 0.9, 0.9)
  const hauling = new THREE.Group()
  hauling.add(block, hauler)
  hauler.position.set(0.85, 0.05, 0)
  const rope = cut(capsule(0.2, 0.2, 0.75, 1.1, 0.015), '#3a2412', 0.06)
  hauling.add(rope)
  const rampL = layer(g, 1.2, ramp, hauling)
  const workers = [0, 1, 2].map((i) => {
    const p = person({ turban: i !== 1, sash: ['#c4562e', '#4c7d8f', '#b0303a'][i], arm: 'work', skin: ['#6b3f24', '#7a4a2c', '#835232'][i] })
    p.position.set(-4.4 + i * 3.0, -2.6, 0)
    p.scale.setScalar(0.85)
    // a chisel and a stone to work on
    p.add(cut(rect(0.45, 0, 0.6, 0.55), '#a87d52', -0.06), cut(capsule(0.3, 1.0, 0.48, 0.8, 0.02), '#3a2412', 0.06))
    return p
  })
  const ground = cut(smooth([[-13, -9], [-13, -2.5], [-5, -2.35], [2, -2.6], [13, -2.4], [13, -9]], 0.3), '#c99a66', 0)
  const front = layer(g, 1.9, ground, ...workers)
  const dust = cut(Array.from({ length: 26 }, (_, i) => circle(-6 + ((i * 47) % 120) / 10, -2 + ((i * 31) % 50) / 10, 0.015 + (i % 3) * 0.008)), '#fff0cf', 0, { shadow: false, glow: 0.6 })
  const air = layer(g, 2.6, dust)
  return {
    group: g,
    layers: [hills, main, rampL, front, air],
    sky: ['#f2d4a2', '#d9a066'],
    light: { pos: [-5, 5, 8], color: '#ffe3b8', intensity: 2.6, ambient: 0.75 },
    cam: { from: [0, 0.2, 13.6], to: [-0.3, 0.5, 12.2], lookFrom: [0, -0.1, 0], lookTo: [-0.3, 0.3, 0] },
    update(s, k) {
      // tiers rise from the plinth up, one after another, over most of the scene
      tiers.forEach((tr, i) => {
        const a = clamp01(k * 1.35 * tiers.length - i * 0.95)
        tr.scale.set(1, Math.max(0.001, easeOutBack(a)), 1)
        tr.visible = a > 0
      })
      scaffold.visible = k < 0.95
      workers.forEach((p, i) => {
        const arm = p.userData.arm as THREE.Object3D
        const ph = s * 5.2 + i * 2.1
        arm.rotation.z = 0.9 + Math.max(0, Math.sin(ph)) * 0.55
      })
      hauling.position.set(3.4 + (k * 3.2) % 3.2, -2.05 + ((k * 3.2) % 3.2) * 0.35, 0)
      air.position.set(Math.sin(s * 0.3) * 0.3, (s * 0.05) % 0.5, air.position.z)
    },
    cue(s, prev) {
      // a chisel tap at each stroke
      const strokes = (x: number) => Math.floor((x * 5.2) / (Math.PI * 2))
      if (strokes(s) !== strokes(prev)) window.dispatchEvent(new CustomEvent('reel-chisel'))
    },
  }
}

/** Shot 5: one great wheel; the sun crosses and the spokes' shadows turn like a clock. */
function wheelShot(): Shot {
  const g = new THREE.Group()
  const wall = layer(g, 0.1, cut(rect(-13, -9, 26, 18), '#a27a52', 0))
  const bands: THREE.Object3D[] = [cut([rect(-13, 3.4, 26, 0.5), rect(-13, -3.9, 26, 0.5)], '#c49a6c', 0)]
  // friezes above and below: elephants in procession, dancers
  for (let i = 0; i < 9; i++) {
    const e = elephant('#7a5534')
    e.position.set(-8 + i * 2.0, 3.95, 0.02)
    e.scale.setScalar(0.5)
    bands.push(e)
    const d = person({ arm: i % 2 ? 'raise' : 'point', skin: '#7a5534', cloth: '#7a5534', scale: 0.42 })
    d.position.set(-8.5 + i * 2.0, -3.9, 0.02)
    bands.push(d)
  }
  const frieze = layer(g, 0.25, ...bands)
  const w = wheel(3.0, { colors: ['#a87d52', '#caa47a', '#5b3d22'], beads: true })
  const wl = layer(g, 0.6, w)
  const axle = layer(g, 1.25, cut([circle(0, 0, 0.42)], '#8a6444', 0), cut(circle(0, 0, 0.18), '#c9a273', 0.06))
  return {
    group: g,
    layers: [wall, frieze, wl, axle],
    sky: ['#a27a52', '#a27a52'],
    light: { pos: [-7, 5, 4], color: '#ffe0b0', intensity: 3.2, ambient: 0.5 },
    cam: { from: [0, 0, 16], to: [0.3, 0.2, 12.6], lookFrom: [0, 0, 0], lookTo: [0.2, 0.1, 0] },
    update(_s, k) {
      // the sun sweeps across the sky: low east, high noon, low west
      const a = Math.PI * (0.15 + 0.7 * k)
      this.light.pos = [-Math.cos(a) * 8, Math.sin(a) * 6 + 0.5, 4.2]
    },
  }
}

/** Shot 6: Konark today at sunrise; the camera draws back to the whole temple. */
function arrive(): Shot {
  const g = new THREE.Group()
  const s = sun(0.85)
  s.position.set(4.6, -0.2, 0)
  const sunL = layer(g, 0.15, s)
  const sea = layer(g, 0.3, cut(waves(-14, 14, -0.9, -9, 0.06, 1.3, 0.2), '#3c5f7a', 0), cut(ellipse(4.6, -1.0, 0.9, 0.06), '#ffcf6a', 0.04, { glow: 0.9, shadow: false }))
  const t = temple({ tower: 'ruin', stone: '#7d5a3e', dark: '#4e3420', light: '#a37b55' })
  t.scale.setScalar(0.78)
  t.position.set(-1.3, -1.9, 0)
  const horses = [0, 1].map((i) => {
    const h = horse('#8a6444', '#6b4a2a', '#a37b55')
    h.scale.setScalar(0.48)
    h.position.set(2.6 + i * 0.55, -1.9, 0.18 + i * 0.05)
    return h
  })
  const main = layer(g, 0.7, t, ...horses)
  const palms = layer(g, 1.3, cut([...palm(-7.2, -2.2, 3.6, 0.1), ...palm(-6.1, -2.2, 3.0, -0.12), ...palm(6.8, -2.1, 3.4, -0.14), ...palm(7.8, -2.1, 2.7, 0.1)], '#283c25', 0))
  const fg = layer(g, 1.9, cut(smooth([[-14, -9], [-14, -2.0], [-6, -1.85], [0, -2.15], [6, -1.9], [14, -2.05], [14, -9]], 0.3), '#3a2a1c', 0))
  return {
    group: g,
    layers: [sunL, sea, main, palms, fg],
    sky: ['#3a3765', '#f3a15d'],
    light: { pos: [7, 2.5, 7], color: '#ffc994', intensity: 2.6, ambient: 0.6 },
    cam: { from: [-0.4, 0.2, 9.5], to: [0, 0.6, 14.5], lookFrom: [-0.6, 0.1, 0], lookTo: [0, 0.3, 0] },
    update(tt, k) {
      s.position.y = -0.4 + easeInOut(clamp01(k)) * 1.3
      ;(s.userData.rays as THREE.Object3D).rotation.z = tt * 0.04
    },
  }
}

export function buildShots(): Shot[] {
  return [dawn(), chariot(), king(), build(), wheelShot(), arrive()]
}
