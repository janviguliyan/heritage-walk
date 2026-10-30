import * as THREE from 'three'
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Sculpting with signed distance fields. A form is a list of primitives (spheres, ellipsoids,
// tapered limbs, tori, rounded boxes) blended with a smooth minimum, so muscles, folds and
// ornaments flow into each other the way carved stone does. three's MarchingCubes turns the
// field into a smooth mesh. Negative distance = inside. Units are metres.

export type V = [number, number, number]

interface Prim {
  /** distance from point to the primitive's surface */
  d: (x: number, y: number, z: number) => number
  /** bounding sphere, for skipping far primitives */
  c: V
  r: number
  /** blend radius with what came before; negative = carve away (smooth subtraction) */
  k: number
}

const len3 = (x: number, y: number, z: number) => Math.sqrt(x * x + y * y + z * z)

/** Coarser sculpture for slow devices (phones): every mesh's cell sizes are multiplied by this,
 *  so a statue is sculpted at a larger grain from the start (far quicker than simplifying after). */
let grain = 1
export function setSculptGrain(k: number) {
  grain = k
}

export class Sculpt {
  readonly prims: Prim[] = []

  private push(d: Prim['d'], c: V, r: number, k: number) {
    this.prims.push({ d, c, r, k })
    return this
  }

  sphere(c: V, r: number, k = 0.06) {
    return this.push((x, y, z) => len3(x - c[0], y - c[1], z - c[2]) - r, c, r, k)
  }

  /** ellipsoid with radii r, rotated by Euler angles (radians) */
  ellipsoid(c: V, r: V, rot: V = [0, 0, 0], k = 0.06) {
    const inv = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot)).invert().elements
    return this.push(
      (x, y, z) => {
        const px = x - c[0]
        const py = y - c[1]
        const pz = z - c[2]
        const lx = (inv[0] * px + inv[4] * py + inv[8] * pz) / r[0]
        const ly = (inv[1] * px + inv[5] * py + inv[9] * pz) / r[1]
        const lz = (inv[2] * px + inv[6] * py + inv[10] * pz) / r[2]
        const k0 = len3(lx, ly, lz)
        const k1 = len3(lx / r[0], ly / r[1], lz / r[2])
        return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(...r)
      },
      c,
      Math.max(...r),
      k,
    )
  }

  /** a limb: a cone with rounded ends from a (radius ra) to b (radius rb) */
  limb(a: V, b: V, ra: number, rb: number, k = 0.06) {
    const bax = b[0] - a[0]
    const bay = b[1] - a[1]
    const baz = b[2] - a[2]
    const l2 = bax * bax + bay * bay + baz * baz
    const rr = ra - rb
    const a2 = l2 - rr * rr
    const il2 = 1 / l2
    const c: V = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
    return this.push(
      (x, y, z) => {
        // round cone (iq)
        const pax = x - a[0]
        const pay = y - a[1]
        const paz = z - a[2]
        const yy = pax * bax + pay * bay + paz * baz
        const zz = yy - l2
        const qx = pax * l2 - bax * yy
        const qy = pay * l2 - bay * yy
        const qz = paz * l2 - baz * yy
        const x2 = qx * qx + qy * qy + qz * qz
        const y2 = yy * yy * l2
        const z2 = zz * zz * l2
        const kk = Math.sign(rr) * rr * rr * x2
        if (Math.sign(zz) * a2 * z2 > kk) return Math.sqrt(x2 + z2) * il2 - rb
        if (Math.sign(yy) * a2 * y2 < kk) return Math.sqrt(x2 + y2) * il2 - ra
        return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - ra
      },
      c,
      Math.sqrt(l2) / 2 + Math.max(ra, rb),
      k,
    )
  }

  /** a chain of limbs through points, radii interpolated */
  chain(pts: V[], radii: number[], k = 0.05) {
    for (let i = 0; i < pts.length - 1; i++) this.limb(pts[i], pts[i + 1], radii[i], radii[i + 1], k)
    return this
  }

  /** torus of major radius R, tube r, around an axis through c (rotated by Euler angles; default axis Y) */
  torus(c: V, R: number, r: number, rot: V = [0, 0, 0], k = 0.03) {
    const inv = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot)).invert().elements
    return this.push(
      (x, y, z) => {
        const px = x - c[0]
        const py = y - c[1]
        const pz = z - c[2]
        const lx = inv[0] * px + inv[4] * py + inv[8] * pz
        const ly = inv[1] * px + inv[5] * py + inv[9] * pz
        const lz = inv[2] * px + inv[6] * py + inv[10] * pz
        const q = Math.sqrt(lx * lx + lz * lz) - R
        return Math.sqrt(q * q + ly * ly) - r
      },
      c,
      R + r,
      k,
    )
  }

  /** rounded box of half-size h, rotated about Y */
  box(c: V, h: V, round = 0.03, rotY = 0, k = 0.03) {
    const cs = Math.cos(-rotY)
    const sn = Math.sin(-rotY)
    return this.push(
      (x, y, z) => {
        const px = x - c[0]
        const pz = z - c[2]
        const lx = Math.abs(cs * px + sn * pz) - h[0] + round
        const ly = Math.abs(y - c[1]) - h[1] + round
        const lz = Math.abs(-sn * px + cs * pz) - h[2] + round
        return len3(Math.max(lx, 0), Math.max(ly, 0), Math.max(lz, 0)) + Math.min(Math.max(lx, ly, lz), 0) - round
      },
      c,
      len3(h[0], h[1], h[2]),
      k,
    )
  }

  /** turn the primitive just added into a cut (smooth subtraction), with blend radius k */
  cut(k = 0.02) {
    this.prims[this.prims.length - 1].k = -Math.abs(k)
    return this
  }

  /** distance to the whole form */
  dist(x: number, y: number, z: number) {
    return distOver(this.prims, x, y, z)
  }

  bounds() {
    const b = new THREE.Box3()
    for (const p of this.prims) {
      if (p.k < 0) continue
      b.expandByPoint(new THREE.Vector3(p.c[0] - p.r, p.c[1] - p.r, p.c[2] - p.r))
      b.expandByPoint(new THREE.Vector3(p.c[0] + p.r, p.c[1] + p.r, p.c[2] + p.r))
    }
    return b.expandByScalar(0.08)
  }

  /**
   * Polygonise to a mesh at `cell` size (m). `details` are boxes meshed finer (faces, heads):
   * the coarse mesh is cut away inside them and the fine one fills them; their cut faces meet
   * inside the form, and the two overlap slightly so no crack opens. A region may also end on a
   * plane (e.g. square across a neck, under a band that hides it).
   */
  mesh(cell = 0.04, details: { min: V; max: V; cell: number; plane?: { p: V; n: V } }[] = []) {
    cell *= grain
    details = details.map((d) => ({ ...d, cell: d.cell * grain }))
    const boxPrim = (d: { min: V; max: V; plane?: { p: V; n: V } }, by: number): Prim => {
      const min = d.min.map((v) => v - by) as V
      const max = d.max.map((v) => v + by) as V
      const pl = d.plane
      const l = pl ? len3(pl.n[0], pl.n[1], pl.n[2]) : 1
      return {
        d: (x, y, z) => {
          const qx = Math.max(min[0] - x, x - max[0])
          const qy = Math.max(min[1] - y, y - max[1])
          const qz = Math.max(min[2] - z, z - max[2])
          let r = len3(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0)
          if (pl) r = Math.max(r, -((x - pl.p[0]) * pl.n[0] + (y - pl.p[1]) * pl.n[1] + (z - pl.p[2]) * pl.n[2]) / l - by)
          return r
        },
        c: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
        r: len3(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2,
        k: 0,
      }
    }
    const parts: THREE.BufferGeometry[] = []
    // coarse: the form, with every detail region (shrunk a cell) cut away sharply
    const cuts = details.map((d) => ({ ...boxPrim(d, -cell), k: -1e-6 }))
    parts.push(polygonise([...this.prims, ...cuts], this.bounds(), cell))
    // fine: the form inside each region (grown half a cell), by intersection
    for (const det of details) {
      const region = boxPrim(det, cell * 0.5)
      const bb = new THREE.Box3(new THREE.Vector3(...det.min), new THREE.Vector3(...det.max)).expandByScalar(Math.max(det.cell * 3, cell))
      parts.push(polygonise(this.prims, bb, det.cell, region))
    }
    if (parts.length === 1) return parts[0]
    const out = mergeGeometries(parts, false)!
    parts.forEach((g) => g.dispose())
    return out
  }
}

/** Smooth union / subtraction over a list of primitives (in order). */
function distOver(prims: Prim[], x: number, y: number, z: number) {
  let d = 1e9
  for (const p of prims) {
    const dc = len3(x - p.c[0], y - p.c[1], z - p.c[2]) - p.r
    if (p.k >= 0) {
      // too far to change the blend: skip
      if (dc > d + p.k) continue
      const e = p.d(x, y, z)
      const k = p.k
      if (k <= 0) d = Math.min(d, e)
      else {
        const hh = Math.max(k - Math.abs(d - e), 0) / k
        d = Math.min(d, e) - hh * hh * k * 0.25
      }
    } else {
      if (dc > -d + -p.k) continue
      const e = p.d(x, y, z)
      const k = -p.k
      const hh = Math.max(k - Math.abs(-e - d), 0) / k
      d = Math.max(d, -e) + hh * hh * k * 0.25
    }
  }
  return d
}

/**
 * Marching cubes over a cubic grid around `b`, at roughly `cell` spacing (capped at 128³).
 * The grid is walked in blocks of 8³ samples; each block evaluates only the primitives that can
 * reach it, so a form of a few hundred parts is fast. Values far from the surface may differ
 * from the full field, but their sign does not, and only values near the surface shape the mesh.
 */
function polygonise(prims: Prim[], b: THREE.Box3, cell: number, clip?: Prim) {
  const size = b.getSize(new THREE.Vector3())
  const span = Math.max(size.x, size.y, size.z)
  const res = Math.min(128, Math.max(16, Math.ceil(span / cell)))
  const centre = b.getCenter(new THREE.Vector3())
  const half = span / 2
  const mc = new MarchingCubes(res, new THREE.MeshBasicMaterial(), false, false, 400000)
  mc.isolation = 0
  const f = mc.field
  const hs = res / 2
  const step = span / res
  const B = 8
  const margin = step * 3 + 0.02
  for (let bz = 0; bz < res; bz += B)
    for (let by = 0; by < res; by += B)
      for (let bx = 0; bx < res; bx += B) {
        const cx = centre.x + ((bx + B / 2 - hs) / hs) * half
        const cy = centre.y + ((by + B / 2 - hs) / hs) * half
        const cz = centre.z + ((bz + B / 2 - hs) / hs) * half
        const br = (B / 2) * step * Math.sqrt(3)
        // the primitives that can matter here: within reach of the block, blend radius included
        const near = prims.filter((p) => len3(cx - p.c[0], cy - p.c[1], cz - p.c[2]) - p.r - Math.abs(p.k) <= br + margin)
        const clipFar = clip ? clip.d(cx, cy, cz) > br + margin : false
        for (let z = bz; z < Math.min(res, bz + B); z++) {
          const wz = centre.z + ((z - hs) / hs) * half
          for (let y = by; y < Math.min(res, by + B); y++) {
            const wy = centre.y + ((y - hs) / hs) * half
            for (let x = bx; x < Math.min(res, bx + B); x++) {
              const wx = centre.x + ((x - hs) / hs) * half
              let d: number
              if (clipFar || near.length === 0) d = 1e3
              else {
                d = distOver(near, wx, wy, wz)
                if (clip) d = Math.max(d, clip.d(wx, wy, wz))
              }
              f[x + y * res + z * res * res] = -d
            }
          }
        }
      }
  mc.update()
  const n = mc.count
  const pos = new Float32Array(n * 3)
  const nor = new Float32Array(n * 3)
  const v = new THREE.Vector3()
  for (let i = 0; i < n * 3; i += 3) {
    pos[i] = centre.x + mc.positionArray[i] * half
    pos[i + 1] = centre.y + mc.positionArray[i + 1] * half
    pos[i + 2] = centre.z + mc.positionArray[i + 2] * half
    // normals from the field gradient can be unnormalised
    v.set(mc.normalArray[i], mc.normalArray[i + 1], mc.normalArray[i + 2]).normalize()
    nor[i] = v.x
    nor[i + 1] = v.y
    nor[i + 2] = v.z
  }
  mc.geometry.dispose()
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  return g
}
