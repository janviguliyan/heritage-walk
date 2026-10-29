import * as THREE from 'three'
import { Builder } from '../kit/builder'
import { LAYOUT } from '../sites/konark/layout'
import type { Hotspot } from '../engine/content'
import { tx } from '../engine/content'
import { at, type CarveCanvases } from './carve'
import { SLAB } from './indiaCarving'

// The Konark site plan, cut into a stone tablet (stone mode of the overview). Same geometry
// as the hand-drawn plan: north up, east (the entrance) right, metres → slab pixels. It is
// carved from the east gate westward, the way a visitor walks it.

const VB = { x: -118, y: -100, w: 240, h: 200 }
const S = (SLAB.h * 0.82) / VB.h
const OX = SLAB.w / 2 - (VB.x + VB.w / 2) * S
const OY = SLAB.h / 2 - (VB.y + VB.h / 2) * S + 20

export const planPx = (x: number, z: number): [number, number] => [OX + x * S, OY + z * S]
/** arrival by position: east first, west last */
const when = (x: number, t0: number, t1: number) => t0 + (t1 - t0) * ((112 - x) / 230)

function rect(c: CarveCanvases, x0: number, z0: number, x1: number, z1: number, w: number, t0: number, t1: number, fill = false) {
  const [a, b] = planPx(x0, z0)
  const [cc, d] = planPx(x1, z1)
  c.groove.strokeStyle = c.groove.fillStyle = '#fff'
  c.groove.lineWidth = w
  if (fill) c.groove.fillRect(a, b, cc - a, d - b)
  else c.groove.strokeRect(a, b, cc - a, d - b)
  const grd = c.arrival.createLinearGradient(cc, 0, a, 0)
  grd.addColorStop(0, at(when(x1, t0, t1)))
  grd.addColorStop(1, at(when(x0, t0, t1)))
  c.arrival.strokeStyle = c.arrival.fillStyle = grd
  c.arrival.lineWidth = w + 3
  if (fill) c.arrival.fillRect(a - 1, b - 1, cc - a + 2, d - b + 2)
  else c.arrival.strokeRect(a, b, cc - a, d - b)
}

function line(c: CarveCanvases, pts: [number, number][], w: number, t0: number, t1: number) {
  const p = pts.map(([x, z]) => planPx(x, z))
  c.groove.strokeStyle = '#fff'
  c.groove.lineWidth = w
  c.groove.beginPath()
  p.forEach(([x, y], i) => (i ? c.groove.lineTo(x, y) : c.groove.moveTo(x, y)))
  c.groove.stroke()
  c.arrival.lineWidth = w + 3
  for (let i = 1; i < p.length; i++) {
    c.arrival.strokeStyle = at(when(pts[i][0], t0, t1))
    c.arrival.beginPath()
    c.arrival.moveTo(p[i - 1][0], p[i - 1][1])
    c.arrival.lineTo(p[i][0], p[i][1])
    c.arrival.stroke()
  }
}

function circle(c: CarveCanvases, x: number, z: number, r: number, w: number, t: number, fill = false, inlay = false) {
  const [cx, cy] = planPx(x, z)
  const targets: [CanvasRenderingContext2D, string, number][] = [
    [c.groove, '#fff', w],
    [c.arrival, at(t), w + 3],
  ]
  if (inlay) targets.push([c.inlay, '#fff', w + 1])
  for (const [g, col, lw] of targets) {
    g.strokeStyle = g.fillStyle = col
    g.lineWidth = lw
    g.beginPath()
    g.arc(cx, cy, r, 0, Math.PI * 2)
    if (fill) g.fill()
    else g.stroke()
  }
}

function text(c: CarveCanvases, s: string, x: number, y: number, font: string, t: number, align: CanvasTextAlign = 'center', inlay = false) {
  for (const g of inlay ? [c.groove, c.arrival, c.inlay] : [c.groove, c.arrival]) {
    g.font = font
    g.textAlign = align
    g.textBaseline = 'middle'
    g.fillStyle = g === c.arrival ? at(t) : '#fff'
    g.fillText(s, x, y)
  }
}

export interface PlanCarving {
  spots: [number, number][]
}

export function drawPlan(c: CarveCanvases, hotspots: Hotspot[], lang: string, title: string, font: { hand: string; title: string }): PlanCarving {
  const L = LAYOUT
  const E = L.enclosure
  const W = SLAB.w
  const H = SLAB.h
  // tablet border
  c.groove.strokeStyle = '#fff'
  c.groove.lineWidth = 5
  c.groove.strokeRect(34, 34, W - 68, H - 68)
  c.groove.lineWidth = 2
  c.groove.strokeRect(48, 48, W - 96, H - 96)
  c.arrival.strokeStyle = at(0.01)
  c.arrival.lineWidth = 8
  c.arrival.strokeRect(34, 34, W - 68, H - 68)
  c.arrival.strokeRect(48, 48, W - 96, H - 96)

  // enclosure wall with its gates (double line)
  for (const o of [0, 1.8]) {
    line(c, [[E.x1 - o, -5], [E.x1 - o, E.z0 + o], [4, E.z0 + o]], 4, 0.04, 0.3)
    line(c, [[-4, E.z0 + o], [E.x0 + o, E.z0 + o], [E.x0 + o, E.z1 - o], [-4, E.z1 - o]], 4, 0.04, 0.3)
    line(c, [[4, E.z1 - o], [E.x1 - o, E.z1 - o], [E.x1 - o, 5]], 4, 0.04, 0.3)
  }
  rect(c, E.x1 - 2.5, -10, E.x1 + 2.5, -5, 3, 0.03, 0.06, true)
  rect(c, E.x1 - 2.5, 5, E.x1 + 2.5, 10, 3, 0.03, 0.06, true)
  // approach path
  line(c, [[E.x1 + 14, -3], [L.nataMandir.x + 20, -3]], 2, 0.06, 0.1)
  line(c, [[E.x1 + 14, 3], [L.nataMandir.x + 20, 3]], 2, 0.06, 0.1)

  // nata mandir: platform, pillars, stairs
  const N = L.nataMandir
  rect(c, N.x - N.size / 2, -N.size / 2, N.x + N.size / 2, N.size / 2, 5, 0.3, 0.36)
  rect(c, N.x - N.size / 2 + 1.4, -N.size / 2 + 1.4, N.x + N.size / 2 - 1.4, N.size / 2 - 1.4, 2, 0.31, 0.37)
  for (const px of [-9, -3, 3, 9]) for (const pz of [-9, -3, 3, 9]) rect(c, N.x + px - 0.9, pz - 0.9, N.x + px + 0.9, pz + 0.9, 2, 0.33, 0.38, true)
  for (const sx of [N.x + N.size / 2, N.x - N.size / 2 - 8]) for (let k = 1; k < 7; k++) line(c, [[sx + (8 * k) / 7, -4], [sx + (8 * k) / 7, 4]], 1.6, 0.34, 0.39)
  for (const z of [-7.5, 7.5]) rect(c, N.x + N.size / 2 + 8.5, z - 1.1, N.x + N.size / 2 + 12.5, z + 1.1, 2, 0.3, 0.33, true)

  // chariot plinth with 24 wheels and seven horses
  const C = L.chariot
  rect(c, C.x0, -C.half, C.x1, C.half, 5, 0.38, 0.62)
  rect(c, C.x0 + 1.4, -C.half + 1.4, C.x1 - 1.4, C.half - 1.4, 2, 0.39, 0.63)
  const wheels = [10, 6, 2, ...Array.from({ length: 9 }, (_, i) => -11.5 - i * 6)]
  for (const x of wheels)
    for (const z of [C.half + 1.9, -C.half - 1.9]) {
      const t = when(x, 0.38, 0.62)
      circle(c, x, z, 1.7 * S, 2, t)
      for (let i = 0; i < 4; i++) {
        const q = (i / 4) * Math.PI
        line(c, [[x - Math.cos(q) * 1.6, z - Math.sin(q) * 1.6], [x + Math.cos(q) * 1.6, z + Math.sin(q) * 1.6]], 1.2, t, t)
      }
    }
  for (const z of [-16, -12, -8, 8, 12, 16, 20]) rect(c, C.x1 + 3, z - 0.9, C.x1 + 7, z + 0.9, 2, 0.4, 0.42, true)
  // jagamohana: stepped roof seen from above, amalaka at the crown
  const J = L.jagamohana
  ;[0, 3.5, 7, 10, 12.4].forEach((inset, i) => rect(c, J.x - J.w / 2 + inset, -J.w / 2 + inset, J.x + J.w / 2 - inset, J.w / 2 - inset, i ? 2.5 : 5, 0.48, 0.56))
  circle(c, J.x, 0, 1.8 * S, 2, 0.56)
  // deul: thick walls, three Surya niches
  const D = L.deul
  rect(c, D.x - D.w / 2, -D.w / 2, D.x + D.w / 2, D.w / 2, 5, 0.6, 0.66)
  rect(c, D.x - D.w / 2 + 4, -D.w / 2 + 4, D.x + D.w / 2 - 4, D.w / 2 - 4, 3, 0.61, 0.67)
  for (const [x, z] of [[D.x, D.w / 2 + 1], [D.x, -D.w / 2 - 1], [D.x - D.w / 2 - 1, 0]] as const) rect(c, x - 2, z - 1, x + 2, z + 1, 2, 0.66, 0.68, true)
  // stairs to the plinth
  for (const [sx, dir] of [[C.x1, 1], [C.x0 - 8, 1]] as const) for (let k = 1; k < 7; k++) line(c, [[sx + (8 * k * dir) / 7, -4.5], [sx + (8 * k * dir) / 7, 4.5]], 1.6, when(sx, 0.38, 0.62), when(sx, 0.38, 0.62))
  for (const zz of [C.half, -C.half - 8]) for (let k = 1; k < 7; k++) line(c, [[J.x - 3.5, zz + (8 * k) / 7], [J.x + 3.5, zz + (8 * k) / 7]], 1.6, 0.5, 0.5)
  // Mayadevi temple
  const M = L.mayadevi
  rect(c, M.x - 6.5, M.z - 6.5, M.x + 6.5, M.z + 6.5, 4, 0.7, 0.74)
  rect(c, M.x - 4.5, M.z - 4.5, M.x + 4.5, M.z + 4.5, 3, 0.71, 0.75)
  rect(c, M.x + 6.5, M.z - 4.5, M.x + 15.5, M.z + 4.5, 2, 0.7, 0.72)

  // north arrow, scale, title
  const [nx, ny] = planPx(-110, -82)
  line(c, [[-110, -78], [-108.5, -86], [-107, -78]], 2.5, 0.74, 0.76)
  text(c, 'N', nx + 6, ny - 34, `600 30px "Cormorant Garamond", serif`, 0.76)
  line(c, [[-110, 90], [-60, 90]], 2.5, 0.75, 0.78)
  for (const x of [-110, -85, -60]) line(c, [[x, 88.5], [x, 91.5]], 2, 0.77, 0.77)
  const [sx2, sy2] = planPx(-60, 90)
  text(c, '50 m', sx2 + 40, sy2, `22px ${font.hand}`, 0.78)
  text(c, title, W / 2, 105, `600 56px ${font.title}`, 0.8)

  // the story stops: gold-inlaid numbered discs, carved last
  const spots: [number, number][] = []
  hotspots.forEach((h, i) => {
    const [x, z] = [h.position[0], h.position[2]]
    const t = 0.84 + (0.14 * i) / hotspots.length
    circle(c, x, z, 24, 4, t, false, true)
    circle(c, x, z, 18, 0, t, true, true)
    spots.push(planPx(x, z))
    // numbers are cut out of the inlay disc: carve them back to stone
    const [cx, cy] = planPx(x, z)
    for (const g of [c.inlay]) {
      g.fillStyle = '#000'
      g.font = '700 22px "DM Sans", sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(String(i + 1), cx, cy + 1)
    }
  })
  void lang
  void tx
  return { spots }
}

/** Height on the tablet (tablet units) for a height in metres on site. */
export const planHeight = (y: number, unit: number) => y * RELIEF_Y * S * unit
/** heights on the miniature are a little exaggerated so the temple reads from above */
export const RELIEF_Y = 1.3

/** Matrix taking site metres to tablet space (above the tablet's top). */
export function siteToTablet(toTablet: (x: number, y: number) => [number, number], unit: number) {
  const [ox, oz] = toTablet(...planPx(0, 0))
  const m = S * unit
  return new THREE.Matrix4().makeTranslation(ox, 0, oz).multiply(new THREE.Matrix4().makeScale(m, m * RELIEF_Y, m))
}

/** The buildings of the plan, raised in relief on the tablet (heights a little exaggerated). */
export function planRelief(toTablet: (x: number, y: number) => [number, number], unit: number) {
  const b = new Builder()
  const [ox, oz] = toTablet(...planPx(0, 0))
  const m = S * unit
  const L = LAYOUT
  const H = 1.5
  b.group([ox, 0, oz], 0, () => {
    const box = (sx: number, sy: number, sz: number, x: number, y: number, z: number) => b.box('r', [sx, sy * H, sz], [x, y * H + (sy * H) / 2, z])
    const E = L.enclosure
    box(E.x1 - E.x0, 3, 1.6, (E.x0 + E.x1) / 2, 0, E.z0)
    box(E.x1 - E.x0, 3, 1.6, (E.x0 + E.x1) / 2, 0, E.z1)
    box(1.6, 3, E.z1 - E.z0, E.x0, 0, 0)
    box(1.6, 3, E.z1 - E.z0 - 12, E.x1, 0, 0)
    for (const z of [-7.5, 7.5]) box(5, 6, 5, E.x1, 0, z)
    // nata mandir and its pillar stumps
    const N = L.nataMandir
    box(N.size, N.h, N.size, N.x, 0, 0)
    for (const x of [-9, -3, 3, 9]) for (const z of [-9, -3, 3, 9]) box(1.6, 2.2, 1.6, N.x + x, N.h, z)
    box(8, N.h * 0.6, 8, N.x + N.size / 2 + 4, 0, 0)
    // the chariot plinth with its wheels
    const C = L.chariot
    box(C.x1 - C.x0, C.h, C.half * 2, (C.x0 + C.x1) / 2, 0, 0)
    const xs = [10, 6, 2, ...Array.from({ length: 9 }, (_, i) => -11.5 - i * 6)]
    for (const x of xs)
      for (const z of [C.half + 0.4, -C.half - 0.4]) {
        b.add('r', new THREE.CylinderGeometry(1.5, 1.5, 0.6, 16), { pos: [x, 1.5 * H, z], rot: [Math.PI / 2, 0, 0] })
      }
    for (const z of [-16, -12, -8, 8, 12, 16, 20]) box(3.2, 3, 1.1, C.x1 + 5, 0, z)
    // jagamohana: walls and a stepped roof
    const J = L.jagamohana
    box(J.w, 10, J.w, J.x, C.h, 0)
    let w = J.w + 1
    let y = C.h + 10
    for (let i = 0; i < 12; i++) {
      box(w, 0.9, w, J.x, y, 0)
      y += 0.9 + (i === 4 || i === 8 ? 1.6 : 0)
      w -= 1.5
    }
    b.add('r', new THREE.SphereGeometry(Math.max(2, w * 0.5), 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), { pos: [J.x, y * H, 0], scale: [1, 0.5 * H, 1] })
    // the ruined deul and the antarala
    const D = L.deul
    box(10, 5, 14, -24, C.h, 0)
    box(D.w, 3.5, D.w, D.x, C.h, 0)
    box(D.w - 6, 5, D.w - 6, D.x, C.h + 3.5, 0)
    // Mayadevi temple
    const M = L.mayadevi
    box(13, 2, 13, M.x, 0, M.z)
    box(9, 5, 9, M.x, 2, M.z)
    box(9, 1.6, 9, M.x + 11, 0, M.z)
  }, m)
  return b.build().get('r')!
}
