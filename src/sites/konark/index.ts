import type { SiteDefinition } from '../../engine/site'
import { parseContent } from '../../engine/content'
import raw from './content.json'
import { lazy } from 'react'
import { KonarkPlan } from './Plan'
import { KonarkStoryArt } from './StoryArt'
import { plan2d } from './layout'

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
}
