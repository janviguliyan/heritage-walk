import * as THREE from 'three'
import { fbm, fieldTextures, hash, makeField, seeded } from '../engine/textures'

// Sandstone for the entry hall, generated in code (no image assets): honey-to-rust stone
// with grain, bedding and weathering; medallion panels carved in relief; worn flagstones;
// a vine-carved beam. Colour comes from the brief's palette.

type RGB = [number, number, number]
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const scale = (a: RGB, s: number): RGB => [a[0] * s, a[1] * s, a[2] * s]
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

const HONEY: RGB = [214, 168, 108]
const SAND: RGB = [200, 149, 90]
const OCHRE: RGB = [168, 106, 46]
const RUST: RGB = [122, 62, 28]
const SHADOW: RGB = [52, 30, 14]

/** Stone colour at a point: honey sandstone with soft ochre clouding, fine grain and bedding,
 *  and only a faint, fine speckle of weathering (large dark pits read as blotches, not stone). */
function stoneColor(u: number, v: number, seed: number): { c: RGB; g: number } {
  const big = fbm(u, v, 3, 4, seed)
  const mid = fbm(u, v, 9, 3, seed + 4)
  const grain = fbm(u, v, 64, 2, seed + 8)
  const fine = fbm(u, v, 160, 1, seed + 17)
  const bed = Math.sin((v * 7 + big * 2.2) * Math.PI * 2) * 0.5 + 0.5
  let c = mix(HONEY, SAND, clamp01(big * 1.2 - 0.1))
  c = mix(c, OCHRE, clamp01((mid - 0.5) * 1.3) * 0.45)
  c = mix(c, RUST, clamp01((big - 0.7) * 2.5) * 0.22)
  c = scale(c, 0.9 + grain * 0.14 + fine * 0.08 + bed * 0.04)
  // weathered stone is duller than fresh: pull a quarter of the way to grey
  const l = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11
  c = mix(c, [l, l * 0.97, l * 0.92], 0.28)
  // salt weathering: a fine, sparse speckle
  const pit = fbm(u, v, 120, 1, seed + 13)
  const dark = clamp01((pit - 0.74) * 4)
  c = scale(c, 1 - dark * 0.22)
  return { c, g: grain * 0.55 + mid * 0.25 + fine * 0.2 - dark * 0.25 }
}

function stone(size: number, seed: number) {
  return fieldTextures(
    makeField(size, size, (u, v) => {
      const { c, g } = stoneColor(u, v, seed)
      return { h: 0.5 + g * 0.5, c }
    }),
    3 * (size / 512),
  )
}

/** Large worn flagstones with cracks. */
function flagstones(size: number) {
  const seed = 31
  return fieldTextures(
    makeField(size, size, (u, v) => {
      const rows = 3
      const row = Math.floor(v * rows)
      const fv = v * rows - row
      const cols = 2 + Math.floor(hash(row, 2, seed) * 2)
      const shift = hash(row, 5, seed)
      const cu = u * cols + shift
      const col = Math.floor(cu)
      const fu = cu - col
      const edge = Math.min(fu, 1 - fu, (fv * cols) / rows, ((1 - fv) * cols) / rows)
      const joint = clamp01(edge / 0.012)
      const tone = hash(col % cols, row, seed + 1)
      const { c, g } = stoneColor(u * 1.7 + tone, v * 1.7, seed + Math.floor(tone * 9))
      const crack = Math.abs(fbm(u, v, 6, 3, seed + 21) - 0.5) < 0.004 ? 0.8 : 1
      const wear = fbm(u, v, 5, 3, seed + 3)
      const col2 = scale(mix(c, mix(SAND, [184, 150, 112], 0.6), 0.45), (0.8 + wear * 0.3) * crack)
      return { h: 0.45 + g * 0.35 - (1 - joint) * 0.3 - (crack < 1 ? 0.15 : 0), c: mix(mix(SHADOW, col2, 0.45), col2, joint) }
    }),
    4 * (size / 512),
  )
}

/** Coursed ashlar for walls. */
function ashlar(size: number) {
  const seed = 47
  return fieldTextures(
    makeField(size, size, (u, v) => {
      const rows = 5
      const row = Math.floor(v * rows)
      const fv = v * rows - row
      const cols = 2 + Math.floor(hash(row, 0, seed) * 2)
      const cu = u * cols + hash(row, 1, seed)
      const col = Math.floor(cu)
      const fu = cu - col
      const edge = Math.min(fu, 1 - fu, (fv * cols) / rows, ((1 - fv) * cols) / rows)
      const joint = clamp01(edge / 0.015)
      const tone = hash(col % cols, row, seed)
      const { c, g } = stoneColor(u + tone * 3, v, seed + Math.floor(tone * 7))
      const cc = scale(c, 0.92 + tone * 0.12)
      return { h: 0.5 + g * 0.4 - (1 - joint) * 0.35, c: mix(mix(SHADOW, cc, 0.5), cc, joint) }
    }),
    4 * (size / 512),
  )
}

/** Draw a relief on a canvas in greys (light = raised), blur it, then turn it into stone. */
function relief(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, seed: number, strength: number, repeat = true) {
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const g = cv.getContext('2d')!
  g.fillStyle = '#5a5a5a'
  g.fillRect(0, 0, w, h)
  draw(g)
  const src = g.getImageData(0, 0, w, h).data
  let hgt = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) hgt[i] = src[i * 4] / 255
  for (let pass = 0; pass < 2; pass++) {
    const out = new Float32Array(w * h)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let s = 0
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += hgt[Math.min(h - 1, Math.max(0, y + dy)) * w + Math.min(w - 1, Math.max(0, x + dx))]
        out[y * w + x] = s / 9
      }
    hgt = out
  }
  const color = new Float32Array(w * h * 3)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const { c, g: grain } = stoneColor(x / w, y / h, seed)
      const hh = hgt[i] + (grain - 0.5) * 0.12
      hgt[i] = hh
      // recesses collect dust and shadow; raised parts catch the light
      const k = clamp01((hh - 0.25) * 1.5)
      const col = mix(mix(SHADOW, OCHRE, 0.55), c, 0.5 + 0.5 * k)
      color[i * 3] = col[0]
      color[i * 3 + 1] = col[1]
      color[i * 3 + 2] = col[2]
    }
  return fieldTextures({ w, h, height: hgt, color }, strength, repeat)
}

/** Three square medallion panels side by side (lotus rosette, scrolling vine, flower wheel). */
function medallionAtlas(size: number) {
  const W = size * 3
  return relief(
    W,
    size,
    (g) => {
      const rand = seeded(5)
      for (let p = 0; p < 3; p++) {
        const x0 = p * size
        const s = size
        const cx = x0 + s / 2
        const cy = s / 2
        // raised frame and inner fillet
        g.fillStyle = '#c8c8c8'
        g.fillRect(x0, 0, s, s)
        g.fillStyle = '#4a4a4a'
        g.fillRect(x0 + s * 0.08, s * 0.08, s * 0.84, s * 0.84)
        g.strokeStyle = '#9a9a9a'
        g.lineWidth = s * 0.012
        g.strokeRect(x0 + s * 0.11, s * 0.11, s * 0.78, s * 0.78)
        // corner leaves
        g.fillStyle = '#a8a8a8'
        for (const [qx, qy, a] of [[0.14, 0.14, 0], [0.86, 0.14, 1], [0.86, 0.86, 2], [0.14, 0.86, 3]] as const) {
          g.save()
          g.translate(x0 + qx * s, qy * s)
          g.rotate((a * Math.PI) / 2)
          g.beginPath()
          g.moveTo(0, 0)
          g.quadraticCurveTo(s * 0.12, s * 0.01, s * 0.1, s * 0.1)
          g.quadraticCurveTo(s * 0.01, s * 0.12, 0, 0)
          g.fill()
          g.restore()
        }
        // medallion ring
        g.strokeStyle = '#d6d6d6'
        g.lineWidth = s * 0.035
        g.beginPath()
        g.arc(cx, cy, s * 0.33, 0, Math.PI * 2)
        g.stroke()
        g.strokeStyle = '#b0b0b0'
        g.lineWidth = s * 0.012
        g.beginPath()
        g.arc(cx, cy, s * 0.285, 0, Math.PI * 2)
        g.stroke()
        if (p === 0) {
          // lotus rosette, two rings of petals
          for (const [n, r0, r1, wdt, shade] of [[8, 0.05, 0.25, 0.075, '#d0d0d0'], [8, 0.04, 0.16, 0.05, '#e4e4e4']] as const) {
            for (let i = 0; i < n; i++) {
              const a = (i / n) * Math.PI * 2 + (shade === '#e4e4e4' ? Math.PI / 8 : 0)
              g.save()
              g.translate(cx, cy)
              g.rotate(a)
              g.fillStyle = shade
              g.beginPath()
              g.moveTo(0, -s * r0)
              g.quadraticCurveTo(s * wdt, -s * (r0 + r1) * 0.55, 0, -s * r1)
              g.quadraticCurveTo(-s * wdt, -s * (r0 + r1) * 0.55, 0, -s * r0)
              g.fill()
              g.restore()
            }
          }
          g.fillStyle = '#f0f0f0'
          g.beginPath()
          g.arc(cx, cy, s * 0.05, 0, Math.PI * 2)
          g.fill()
        } else if (p === 1) {
          // scrolling vine: four spirals out of a central bud
          g.strokeStyle = '#d4d4d4'
          g.lineWidth = s * 0.03
          g.lineCap = 'round'
          for (let k = 0; k < 4; k++) {
            g.save()
            g.translate(cx, cy)
            g.rotate((k * Math.PI) / 2)
            g.beginPath()
            for (let t = 0; t <= 1; t += 0.02) {
              const r = s * (0.05 + 0.2 * t)
              const a = t * Math.PI * 2.2
              const px = Math.cos(a) * r * (1 - t * 0.35)
              const py = -Math.sin(a) * r * (1 - t * 0.35) - s * 0.08 * t
              if (t === 0) g.moveTo(px, py)
              else g.lineTo(px, py)
            }
            g.stroke()
            g.fillStyle = '#c4c4c4'
            g.beginPath()
            g.ellipse(s * 0.14, -s * 0.15, s * 0.05, s * 0.022, 0.8, 0, Math.PI * 2)
            g.fill()
            g.restore()
          }
          g.fillStyle = '#e8e8e8'
          g.beginPath()
          g.arc(cx, cy, s * 0.045, 0, Math.PI * 2)
          g.fill()
        } else {
          // flower wheel: spokes with bead tips
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2
            g.strokeStyle = '#cfcfcf'
            g.lineWidth = s * (i % 2 ? 0.014 : 0.03)
            g.beginPath()
            g.moveTo(cx + Math.cos(a) * s * 0.06, cy + Math.sin(a) * s * 0.06)
            g.lineTo(cx + Math.cos(a) * s * 0.24, cy + Math.sin(a) * s * 0.24)
            g.stroke()
            g.fillStyle = '#e0e0e0'
            g.beginPath()
            g.arc(cx + Math.cos(a) * s * 0.25, cy + Math.sin(a) * s * 0.25, s * 0.022, 0, Math.PI * 2)
            g.fill()
          }
          g.fillStyle = '#ececec'
          g.beginPath()
          g.arc(cx, cy, s * 0.07, 0, Math.PI * 2)
          g.fill()
        }
        // chisel noise so no two panels read identically
        for (let i = 0; i < 160; i++) {
          g.fillStyle = `rgba(0,0,0,${0.05 + rand() * 0.08})`
          g.fillRect(x0 + rand() * s, rand() * s, 2 + rand() * 4, 2 + rand() * 4)
        }
      }
    },
    61,
    7,
    false,
  )
}

/** Beam band (4:1): bead borders around a running vine with leaves. */
function vineBand(w: number, h: number) {
  return relief(
    w,
    h,
    (g) => {
      g.fillStyle = '#b8b8b8'
      g.fillRect(0, 0, w, h * 0.14)
      g.fillRect(0, h * 0.86, w, h * 0.14)
      g.fillStyle = '#d0d0d0'
      for (let x = 6; x < w; x += 14) {
        g.beginPath()
        g.arc(x, h * 0.2, 4.5, 0, Math.PI * 2)
        g.arc(x, h * 0.8, 4.5, 0, Math.PI * 2)
        g.fill()
      }
      g.strokeStyle = '#d6d6d6'
      g.lineWidth = h * 0.06
      g.beginPath()
      for (let x = 0; x <= w; x += 2) {
        const y = h / 2 + Math.sin((x / w) * Math.PI * 8) * h * 0.18
        if (x === 0) g.moveTo(x, y)
        else g.lineTo(x, y)
      }
      g.stroke()
      g.fillStyle = '#c6c6c6'
      for (let k = 0; k < 16; k++) {
        const x = (k + 0.5) * (w / 16)
        const up = k % 2 === 0
        g.beginPath()
        g.ellipse(x, h / 2 + (up ? -h * 0.2 : h * 0.2), h * 0.12, h * 0.05, up ? -0.5 : 0.5, 0, Math.PI * 2)
        g.fill()
        g.beginPath()
        g.arc(x + w / 32, h / 2 + (up ? h * 0.1 : -h * 0.1), h * 0.07, 0, Math.PI * 1.6)
        g.lineWidth = h * 0.03
        g.stroke()
      }
    },
    73,
    6,
  )
}

export type HallMat = 'stone' | 'panel' | 'ashlar' | 'floor' | 'beam' | 'void'

let cache: Record<HallMat, THREE.Material> | null = null

export function hallMaterials(low = false): Record<HallMat, THREE.Material> {
  if (cache) return cache
  const s = low ? 256 : 512
  const st = stone(s, 11)
  const pn = medallionAtlas(low ? 192 : 320)
  const as = ashlar(s)
  const fl = flagstones(s)
  const bm = vineBand(low ? 512 : 1024, low ? 128 : 256)
  const std = (t: { map: THREE.Texture; normalMap: THREE.Texture }, rough: number, ns = 1) =>
    new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughness: rough, normalScale: new THREE.Vector2(ns, ns) })
  cache = {
    stone: std(st, 0.92),
    panel: std(pn, 0.9, 1.15),
    ashlar: std(as, 0.95),
    floor: std(fl, 0.85, 0.9),
    beam: std(bm, 0.9, 1.4),
    void: new THREE.MeshBasicMaterial({ color: '#120904' }),
  }
  return cache
}
