import * as THREE from 'three'
import { HALL } from './layout'
import { CHAMBER, CX } from './chamber'

// One continuous camera for scenes 1–2, driven by scroll progress p:
//   0 → 1   walk the hall to its doorway
//   1 → 1.3 step through the passage into the chamber
//   1.3 → 1.7 drift toward the lit platform
//   1.7 → 2 rise and tilt down until the platform fills the view
const P = CHAMBER.platform
const KEYS: { p: number; pos: [number, number, number]; look: [number, number, number] }[] = [
  { p: 0, pos: [0.15, 1.62, HALL.start + 3], look: [0.05, 1.52, HALL.start - 5] },
  { p: 0.85, pos: [CX + 0.05, 1.62, HALL.end + 7], look: [CX, 1.5, HALL.end - 2] },
  { p: 1, pos: [CX, 1.62, HALL.end + 2.6], look: [CX, 1.45, HALL.end - 6] },
  { p: 1.3, pos: [CX, 1.66, CHAMBER.z0 - 1.2], look: [CX + 0.2, 1.2, P.z - 1.5] },
  { p: 1.7, pos: [CX + 0.25, 2.35, P.z + 2.3], look: [CX, 0.7, P.z - 0.1] },
  { p: 2, pos: [CX, 2.25, P.z + 0.18], look: [CX, P.h, P.z] },
]
const posCurve = new THREE.CatmullRomCurve3(KEYS.map((k) => new THREE.Vector3(...k.pos)), false, 'centripetal')
const lookCurve = new THREE.CatmullRomCurve3(KEYS.map((k) => new THREE.Vector3(...k.look)), false, 'centripetal')

function curveParam(p: number) {
  const n = KEYS.length
  const c = Math.min(KEYS[n - 1].p, Math.max(0, p))
  let i = 0
  while (i < n - 2 && c > KEYS[i + 1].p) i++
  const f = (c - KEYS[i].p) / (KEYS[i + 1].p - KEYS[i].p)
  return (i + f) / (n - 1)
}

export function entryCamera(p: number, t: number, still: boolean) {
  const u = curveParam(p)
  const pos = posCurve.getPoint(u)
  const look = lookCurve.getPoint(u)
  if (!still) {
    // a slow breathing sway, fading out as the camera settles over the platform
    const k = 1 - THREE.MathUtils.smoothstep(p, 1.5, 1.9)
    pos.x += (Math.sin(p * 5.5) * 0.1 + Math.sin(t * 0.35) * 0.02) * k
    pos.y += Math.sin(t * 0.6) * 0.012 * k
    look.x += Math.sin(t * 0.21) * 0.05 * k
  }
  return { pos, look }
}
