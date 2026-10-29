import * as THREE from 'three'

// Procedural textures: generated at load time, so there are no image assets to license.
// Each texture is a tileable height field turned into a colour map and a normal map.

type RGB = [number, number, number]

export function hash(x: number, y: number, seed: number) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 982451653)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

const mod = (a: number, p: number) => ((a % p) + p) % p
const smooth = (t: number) => t * t * (3 - 2 * t)

// Value noise that wraps every `period` lattice cells, so textures tile seamlessly.
export function noise(x: number, y: number, period: number, seed: number) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const fx = smooth(x - xi)
  const fy = smooth(y - yi)
  const x0 = mod(xi, period)
  const y0 = mod(yi, period)
  const x1 = mod(xi + 1, period)
  const y1 = mod(yi + 1, period)
  const a = hash(x0, y0, seed)
  const b = hash(x1, y0, seed)
  const c = hash(x0, y1, seed)
  const d = hash(x1, y1, seed)
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
}

export function fbm(u: number, v: number, base: number, octaves: number, seed: number) {
  let sum = 0
  let amp = 0.5
  let norm = 0
  for (let o = 0; o < octaves; o++) {
    const f = base * 2 ** o
    sum += amp * noise(u * f, v * f, f, seed + o * 17)
    norm += amp
    amp *= 0.5
  }
  return sum / norm
}

export function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Field {
  w: number
  h: number
  height: Float32Array
  color: Float32Array // rgb 0..255
}

export function makeField(w: number, h: number, fn: (u: number, v: number, x: number, y: number) => { h: number; c: RGB }): Field {
  const height = new Float32Array(w * h)
  const color = new Float32Array(w * h * 3)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const r = fn(x / w, y / h, x, y)
      const i = y * w + x
      height[i] = r.h
      color[i * 3] = r.c[0]
      color[i * 3 + 1] = r.c[1]
      color[i * 3 + 2] = r.c[2]
    }
  }
  return { w, h, height, color }
}

function toCanvas(w: number, h: number, write: (data: Uint8ClampedArray) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(w, h)
  write(img.data)
  ctx.putImageData(img, 0, 0)
  return canvas
}

export function fieldTextures(f: Field, strength: number, repeat = true) {
  const { w, h, height, color } = f
  const map = toCanvas(w, h, (d) => {
    for (let i = 0; i < w * h; i++) {
      d[i * 4] = color[i * 3]
      d[i * 4 + 1] = color[i * 3 + 1]
      d[i * 4 + 2] = color[i * 3 + 2]
      d[i * 4 + 3] = 255
    }
  })
  const normal = toCanvas(w, h, (d) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const l = height[y * w + mod(x - 1, w)]
        const r = height[y * w + mod(x + 1, w)]
        const t = height[mod(y - 1, h) * w + x]
        const b = height[mod(y + 1, h) * w + x]
        // canvas y runs down, texture v runs up: flip the y gradient
        const nx = (l - r) * strength
        const ny = (b - t) * strength
        const len = Math.hypot(nx, ny, 1)
        const i = (y * w + x) * 4
        d[i] = ((nx / len) * 0.5 + 0.5) * 255
        d[i + 1] = ((ny / len) * 0.5 + 0.5) * 255
        d[i + 2] = ((1 / len) * 0.5 + 0.5) * 255
        d[i + 3] = 255
      }
    }
  })
  const mapTex = new THREE.CanvasTexture(map)
  mapTex.colorSpace = THREE.SRGBColorSpace
  const normalTex = new THREE.CanvasTexture(normal)
  for (const t of [mapTex, normalTex]) {
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = 8
    t.generateMipmaps = true
  }
  return { map: mapTex, normalMap: normalTex }
}

const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const scale = (a: RGB, s: number): RGB => [a[0] * s, a[1] * s, a[2] * s]

// Ashlar masonry: staggered courses of blocks with worn joints.
function masonry(u: number, v: number, rows: number, seed: number) {
  const row = Math.floor(v * rows)
  const fv = v * rows - row
  const cols = rows / 2 + Math.floor(hash(row, 0, seed) * 2)
  const shift = hash(row, 1, seed)
  const cu = u * cols + shift
  const col = Math.floor(cu)
  const fu = cu - col
  const block = hash(mod(col, cols), row, seed + 3)
  const edge = Math.min(fu, 1 - fu, (fv * cols) / rows, ((1 - fv) * cols) / rows)
  const joint = Math.min(1, edge / 0.04)
  return { joint, block }
}

export function stoneTextures(kind: 'khondalite' | 'laterite' | 'chlorite' | 'sand' | 'grass' | 'path' | 'lawn' | 'carved', size = 512) {
  const seedBase = { khondalite: 11, laterite: 23, chlorite: 37, sand: 41, grass: 53, path: 67, lawn: 71, carved: 13 }[kind]
  const f = makeField(size, size, (u, v) => {
    const n = fbm(u, v, 4, 5, seedBase)
    const fine = fbm(u, v, 32, 3, seedBase + 5)
    switch (kind) {
      case 'khondalite': {
        const m = masonry(u, v, 4, seedBase)
        const h = 0.35 + 0.35 * n + 0.15 * fine + m.block * 0.1 - (1 - m.joint) * 0.45
        const base = mix([146, 128, 106], [180, 160, 132], m.block)
        const streak = Math.max(0, fbm(u * 0.5, v * 4, 12, 2, seedBase + 7) - 0.58) * 2.2
        const c = scale(mix(mix(base, [118, 114, 106], Math.max(0, n - 0.55) * 1.6), [70, 62, 54], streak), 0.84 + 0.3 * fine)
        return { h, c: mix([84, 70, 56], c, 0.45 + 0.55 * m.joint) }
      }
      case 'carved': {
        // dressed khondalite for sculpture: no joints, fine tooling and pitting, weathering streaks
        const pit = fbm(u, v, 96, 2, seedBase + 3)
        const streak = Math.max(0, fbm(u * 0.4, v * 3, 10, 2, seedBase + 7) - 0.55) * 2
        const h = 0.5 + 0.25 * n + 0.2 * fine - Math.max(0, pit - 0.68) * 1.2
        const c = scale(mix(mix([150, 132, 110], [182, 162, 134], n), [92, 84, 74], streak), 0.84 + 0.28 * fine)
        return { h, c }
      }
      case 'laterite': {
        const m = masonry(u, v, 3, seedBase)
        const pits = fbm(u, v, 48, 2, seedBase + 9)
        const hole = pits > 0.62 ? (pits - 0.62) * 3 : 0
        const h = 0.4 + 0.3 * n - hole - (1 - m.joint) * 0.5
        const base = mix([116, 70, 50], [148, 94, 66], m.block * 0.7 + fine * 0.3)
        return { h, c: scale(mix([70, 36, 24], base, 0.3 + 0.7 * m.joint), 1 - hole * 0.9) }
      }
      case 'chlorite': {
        const vein = Math.abs(Math.sin((u * 3 + n * 2.5) * Math.PI * 2))
        const h = 0.5 + 0.1 * n
        return { h, c: mix([30, 36, 32], [62, 72, 64], n * 0.8 + (vein > 0.97 ? 0.4 : 0)) }
      }
      case 'sand': {
        const ripple = Math.sin((v * 22 + n * 3) * Math.PI * 2) * 0.5 + 0.5
        const h = 0.5 + 0.2 * ripple + 0.2 * fine
        return { h, c: scale(mix([200, 174, 132], [226, 204, 162], n), 0.9 + 0.15 * fine) }
      }
      case 'grass': {
        const blades = fbm(u, v, 64, 2, seedBase + 2)
        const dry = Math.max(0, n - 0.5) * 2
        return { h: blades, c: scale(mix([82, 104, 52], [150, 140, 84], dry), 0.75 + 0.45 * blades) }
      }
      case 'lawn': {
        // mown lawn: fine blades, faint mowing stripes, the odd darker clump
        const blades = fbm(u, v, 96, 2, seedBase + 2)
        const stripe = Math.sin(u * Math.PI * 8) * 0.5 + 0.5
        const clump = Math.max(0, n - 0.6) * 1.8
        const c = mix([84, 124, 46], [114, 150, 58], stripe * 0.5 + blades * 0.5)
        return { h: blades, c: scale(mix(c, [70, 108, 38], clump), 0.88 + 0.22 * fine) }
      }
      case 'path': {
        // laterite flags worn pale by feet: salmon-beige, joints soft
        const m = masonry(u, v, 3, seedBase)
        const h = 0.45 + 0.2 * n + 0.15 * fine - (1 - m.joint) * 0.3
        const base = mix([196, 156, 124], [218, 184, 150], m.block * 0.6 + n * 0.4)
        return { h, c: scale(mix([150, 118, 92], base, 0.55 + 0.45 * m.joint), 0.9 + 0.18 * fine) }
      }
    }
  })
  const strength = { khondalite: 6, laterite: 7, chlorite: 1.5, sand: 3, grass: 3, path: 5, lawn: 2.5, carved: 4 }[kind]
  return fieldTextures(f, strength * (size / 512))
}

// Frieze strip (4:1): borders of beads, panels of dancers and musicians, lotus medallions
// and scrolling vines, and an elephant procession — carving suggested by relief, not detail.
export function friezeTextures(w = 1024, h = 256) {
  // Ornament only (figures are sculpted in 3D): rows of beads, a scrolling creeper, lotus
  // petals, a lattice band and rosettes, each element drawn slightly differently.
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const g = canvas.getContext('2d')!
  g.fillStyle = '#454545'
  g.fillRect(0, 0, w, h)
  const rand = seeded(7)
  const j = (a: number) => (rand() - 0.5) * a
  const band = (y: number, hh: number, shade: string) => {
    g.fillStyle = shade
    g.fillRect(0, y, w, hh)
  }
  const unit = h / 256
  const Y = (v: number) => v * unit
  // bead and reel row
  const beads = (y: number, r: number, gap: number) => {
    for (let x = gap / 2; x < w; x += gap) {
      g.fillStyle = `rgb(${200 + j(30)},${200 + j(30)},${200 + j(30)})`
      g.beginPath()
      g.ellipse(x + j(1.5), y, r * (1 + j(0.2)), r * (0.85 + j(0.2)), 0, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#8a8a8a'
      g.fillRect(x + gap / 2 - r * 0.4, y - r * 0.35, r * 0.8, r * 0.7)
    }
  }
  band(0, Y(12), '#b4b4b4')
  band(Y(12), Y(4), '#606060')
  beads(Y(23), Y(5), Y(15))
  band(Y(31), Y(3), '#6a6a6a')
  // scrolling creeper: a wave with curling tendrils and leaves
  const sy = Y(58)
  g.lineCap = 'round'
  g.strokeStyle = '#cfcfcf'
  g.lineWidth = Y(6)
  g.beginPath()
  const period = Y(64)
  for (let x = 0; x <= w; x += 2) {
    const yy = sy + Math.sin((x / period) * Math.PI * 2) * Y(12)
    if (x === 0) g.moveTo(x, yy)
    else g.lineTo(x, yy)
  }
  g.stroke()
  for (let x = 0; x < w; x += period / 2) {
    const up = Math.round(x / (period / 2)) % 2 === 0
    const cx = x + period / 4
    const cy = sy + (up ? -Y(4) : Y(4))
    g.lineWidth = Y(4)
    g.beginPath()
    g.arc(cx + j(2), cy, Y(9 + j(2)), up ? Math.PI * 0.1 : Math.PI * 1.1, up ? Math.PI * 1.6 : Math.PI * 2.6)
    g.stroke()
    g.fillStyle = '#dadada'
    g.beginPath()
    g.ellipse(cx + Y(3), cy + (up ? Y(2) : -Y(2)), Y(4), Y(2.5), j(1), 0, Math.PI * 2)
    g.fill()
  }
  band(Y(80), Y(4), '#6a6a6a')
  // a frieze of lotus petals, each a little different
  for (let x = 0; x < w; x += Y(22)) {
    g.fillStyle = `rgb(${190 + j(30)},${190 + j(30)},${190 + j(30)})`
    g.beginPath()
    const pw = Y(9 + j(2))
    g.moveTo(x, Y(126))
    g.quadraticCurveTo(x + pw * 0.1, Y(92 + j(4)), x + Y(11), Y(88 + j(4)))
    g.quadraticCurveTo(x + Y(22) - pw * 0.1, Y(92 + j(4)), x + Y(22), Y(126))
    g.closePath()
    g.fill()
    g.strokeStyle = '#6c6c6c'
    g.lineWidth = Y(1.6)
    g.beginPath()
    g.moveTo(x + Y(11), Y(94))
    g.lineTo(x + Y(11), Y(122))
    g.stroke()
  }
  band(Y(128), Y(5), '#9c9c9c')
  // lattice (jali): a grid of small square openings, worn unevenly
  for (let y = Y(140); y < Y(186); y += Y(9))
    for (let x = ((y / Y(9)) % 2) * Y(4.5); x < w; x += Y(9)) {
      g.fillStyle = `rgb(${70 + j(30)},${70 + j(30)},${70 + j(30)})`
      g.fillRect(x + Y(1.5), y + Y(1.5), Y(5 + j(1)), Y(5 + j(1)))
    }
  band(Y(188), Y(4), '#8a8a8a')
  // rosettes between little pilasters
  for (let x = Y(14); x < w; x += Y(34)) {
    const cx = x + j(2)
    const cy = Y(212)
    const petals = 8 + Math.floor(rand() * 4)
    g.fillStyle = '#cdcdcd'
    for (let p = 0; p < petals; p++) {
      const a = (p / petals) * Math.PI * 2
      g.beginPath()
      g.ellipse(cx + Math.cos(a) * Y(7), cy + Math.sin(a) * Y(7), Y(5), Y(2.4), a, 0, Math.PI * 2)
      g.fill()
    }
    g.fillStyle = '#9a9a9a'
    g.beginPath()
    g.arc(cx, cy, Y(3.5), 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#b0b0b0'
    g.fillRect(cx + Y(15), Y(196), Y(3), Y(32))
  }
  band(Y(232), Y(4), '#6a6a6a')
  beads(Y(242), Y(4), Y(12))
  band(h - Y(6), Y(6), '#b4b4b4')

  // read the drawing back as a height field, soften it, then shade
  const src = g.getImageData(0, 0, w, h).data
  let height = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) height[i] = src[i * 4] / 255
  for (let pass = 0; pass < 2; pass++) {
    const out = new Float32Array(w * h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let s = 0
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) s += height[Math.min(h - 1, Math.max(0, y + dy)) * w + mod(x + dx, w)]
        out[y * w + x] = s / 9
      }
    }
    height = out
  }
  const color = new Float32Array(w * h * 3)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const n = fbm(x / w, y / h, 8, 4, 91)
      const ht = height[i] + (n - 0.5) * 0.15
      height[i] = ht
      const c = scale(mix([78, 66, 52], [182, 160, 130], Math.min(1, Math.max(0, ht * 1.1))), 0.85 + n * 0.3)
      color[i * 3] = c[0]
      color[i * 3 + 1] = c[1]
      color[i * 3 + 2] = c[2]
    }
  }
  return fieldTextures({ w, h, height, color }, 14)
}

// Glowing chakra (wheel) for hotspot markers and the loader.
export function chakraTexture(size = 256) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const r = size / 2
  g.translate(r, r)
  const glow = g.createRadialGradient(0, 0, r * 0.2, 0, 0, r)
  glow.addColorStop(0, 'rgba(255,200,90,0.55)')
  glow.addColorStop(1, 'rgba(255,170,60,0)')
  g.fillStyle = glow
  g.fillRect(-r, -r, size, size)
  g.strokeStyle = '#ffd27a'
  g.fillStyle = '#ffd27a'
  g.lineWidth = r * 0.07
  g.beginPath()
  g.arc(0, 0, r * 0.62, 0, Math.PI * 2)
  g.stroke()
  g.lineWidth = r * 0.025
  g.beginPath()
  g.arc(0, 0, r * 0.5, 0, Math.PI * 2)
  g.stroke()
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    g.lineWidth = i % 2 ? r * 0.025 : r * 0.06
    g.beginPath()
    g.moveTo(Math.cos(a) * r * 0.12, Math.sin(a) * r * 0.12)
    g.lineTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6)
    g.stroke()
    if (i % 2 === 0) {
      g.beginPath()
      g.arc(Math.cos(a) * r * 0.36, Math.sin(a) * r * 0.36, r * 0.05, 0, Math.PI * 2)
      g.fill()
    }
  }
  g.beginPath()
  g.arc(0, 0, r * 0.13, 0, Math.PI * 2)
  g.fill()
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}
