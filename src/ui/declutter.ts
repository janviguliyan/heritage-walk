// Markers that would overlap fan out on a small ring around their group's centre, in the same
// order as their true directions from it (so the layout still reads), each joined to its true
// spot by a leader line. Used for the stop wheels over the 3D maps and on the corner map.

export type Pt = { x: number; y: number }

/** Where to draw each marker so none overlap closer than `gap` (same units as the points). */
export function declutter(pts: Pt[], gap: number, skip?: (i: number) => boolean): Pt[] {
  const n = pts.length
  const parent = pts.map((_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  for (let i = 0; i < n; i++) {
    if (skip?.(i)) continue
    for (let j = i + 1; j < n; j++) {
      if (skip?.(j)) continue
      if (Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) < gap) parent[find(i)] = find(j)
    }
  }
  const groups = new Map<number, number[]>()
  for (let i = 0; i < n; i++) {
    const r = find(i)
    groups.set(r, [...(groups.get(r) ?? []), i])
  }
  const out = pts.map((p) => ({ x: p.x, y: p.y }))
  for (const g of groups.values()) {
    if (g.length < 2) continue
    const cx = g.reduce((s, i) => s + pts[i].x, 0) / g.length
    const cy = g.reduce((s, i) => s + pts[i].y, 0) / g.length
    // a ring just big enough for the group, never smaller than one marker's width
    const R = Math.max(gap * 0.85, (g.length * gap * 1.08) / (2 * Math.PI))
    const ang = (i: number) => Math.atan2(pts[i].y - cy, pts[i].x - cx)
    // order by direction, starting from the stop with the lowest number (stable as views turn)
    const sorted = [...g].sort((a, b) => ang(a) - ang(b))
    const first = sorted.indexOf(Math.min(...g))
    const a0 = ang(sorted[first])
    sorted.forEach((i, k) => {
      const a = a0 + (((k - first + g.length) % g.length) / g.length) * Math.PI * 2
      out[i] = { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R }
    })
  }
  return out
}

/** Ease drawn positions toward their targets (so groups forming and parting don't snap). */
export function easeTo(cur: Pt[], target: Pt[], k: number) {
  if (cur.length !== target.length) return target.map((p) => ({ ...p }))
  cur.forEach((c, i) => {
    c.x += (target[i].x - c.x) * k
    c.y += (target[i].y - c.y) * k
  })
  return cur
}
