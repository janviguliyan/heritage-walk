import type { SiteDefinition } from '../../engine/site'
import { parseContent } from '../../engine/content'
import raw from './content.json'
import { lazy } from 'react'
import { KonarkPlan } from './Plan'
import { KonarkStoryArt } from './StoryArt'
import { LAWNS, LAYOUT, plan2d } from './layout'

// translations live beside the English content, one file per language: content.<lang>.json
const overlays = Object.fromEntries(
  Object.entries(import.meta.glob<{ default: unknown }>('./content.*.json', { eager: true })).map(([path, mod]) => [path.match(/content\.([a-z]+)\.json$/)![1], mod.default]),
)

export const konark: SiteDefinition = {
  id: 'konark',
  content: parseContent(raw, overlays),
  // 3D parts load with the walk, not with the journey pages
  Scene: lazy(() => import('./scene').then((m) => ({ default: m.KonarkScene }))),
  Reconstruction: lazy(() => import('./Reconstruction').then((m) => ({ default: m.KonarkReconstruction }))),
  Plan: KonarkPlan,
  StoryArt: KonarkStoryArt,
  // October sunrise on the Odisha coast is a little south of due east
  sunAzimuth: 100,
  audio: {
    sea: [400, 0],
    music: '/audio/dhaka-kevin-macleod.mp3',
    reverb: [
      { x: -5, z: 0, r: 30 },
      { x: 46, z: 0, r: 18 },
    ],
  },
  assetBase: '/sites/konark/',
  plan2d: plan2d(),
  // underfoot: the temple's raised platforms, the paved court and the approach, else lawn
  surface: (x, z, y) => {
    if (y > 0.6) return 'stone'
    if (LAWNS.some(([x0, z0, x1, z1]) => x > x0 && x < x1 && z > z0 && z < z1)) return 'grass'
    const E = LAYOUT.enclosure
    const inside = x > E.x0 && x < E.x1 && z > E.z0 && z < E.z1
    const approach = x >= E.x1 - 2 && x < E.x1 + 42 && Math.abs(z) < 4.5
    return inside || approach ? 'paving' : 'grass'
  },
}
