import * as THREE from 'three'
import { Builder } from './builder'

/** Ribbed amalaka disc: a lathe with radial fluting. */
export function amalakaGeometry(R: number, H: number, ribs = 24) {
  const pts: THREE.Vector2[] = []
  const steps = 14
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    pts.push(new THREE.Vector2(R * (0.42 + 0.58 * Math.sin(Math.PI * t)), H * t))
  }
  const g = new THREE.LatheGeometry(pts, ribs * 4)
  const p = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const z = p.getZ(i)
    const a = Math.atan2(z, x)
    const f = 0.9 + 0.1 * Math.abs(Math.cos((a * ribs) / 2))
    p.setX(i, x * f)
    p.setZ(i, z * f)
  }
  g.computeVertexNormals()
  return g
}

/** Kalasha finial: a pot with neck, lip and tip. */
export function kalashaGeometry(R: number, H: number) {
  const prof: [number, number][] = [
    [0.0, 0],
    [0.55, 0],
    [0.6, 0.06],
    [0.45, 0.12],
    [0.85, 0.3],
    [1.0, 0.42],
    [0.85, 0.55],
    [0.35, 0.66],
    [0.3, 0.72],
    [0.55, 0.76],
    [0.3, 0.8],
    [0.15, 0.92],
    [0.0, 1.0],
  ]
  return new THREE.LatheGeometry(
    prof.map(([r, y]) => new THREE.Vector2(r * R, y * H)),
    24,
  )
}

/** Konark chariot wheel: rim with medallions, hub, 8 major and 8 minor spokes. Axle along Z, front face +Z. */
export function wheelGeometry(R = 1.5) {
  // Konark's wheels: eight broad spokes swelling to a carved medallion, eight slender spokes
  // between them, a rim banded with beads and leaves, and a lotus hub on a projecting axle.
  const b = new Builder()
  const K = 'khondalite'
  const ring = (outer: number, inner: number, depth: number, z: number) => {
    const s = new THREE.Shape()
    s.absarc(0, 0, outer, 0, Math.PI * 2, false)
    const hole = new THREE.Path()
    hole.absarc(0, 0, inner, 0, Math.PI * 2, true)
    s.holes.push(hole)
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1, curveSegments: 48 })
    b.add(K, g, { pos: [0, 0, z - depth / 2] })
  }
  // rim: outer tyre, a recessed carved band, inner lip
  ring(R, R - 0.1, 0.46, 0)
  ring(R - 0.1, R - 0.3, 0.36, -0.02)
  ring(R - 0.3, R - 0.38, 0.44, 0)
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2
    b.add(K, new THREE.SphereGeometry(0.055, 6, 4), { pos: [Math.cos(a) * (R - 0.2), Math.sin(a) * (R - 0.2), 0.17], scale: [1, 1, 0.6] })
  }
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2 + Math.PI / 24
    b.add(K, new THREE.ConeGeometry(0.07, 0.16, 6), { pos: [Math.cos(a) * (R - 0.05), Math.sin(a) * (R - 0.05), 0.23], rot: [0, 0, a - Math.PI / 2], scale: [1, 1, 0.4] })
  }
  const inner = 0.42
  const outer = R - 0.36
  const len = outer - inner
  // broad spoke outline along +X, swelling at the middle
  const spoke = new THREE.Shape()
  spoke.moveTo(inner, -0.1)
  spoke.quadraticCurveTo(inner + len * 0.5, -0.26, outer, -0.11)
  spoke.lineTo(outer, 0.11)
  spoke.quadraticCurveTo(inner + len * 0.5, 0.26, inner, 0.1)
  spoke.closePath()
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    const c = Math.cos(a)
    const sn = Math.sin(a)
    if (i % 2 === 0) {
      const g = new THREE.ExtrudeGeometry(spoke, { depth: 0.26, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 1, curveSegments: 8 })
      b.add(K, g, { pos: [0, 0, -0.13], rot: [0, 0, a] })
      // medallion: a raised disc in a beaded ring, with a seated figure in relief
      const m = inner + len * 0.52
      b.add(K, new THREE.CylinderGeometry(0.17, 0.17, 0.07, 24), { pos: [c * m, sn * m, 0.16], rot: [Math.PI / 2, 0, 0] })
      b.add(K, new THREE.TorusGeometry(0.17, 0.022, 6, 24), { pos: [c * m, sn * m, 0.2] })
      b.add(K, new THREE.SphereGeometry(0.09, 10, 8), { pos: [c * m, sn * m - 0.02, 0.2], scale: [0.7, 0.9, 0.45] })
      b.add(K, new THREE.SphereGeometry(0.05, 8, 6), { pos: [c * m, sn * m + 0.07, 0.2], scale: [0.7, 0.7, 0.5] })
    } else {
      // slender spoke with a bead at its middle
      const mid = inner + len / 2
      b.add(K, new THREE.CylinderGeometry(0.045, 0.06, len, 10), { pos: [c * mid, sn * mid, 0], rot: [0, 0, a - Math.PI / 2] })
      b.add(K, new THREE.SphereGeometry(0.08, 10, 8), { pos: [c * mid, sn * mid, 0] })
    }
  }
  // hub: a drum ringed with lotus petals, a boss, and the axle behind
  b.add(K, new THREE.CylinderGeometry(0.42, 0.44, 0.5, 32), { rot: [Math.PI / 2, 0, 0] })
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    b.add(K, new THREE.SphereGeometry(0.12, 10, 8), { pos: [Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0.26], rot: [0, 0, a], scale: [1.4, 0.7, 0.4] })
  }
  b.add(K, new THREE.SphereGeometry(0.2, 16, 12), { pos: [0, 0, 0.3], scale: [1, 1, 0.7] })
  b.add(K, new THREE.CylinderGeometry(0.18, 0.18, 0.9, 16), { pos: [0, 0, -0.55], rot: [Math.PI / 2, 0, 0] })
  return b.build().get(K)!
}
