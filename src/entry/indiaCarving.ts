import map from '../world/india-map.json'
import extras from '../world/india-extras.json'
import { PLACES } from '../world/places'
import { tx } from '../engine/content'
import { at, type CarveCanvases } from './carve'

// What gets carved into the chamber platform: India's outline (official boundary), rivers,
// mountain marks, names, a border, a seal and the Konark wheel. Each element is given a
// moment in the carving so the map appears as if being cut by a chisel.

export const SLAB = { w: 2048, h: 1418 }
const VB = map.viewBox as [number, number, number, number]
const S = (SLAB.h * 0.86) / VB[3]
const OX = SLAB.w / 2 - (VB[0] + VB[2] / 2) * S
const OY = SLAB.h / 2 - (VB[1] + VB[3] / 2) * S + 8
const P = map.projection

/** map units → slab pixels */
const px = (x: number, y: number): [number, number] => [OX + x * S, OY + y * S]
/** lon/lat → slab pixels */
export function slabPoint(lon: number, lat: number): [number, number] {
  return px((lon - P.lon0) * P.k * P.scale, -(lat - P.lat0) * P.scale)
}

function polylines(d: string): [number, number][][] {
  const out: [number, number][][] = []
  for (const part of d.split('M').filter(Boolean)) {
    const pts = part
      .replace(/Z/g, '')
      .split('L')
      .map((p) => {
        const [x, y] = p.split(',').map(Number)
        return px(x, y)
      })
    if (pts.length > 1) out.push(pts)
  }
  return out
}

const len = (l: [number, number][]) => l.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - l[i - 1][0], p[1] - l[i - 1][1]) : 0), 0)

/** Stroke polylines into the groove; colour the arrival canvas along their length, t0 → t1. */
function carveLines(c: CarveCanvases, lines: [number, number][][], width: number, t0: number, t1: number, closed = false) {
  const total = lines.reduce((s, l) => s + len(l) + (closed ? Math.hypot(l[0][0] - l[l.length - 1][0], l[0][1] - l[l.length - 1][1]) : 0), 0) || 1
  let run = 0
  c.groove.strokeStyle = '#fff'
  c.groove.lineWidth = width
  c.arrival.lineWidth = width + 3
  for (const l of lines) {
    const pts = closed ? [...l, l[0]] : l
    c.groove.beginPath()
    c.groove.moveTo(pts[0][0], pts[0][1])
    for (let i = 1; i < pts.length; i++) {
      c.groove.lineTo(pts[i][0], pts[i][1])
      const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
      c.arrival.strokeStyle = at(t0 + (t1 - t0) * (run / total))
      c.arrival.beginPath()
      c.arrival.moveTo(pts[i - 1][0], pts[i - 1][1])
      c.arrival.lineTo(pts[i][0], pts[i][1])
      c.arrival.stroke()
      run += seg
    }
    c.groove.stroke()
  }
}

/** Text cut letter by letter, left to right, between t0 and t1. */
function carveText(c: CarveCanvases, text: string, x: number, y: number, font: string, t0: number, t1: number, align: CanvasTextAlign = 'center', angle = 0, depth = 1) {
  for (const g of [c.groove, c.arrival]) {
    g.save()
    g.translate(x, y)
    g.rotate((angle * Math.PI) / 180)
    g.font = font
    g.textAlign = align
    g.textBaseline = 'middle'
  }
  const w = c.groove.measureText(text).width
  const x0 = align === 'center' ? -w / 2 : align === 'right' ? -w : 0
  // a hair of stroke round each letter: a wider cut that stays dark and legible once softened
  const d = Math.round(depth * 255)
  c.groove.fillStyle = c.groove.strokeStyle = `rgb(${d},${d},${d})`
  c.groove.lineWidth = depth < 1 ? 0 : 1.4
  c.groove.fillText(text, 0, 0)
  c.groove.strokeText(text, 0, 0)
  const grd = c.arrival.createLinearGradient(x0, 0, x0 + w, 0)
  grd.addColorStop(0, at(t0))
  grd.addColorStop(1, at(t1))
  c.arrival.fillStyle = grd
  c.arrival.strokeStyle = grd
  c.arrival.lineWidth = 4
  c.arrival.fillText(text, 0, 0)
  c.arrival.strokeText(text, 0, 0)
  c.groove.restore()
  c.arrival.restore()
}

/** The Konark wheel, as a small carved emblem (rim of beads, eight leaf spokes, hub). */
function konarkWheel(c: CarveCanvases, cx: number, cy: number, r: number, t0: number, t1: number) {
  const g = c.groove
  const a = c.arrival
  const inl = c.inlay
  const parts: ((ctx: CanvasRenderingContext2D) => void)[] = [
    (ctx) => {
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.stroke()
    },
    (ctx) => {
      ctx.beginPath()
      ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2)
      ctx.stroke()
    },
    (ctx) => {
      for (let i = 0; i < 24; i++) {
        const q = (i / 24) * Math.PI * 2
        ctx.beginPath()
        ctx.arc(cx + Math.cos(q) * r * 0.9, cy + Math.sin(q) * r * 0.9, r * 0.045, 0, Math.PI * 2)
        ctx.fill()
      }
    },
    (ctx) => {
      for (let i = 0; i < 8; i++) {
        const q = (i / 8) * Math.PI * 2
        const cq = Math.cos(q)
        const sq = Math.sin(q)
        const nx = -sq
        const ny = cq
        ctx.beginPath()
        ctx.moveTo(cx + cq * r * 0.2, cy + sq * r * 0.2)
        ctx.quadraticCurveTo(cx + cq * r * 0.5 + nx * r * 0.13, cy + sq * r * 0.5 + ny * r * 0.13, cx + cq * r * 0.8, cy + sq * r * 0.8)
        ctx.quadraticCurveTo(cx + cq * r * 0.5 - nx * r * 0.13, cy + sq * r * 0.5 - ny * r * 0.13, cx + cq * r * 0.2, cy + sq * r * 0.2)
        ctx.stroke()
        // thin spoke between the leaves
        const q2 = q + Math.PI / 8
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(q2) * r * 0.2, cy + Math.sin(q2) * r * 0.2)
        ctx.lineTo(cx + Math.cos(q2) * r * 0.8, cy + Math.sin(q2) * r * 0.8)
        ctx.stroke()
      }
    },
    (ctx) => {
      ctx.beginPath()
      ctx.arc(cx, cy, r * 0.2, 0, Math.PI * 2)
      ctx.fill()
    },
  ]
  parts.forEach((draw, k) => {
    const t = t0 + ((t1 - t0) * k) / parts.length
    for (const [ctx, col, w] of [
      [g, '#fff', r * 0.07],
      [a, at(t), r * 0.07 + 3],
      [inl, '#fff', r * 0.07 + 1],
    ] as const) {
      ctx.strokeStyle = col
      ctx.fillStyle = col
      ctx.lineWidth = w
      draw(ctx)
    }
  })
}

function seal(c: CarveCanvases, cx: number, cy: number, r: number, t0: number, t1: number, label: string, font: string) {
  c.groove.strokeStyle = '#fff'
  const ring = (rr: number, w: number, t: number) => {
    c.groove.lineWidth = w
    c.groove.beginPath()
    c.groove.arc(cx, cy, rr, 0, Math.PI * 2)
    c.groove.stroke()
    c.arrival.strokeStyle = at(t)
    c.arrival.lineWidth = w + 3
    c.arrival.beginPath()
    c.arrival.arc(cx, cy, rr, 0, Math.PI * 2)
    c.arrival.stroke()
  }
  ring(r, 4, t0)
  ring(r * 0.92, 2, t0 + 0.01)
  ring(r * 0.66, 3, t0 + 0.02)
  // lettering around the ring
  for (const ctx of [c.groove, c.arrival]) {
    ctx.save()
    ctx.font = font
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
  }
  const chars = [...label]
  chars.forEach((ch, i) => {
    const q = (i / chars.length) * Math.PI * 2 - Math.PI / 2
    for (const ctx of [c.groove, c.arrival]) {
      ctx.save()
      ctx.translate(cx + Math.cos(q) * r * 0.79, cy + Math.sin(q) * r * 0.79)
      ctx.rotate(q + Math.PI / 2)
      ctx.fillStyle = ctx === c.groove ? '#fff' : at(t0 + 0.03 + ((t1 - t0 - 0.05) * i) / chars.length)
      ctx.fillText(ch, 0, 0)
      ctx.restore()
    }
  })
  for (const ctx of [c.groove, c.arrival]) ctx.restore()
  // lotus at the heart
  for (let i = 0; i < 8; i++) {
    const q = (i / 8) * Math.PI * 2
    const pts: [number, number][] = []
    for (let k = 0; k <= 12; k++) {
      const s = k / 12
      const wdt = Math.sin(s * Math.PI) * r * 0.12
      const along = s * r * 0.55
      pts.push([cx + Math.cos(q) * along - Math.sin(q) * wdt, cy + Math.sin(q) * along + Math.cos(q) * wdt])
    }
    for (let k = 12; k >= 0; k--) {
      const s = k / 12
      const wdt = Math.sin(s * Math.PI) * r * 0.12
      const along = s * r * 0.55
      pts.push([cx + Math.cos(q) * along + Math.sin(q) * wdt, cy + Math.sin(q) * along - Math.cos(q) * wdt])
    }
    carveLines(c, [pts], 2.5, t1 - 0.04 + i * 0.004, t1 - 0.01 + i * 0.004)
  }
}

export interface IndiaCarving {
  /** slab-pixel position of each site, for the hover hotspot */
  sites: Record<string, [number, number]>
  konarkIcon: [number, number, number]
}

export const CARVE_FONTS: Record<string, { hand: string; title: string }> = {
  en: { hand: '"DM Sans", sans-serif', title: '"Cormorant Garamond", serif' },
  hi: { hand: '"DM Sans", sans-serif', title: '"Cormorant Garamond", serif' },
  or: { hand: '"DM Sans", sans-serif', title: '"Cormorant Garamond", serif' },
}
const FONTS = CARVE_FONTS


export async function loadCarvingFonts(lang: string) {
  const f = FONTS[lang] ?? FONTS.en
  await Promise.all([document.fonts.load(`40px ${f.hand}`), document.fonts.load(`600 40px ${f.title}`), document.fonts.load('600 40px "Cormorant Garamond"')]).catch(() => {})
}

export function drawIndia(c: CarveCanvases, lang: string, labels: { title: string; hint: string; soon?: string }): IndiaCarving {
  const f = FONTS[lang] ?? FONTS.en
  // drawn in slab units; the canvases may be scaled down for low quality
  const W = SLAB.w
  const H = SLAB.h
  // a carved border with notched corners
  const b = 34
  const border: [number, number][] = [
    [b + 26, b],
    [W - b - 26, b],
    [W - b, b + 26],
    [W - b, H - b - 26],
    [W - b - 26, H - b],
    [b + 26, H - b],
    [b, H - b - 26],
    [b, b + 26],
  ]
  carveLines(c, [border], 5, 0, 0.06, true)
  carveLines(c, [border.map(([x, y]) => [x + (x < W / 2 ? 12 : -12), y + (y < H / 2 ? 12 : -12)] as [number, number])], 2, 0.01, 0.07, true)

  // the outline: mainland first, then the islands
  const coast = polylines(map.india).sort((a, b2) => len(b2) - len(a))
  carveLines(c, coast, 4.5, 0.06, 0.48, true)

  // rivers flow in together, each along its own length
  for (const r of extras.rivers) carveLines(c, polylines(r.d), r.major ? 3 : 1.8, 0.46, 0.6)

  // mountain marks, west to east
  const peaks = [...extras.peaks].sort((a2, b2) => a2[0] - b2[0])
  peaks.forEach(([x, y, s], i) => {
    const [cx, cy] = px(x, y)
    const k = s * 6.5
    carveLines(c, [[[cx - k, cy + k * 0.45], [cx, cy - k * 0.85], [cx + k, cy + k * 0.45]]], 2, 0.56 + (0.12 * i) / peaks.length, 0.57 + (0.12 * i) / peaks.length)
  })

  // names
  const hand = (size: number, italic = false) => `${italic ? 'italic ' : ''}${size}px ${f.hand}`
  for (const s of extras.seas) {
    const [x, y] = px(s.x, s.y)
    carveText(c, tx(s as never, lang), x, y, hand(36, true), 0.66, 0.72)
  }
  for (const r of extras.ranges) {
    const [x, y] = px(r.x, r.y)
    carveText(c, tx(r as never, lang).toUpperCase(), x, y, hand(22), 0.68, 0.74, 'center', r.a)
  }
  for (const r of extras.riverLabels) {
    const [x, y] = px(r.x, r.y - 4)
    carveText(c, tx(r as never, lang), x, y, hand(20, true), 0.7, 0.75, 'center', r.a)
  }

  const sites: Record<string, [number, number]> = {}
  let konarkIcon: [number, number, number] = [0, 0, 0]
  for (const p of PLACES) {
    const [x, y] = slabPoint(p.lon, p.lat)
    sites[p.id] = [x, y]
    if (p.status === 'live') {
      // small dot at the place, the wheel emblem just above it, the name beside
      carveLines(c, [[[x - 1, y], [x + 1, y]]], 9, 0.86, 0.87)
      const r = 46
      konarkWheel(c, x, y - r - 18, r, 0.88, 0.99)
      konarkIcon = [x, y - r - 18, r]
      carveText(c, tx(p.name, lang), x + 18, y + 2, `600 38px ${f.hand}`, 0.95, 1, 'left')
    } else {
      // sites still to come: a shallow, faint cut (Konark alone is cut deep and inlaid)
      carveLines(c, [[[x - 1, y], [x + 1, y]]], 5, 0.78, 0.79)
      carveText(c, tx(p.name, lang), x + 13, y + 1, hand(23), 0.79, 0.84, 'left', 0, 0.45)
    }
  }

  // title, hint and the seal in the spare corners of the slab
  carveText(c, labels.title, 110, 150, `600 84px ${f.title}`, 0.72, 0.8, 'left')
  carveText(c, labels.hint, 112, 214, hand(31), 0.8, 0.86, 'left')
  if (labels.soon) carveText(c, labels.soon, 112, 258, hand(24, true), 0.86, 0.9, 'left', 0, 0.7)
  seal(c, W - 230, 235, 125, 0.74, 0.88, lang === 'en' ? 'BHĀRATA · भारत · BHĀRATA · भारत · ' : 'भारत · BHĀRATA · भारत · BHĀRATA · ', '600 20px "Cormorant Garamond", serif')
  // compass rose, bottom left
  const cx = 230
  const cy = H - 230
  const rose: [number, number][][] = []
  for (let i = 0; i < 8; i++) {
    const q = (i / 8) * Math.PI * 2 - Math.PI / 2
    const rr = i % 2 ? 60 : 105
    const s1 = q + 0.16
    const s2 = q - 0.16
    rose.push([[cx + Math.cos(s2) * 20, cy + Math.sin(s2) * 20], [cx + Math.cos(q) * rr, cy + Math.sin(q) * rr], [cx + Math.cos(s1) * 20, cy + Math.sin(s1) * 20]])
  }
  carveLines(c, rose, 3, 0.62, 0.7)
  carveText(c, 'N', cx, cy - 128, '600 34px "Cormorant Garamond", serif', 0.7, 0.71)
  return { sites, konarkIcon }
}
