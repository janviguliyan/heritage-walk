import * as THREE from 'three'

// Lightmap layout for a Builder scene, deterministic so the bake (offline) and the walk
// (runtime) agree without shipping UVs. Flat geometry is cut into charts — each box face or
// coplanar triangle pair becomes one rectangle, each other triangle its own — and charts are
// shelf-packed into square pages at a fixed texel density. Dense, curved geometry (sculpture,
// wheels) is lit per vertex instead.

export const PAGE = 4096
export const PAD = 2

export interface Chart {
  /** world-space origin and the two edge vectors the chart spans */
  o: THREE.Vector3
  u: THREE.Vector3
  v: THREE.Vector3
  n: THREE.Vector3
  /** size in texels (without padding) and placement (with padding) */
  w: number
  h: number
  page: number
  x: number
  y: number
}

export interface LayoutPart {
  mat: string
  geo: THREE.BufferGeometry
  /** 'chart' parts get uv1; 'vertex' parts are lit per vertex */
  kind: 'chart' | 'vertex'
  charts: Chart[]
  /** for each triangle, its chart index (chart parts) */
  triChart?: Int32Array
}

const GROUND = new Set(['grass', 'lawn', 'path', 'sand'])
/** texels per metre */
export const density = (mat: string) => (GROUND.has(mat) ? 5 : 14)

const a = new THREE.Vector3()
const b = new THREE.Vector3()
const c = new THREE.Vector3()
const d = new THREE.Vector3()
const same = (p: THREE.Vector3, q: THREE.Vector3) => p.distanceToSquared(q) < 1e-8

function triArea(g: THREE.BufferGeometry) {
  const p = g.attributes.position as THREE.BufferAttribute
  let s = 0
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i)
    b.fromBufferAttribute(p, i + 1)
    c.fromBufferAttribute(p, i + 2)
    s += b.sub(a).cross(c.sub(a)).length() / 2
  }
  return s
}

/** Classify one added geometry and cut it into charts (sizes only; packing comes later). */
export function chartPart(mat: string, geo: THREE.BufferGeometry): LayoutPart {
  const p = geo.attributes.position as THREE.BufferAttribute
  const tris = p.count / 3
  const area = triArea(geo)
  // many small triangles: lit per vertex (smooth, and no atlas space wasted)
  if (tris > 160 && area / tris < 0.05) return { mat, geo, kind: 'vertex', charts: [] }
  const dens = density(mat)
  const charts: Chart[] = []
  const triChart = new Int32Array(tris)
  for (let t = 0; t < tris; t++) {
    a.fromBufferAttribute(p, t * 3)
    b.fromBufferAttribute(p, t * 3 + 1)
    c.fromBufferAttribute(p, t * 3 + 2)
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a))
    if (n.lengthSq() < 1e-12) {
      triChart[t] = -1
      continue
    }
    n.normalize()
    // a box face: (a, b, d) then (b, c, d) — the next triangle shares b and d
    let quad = false
    if (t + 1 < tris) {
      const b2 = new THREE.Vector3().fromBufferAttribute(p, t * 3 + 3)
      const c2 = new THREE.Vector3().fromBufferAttribute(p, t * 3 + 4)
      const d2 = new THREE.Vector3().fromBufferAttribute(p, t * 3 + 5)
      d.copy(c)
      if (same(b2, b) && same(d2, d)) {
        const n2 = new THREE.Vector3().subVectors(c2, b2).cross(new THREE.Vector3().subVectors(d2, b2)).normalize()
        if (n2.dot(n) > 0.999) {
          const u = new THREE.Vector3().subVectors(b, a)
          const v = new THREE.Vector3().subVectors(d, a)
          // only true rectangles/parallelograms: c2 == a + u + v
          if (same(c2, a.clone().add(u).add(v))) {
            charts.push(sized(a.clone(), u, v, n, dens))
            triChart[t] = triChart[t + 1] = charts.length - 1
            t++
            quad = true
          }
        }
      }
    }
    if (!quad) {
      charts.push(sized(a.clone(), new THREE.Vector3().subVectors(b, a), new THREE.Vector3().subVectors(c, a), n, dens))
      triChart[t] = charts.length - 1
    }
  }
  return { mat, geo, kind: 'chart', charts, triChart }
}

function sized(o: THREE.Vector3, u: THREE.Vector3, v: THREE.Vector3, n: THREE.Vector3, dens: number): Chart {
  const max = PAGE - PAD * 2 - 2
  let w = Math.max(1, Math.ceil(u.length() * dens))
  let h = Math.max(1, Math.ceil(v.length() * dens))
  // a chart larger than a page is drawn at lower density
  const k = Math.min(1, max / Math.max(w, h))
  w = Math.max(1, Math.floor(w * k))
  h = Math.max(1, Math.floor(h * k))
  return { o, u, v, n, w, h, page: 0, x: 0, y: 0 }
}

/** Shelf-pack every chart (tallest first, stable) into pages. Returns the page count. */
export function pack(parts: LayoutPart[]) {
  const all: Chart[] = []
  for (const part of parts) for (const ch of part.charts) all.push(ch)
  const order = all.map((_, i) => i).sort((i, j) => all[j].h - all[i].h || i - j)
  let page = 0
  let x = 0
  let y = 0
  let shelf = 0
  for (const i of order) {
    const ch = all[i]
    const W = ch.w + PAD * 2
    const H = ch.h + PAD * 2
    if (x + W > PAGE) {
      x = 0
      y += shelf
      shelf = 0
    }
    if (y + H > PAGE) {
      page++
      x = 0
      y = 0
      shelf = 0
    }
    ch.page = page
    ch.x = x
    ch.y = y
    x += W
    shelf = Math.max(shelf, H)
  }
  return all.length ? page + 1 : 0
}

/** Solve p = o + s·u + t·v in the chart's plane. */
function chartST(ch: Chart, p: THREE.Vector3, out: THREE.Vector2) {
  const uu = ch.u.dot(ch.u)
  const uv = ch.u.dot(ch.v)
  const vv = ch.v.dot(ch.v)
  const r = a.subVectors(p, ch.o)
  const ru = r.dot(ch.u)
  const rv = r.dot(ch.v)
  const det = uu * vv - uv * uv || 1e-9
  return out.set((ru * vv - rv * uv) / det, (rv * uu - ru * uv) / det)
}

/** Write uv1 for a chart part: each vertex placed inside its chart's rectangle on its page. */
export function writeUV1(part: LayoutPart) {
  const p = part.geo.attributes.position as THREE.BufferAttribute
  const uv1 = new Float32Array(p.count * 2)
  const st = new THREE.Vector2()
  for (let t = 0; t < p.count / 3; t++) {
    const ci = part.triChart![t]
    if (ci < 0) continue
    const ch = part.charts[ci]
    for (let k = 0; k < 3; k++) {
      b.fromBufferAttribute(p, t * 3 + k)
      chartST(ch, b, st)
      uv1[(t * 3 + k) * 2] = (ch.x + PAD + st.x * ch.w) / PAGE
      uv1[(t * 3 + k) * 2 + 1] = (ch.y + PAD + st.y * ch.h) / PAGE
    }
  }
  part.geo.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2))
}

/** Bake samples for one square tile of a page: a world position and normal per texel. */
export function tileSamples(parts: LayoutPart[], page: number, tx: number, ty: number, size: number, pos: Float32Array, nor: Float32Array) {
  pos.fill(0)
  nor.fill(0)
  const q = new THREE.Vector3()
  let any = false
  for (const part of parts)
    for (const ch of part.charts) {
      if (ch.page !== page) continue
      const x0 = Math.max(ch.x, tx)
      const x1 = Math.min(ch.x + ch.w + PAD * 2, tx + size)
      const y0 = Math.max(ch.y, ty)
      const y1 = Math.min(ch.y + ch.h + PAD * 2, ty + size)
      if (x0 >= x1 || y0 >= y1) continue
      any = true
      for (let y = y0; y < y1; y++) {
        const t = THREE.MathUtils.clamp((y - ch.y + 0.5 - PAD) / ch.h, 0, 1)
        for (let x = x0; x < x1; x++) {
          const s = THREE.MathUtils.clamp((x - ch.x + 0.5 - PAD) / ch.w, 0, 1)
          q.copy(ch.o).addScaledVector(ch.u, s).addScaledVector(ch.v, t)
          const idx = ((y - ty) * size + (x - tx)) * 4
          pos[idx] = q.x
          pos[idx + 1] = q.y
          pos[idx + 2] = q.z
          pos[idx + 3] = 1
          nor[idx] = ch.n.x
          nor[idx + 1] = ch.n.y
          nor[idx + 2] = ch.n.z
        }
      }
    }
  return any
}
