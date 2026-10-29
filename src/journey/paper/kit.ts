import * as THREE from 'three'

// Paper-cut kit: shapes cut from coloured card, with real thickness (so edges catch the
// light and every layer casts a soft shadow on the ones behind it), on a fibrous paper
// texture. Units: one scene is about 16 × 9 wide, layers a few tenths apart in depth.

type XY = [number, number]

let fibre: THREE.CanvasTexture | null = null
/** A sheet of handmade paper: soft mottling and fibres, used as both colour and bump. */
export function paperTexture() {
  if (fibre) return fibre
  const n = 1024
  const c = document.createElement('canvas')
  c.width = c.height = n
  const g = c.getContext('2d')!
  g.fillStyle = '#f4f1ea'
  g.fillRect(0, 0, n, n)
  let seed = 7
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  // mottling
  for (let i = 0; i < 900; i++) {
    const x = r() * n
    const y = r() * n
    const rad = 8 + r() * 46
    const grd = g.createRadialGradient(x, y, 0, x, y, rad)
    const a = 0.025 + r() * 0.035
    const tone = r() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(120,100,70,${a})`
    grd.addColorStop(0, tone)
    grd.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grd
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2)
  }
  // fibres
  g.lineCap = 'round'
  for (let i = 0; i < 2600; i++) {
    let x = r() * n
    let y = r() * n
    let a = r() * Math.PI * 2
    g.strokeStyle = r() > 0.35 ? `rgba(110,90,60,${0.05 + r() * 0.08})` : `rgba(255,255,255,${0.15 + r() * 0.2})`
    g.lineWidth = 0.4 + r() * 0.9
    g.beginPath()
    g.moveTo(x, y)
    const len = 6 + r() * 26
    for (let k = 0; k < len; k += 3) {
      a += (r() - 0.5) * 0.6
      x += Math.cos(a) * 3
      y += Math.sin(a) * 3
      g.lineTo(x, y)
    }
    g.stroke()
  }
  // grain
  const img = g.getImageData(0, 0, n, n)
  for (let i = 0; i < img.data.length; i += 4) {
    const d = (r() - 0.5) * 14
    img.data[i] += d
    img.data[i + 1] += d
    img.data[i + 2] += d
  }
  g.putImageData(img, 0, 0)
  fibre = new THREE.CanvasTexture(c)
  fibre.wrapS = fibre.wrapT = THREE.RepeatWrapping
  fibre.colorSpace = THREE.SRGBColorSpace
  fibre.anisotropy = 8
  return fibre
}

const mats = new Map<string, THREE.Material[]>()
/** Face and edge materials for a card colour; the cut edge shows the paler core of the card. */
export function card(color: string, glow = 0) {
  const key = `${color}|${glow}`
  let m = mats.get(key)
  if (m) return m
  const tex = paperTexture()
  const face = new THREE.MeshStandardMaterial({ color, map: tex, bumpMap: tex, bumpScale: 2.2, roughness: 0.92, metalness: 0, vertexColors: true })
  if (glow) {
    face.emissive = new THREE.Color(color)
    face.emissiveIntensity = glow
    face.emissiveMap = tex
  }
  const edge = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).lerp(new THREE.Color('#fff8ea'), 0.45), roughness: 0.95, vertexColors: true })
  m = [face, edge]
  mats.set(key, m)
  return m
}

/** Cut a piece of card from one or more shapes, its back at z. */
export function cut(shapes: THREE.Shape | THREE.Shape[], color: string, z = 0, opts: { depth?: number; glow?: number; shadow?: boolean } = {}) {
  const depth = opts.depth ?? 0.03
  const geo = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1, curveSegments: 28 })
  // the shape's own coordinates are its UVs: scale them to a sensible paper grain
  const uv = geo.attributes.uv
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.09, uv.getY(i) * 0.09)
  // card darkens a little toward its foot, as if lit from above in a box
  geo.computeBoundingBox()
  const bb = geo.boundingBox!
  const h = Math.max(1e-3, bb.max.y - bb.min.y)
  const pos = geo.attributes.position
  const col = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const k = 0.8 + 0.24 * Math.pow((pos.getY(i) - bb.min.y) / h, 0.8)
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  const mesh = new THREE.Mesh(geo, card(color, opts.glow ?? 0))
  mesh.position.z = z
  mesh.castShadow = opts.shadow ?? true
  mesh.receiveShadow = true
  return mesh
}

// ---- shapes (y up) ----

export function circle(cx: number, cy: number, r: number) {
  const s = new THREE.Shape()
  s.absarc(cx, cy, r, 0, Math.PI * 2, false)
  return s
}

export function ellipse(cx: number, cy: number, rx: number, ry: number, rot = 0) {
  const s = new THREE.Shape()
  s.absellipse(cx, cy, rx, ry, 0, Math.PI * 2, false, rot)
  return s
}

export function poly(pts: XY[]) {
  const s = new THREE.Shape()
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)))
  s.closePath()
  return s
}

export function rect(x: number, y: number, w: number, h: number) {
  return poly([
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ])
}

/** A smooth closed outline through the points (Catmull-Rom). */
export function smooth(pts: XY[], tension = 0.5) {
  const curve = new THREE.CatmullRomCurve3(
    pts.map(([x, y]) => new THREE.Vector3(x, y, 0)),
    true,
    'catmullrom',
    tension,
  )
  return poly(curve.getPoints(pts.length * 10).map((p) => [p.x, p.y] as XY))
}

/** A limb or stalk: a segment with round ends. */
export function capsule(x1: number, y1: number, x2: number, y2: number, r1: number, r2 = r1) {
  const a = Math.atan2(y2 - y1, x2 - x1)
  const s = new THREE.Shape()
  s.absarc(x1, y1, r1, a + Math.PI / 2, a + (Math.PI * 3) / 2, false)
  s.absarc(x2, y2, r2, a - Math.PI / 2, a + Math.PI / 2, false)
  s.closePath()
  return s
}

export function star(cx: number, cy: number, rOut: number, rIn: number, n: number, rot = 0) {
  const pts: XY[] = []
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? rIn : rOut
    const a = rot + (i / (n * 2)) * Math.PI * 2
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
  }
  return poly(pts)
}

/** A ring, optionally with holes cut between spokes (a wheel). */
export function ring(cx: number, cy: number, rOut: number, rIn: number) {
  const s = circle(cx, cy, rOut)
  const h = new THREE.Path()
  h.absarc(cx, cy, rIn, 0, Math.PI * 2, true)
  s.holes.push(h)
  return s
}

/** A band whose top edge is a scalloped wave, from x0 to x1, down to yBottom. */
export function waves(x0: number, x1: number, y: number, yBottom: number, amp: number, wavelength: number, phase = 0) {
  const pts: XY[] = [[x0, yBottom]]
  const steps = Math.ceil(((x1 - x0) / wavelength) * 16)
  for (let i = 0; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps
    const k = ((x - x0) / wavelength + phase) * Math.PI * 2
    // a curling crest: sharp top, rounded trough
    pts.push([x, y + amp * (1 - Math.abs(Math.sin(k / 2))) * 1.6 - amp * 0.6])
  }
  pts.push([x1, yBottom])
  return poly(pts)
}

/** Cut holes (paths or shapes) out of a shape: lace and cut-work. */
export function holes(shape: THREE.Shape, cutouts: THREE.Shape[]) {
  for (const c of cutouts) {
    const p = new THREE.Path(c.getPoints(24).reverse())
    shape.holes.push(p)
  }
  return shape
}

/** A cloud: overlapping puffs along a line (each puff its own shape; same card, same depth). */
export function cloud(cx: number, cy: number, w: number, h: number, seed = 1): THREE.Shape[] {
  let s = seed * 9301
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const out: THREE.Shape[] = [capsule(cx - w / 2 + h * 0.35, cy, cx + w / 2 - h * 0.35, cy, h * 0.35)]
  const n = Math.max(3, Math.round(w / h) + 1)
  for (let i = 0; i < n; i++) {
    const x = cx - w / 2 + h * 0.5 + ((w - h) * i) / (n - 1)
    const mid = 1 - Math.abs(i / (n - 1) - 0.5) * 2
    out.push(circle(x, cy + h * (0.1 + 0.35 * mid), h * (0.32 + 0.3 * mid + r() * 0.1)))
  }
  return out
}

/** A coconut palm: a leaning trunk and drooping fronds. */
export function palm(x: number, y: number, h: number, lean = 0.15): THREE.Shape[] {
  const out: THREE.Shape[] = []
  const tx = x + lean * h
  const ty = y + h
  const trunk = new THREE.Shape()
  trunk.moveTo(x - 0.09, y)
  trunk.quadraticCurveTo(x + lean * h * 0.3 - 0.05, y + h * 0.6, tx - 0.05, ty)
  trunk.lineTo(tx + 0.05, ty)
  trunk.quadraticCurveTo(x + lean * h * 0.3 + 0.07, y + h * 0.6, x + 0.11, y)
  trunk.closePath()
  out.push(trunk)
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.08 + (i / 6) * 0.84)
    const len = h * (0.42 + (i % 2) * 0.08)
    const ex = tx + Math.cos(a) * len
    const ey = ty + Math.sin(a) * len * 0.35 - len * 0.32
    const mx = tx + Math.cos(a) * len * 0.5
    const my = ty + Math.sin(a) * len * 0.45 + 0.08
    const f = new THREE.Shape()
    f.moveTo(tx, ty + 0.03)
    f.quadraticCurveTo(mx, my + 0.1, ex, ey)
    f.quadraticCurveTo(mx, my - 0.06, tx, ty - 0.03)
    f.closePath()
    out.push(f)
  }
  out.push(circle(tx, ty, 0.1))
  return out
}

/** A small bird in flight, a shallow "v". */
export function bird(cx: number, cy: number, s: number) {
  const b = new THREE.Shape()
  b.moveTo(cx - s, cy + s * 0.25)
  b.quadraticCurveTo(cx - s * 0.45, cy + s * 0.35, cx, cy - s * 0.05)
  b.quadraticCurveTo(cx + s * 0.45, cy + s * 0.35, cx + s, cy + s * 0.25)
  b.quadraticCurveTo(cx + s * 0.45, cy + s * 0.12, cx, cy - s * 0.22)
  b.quadraticCurveTo(cx - s * 0.45, cy + s * 0.12, cx - s, cy + s * 0.25)
  return b
}

/** Mirror shapes left-right about x = 0 (for symmetric cut-outs built from one half). */
export function mirror(points: XY[]): XY[] {
  return [...points, ...points.map(([x, y]) => [-x, y] as XY).reverse()]
}

export const easeOutBack = (t: number) => {
  const c = 1.4
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2)
}
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
export const easeIn = (t: number) => t * t * t
export const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
