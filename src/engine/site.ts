import type { ComponentType } from 'react'
import type { Hotspot, SiteContent } from './content'
import type { AudioZones, FootSurface } from './audio'

export interface SitePlanProps {
  hotspots: Hotspot[]
  lang: string
  /** go straight to a stop in the 3D walk */
  onSpot: (index: number) => void
}

/** Everything the engine needs to run a heritage site. A new site = a new folder exporting one of these. */
export interface SiteDefinition {
  /** matches an entry in world/places */
  id: string
  content: SiteContent
  /** static world: geometry, colliders, props */
  Scene: ComponentType<{ low: boolean }>
  /** optional "then and now" overlay, shown on the end screen */
  Reconstruction?: ComponentType<{ visible: boolean }>
  /** hand-drawn site plan for the welcome page, with clickable stops */
  Plan: ComponentType<SitePlanProps>
  /** illustrations for the prologue, keyed by each story scene's `art` */
  StoryArt: ComponentType<{ art: string }>
  /** sunrise direction in degrees clockwise from north (east = 90) */
  sunAzimuth: number
  audio: AudioZones
  /** public path for this site's audio/images */
  assetBase: string
  /** what is underfoot at (x, z), feet at height y: for the sound of each step */
  surface?: (x: number, z: number, y: number) => FootSurface
  /** flat shapes of the site for the corner map */
  plan2d?: { areas: [number, number, number, number, string][] }
}
