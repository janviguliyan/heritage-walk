import { Suspense, lazy, useEffect, useRef } from 'react'
import type { SiteDefinition } from '../engine/site'
import { useStore } from '../engine/store'
import { setSite } from '../engine/actions'
import { loadVoiceManifest } from '../engine/narrator'
import { InkDefs } from './motifs'
import { SiteWelcome } from './SiteWelcome'
import { PaperReel } from './paper/PaperReel'
import { AssetSheet } from './AssetSheet'
import { Entry } from '../entry/Entry'
import { StoneMapUI } from '../entry/StoneMapUI'
import { Overview } from './Overview'
import { EnterVeil } from './EnterVeil'

/**
 * The journey: India map → the site's welcome page and plan → the prologue → the 3D walk.
 * The walk starts loading (paused) as soon as the visitor reaches the site, so "Let's go"
 * is quick.
 */
// the 3D walk (three.js, physics) is its own chunk, fetched once the visitor heads to a site
const Experience = lazy(() => import('../engine/Experience').then((m) => ({ default: m.Experience })))

export function Journey({ site }: { site: SiteDefinition }) {
  const screen = useStore((s) => s.screen)
  // the walk mounts when it is first entered, and then stays (it resumes where you left it)
  const walked = useRef(false)
  if (screen === 'tour') walked.current = true
  // the map unrolls when reached from the chamber; it simply appears on a deep link
  const arrived = useRef(false)
  const prev = useRef(screen)
  if (prev.current !== screen) {
    arrived.current = prev.current === 'entry' && screen === 'india'
    prev.current = screen
  }
  useEffect(() => {
    setSite(site)
    void loadVoiceManifest(site.assetBase)
  }, [site])
  return (
    <>
      <InkDefs />
      {screen === 'assets' && import.meta.env.DEV && <AssetSheet site={site} />}
      {/* the chamber stays (paused) under the story, so Konark is carved the moment it ends */}
      {(screen === 'entry' || screen === 'india' || screen === 'story' || screen === 'overview') && (
        <Entry face={screen === 'india' || screen === 'story' ? 'india' : screen === 'overview' ? 'konark' : 'none'} paused={screen === 'story'} />
      )}
      {screen === 'india' && <StoneMapUI />}
      {screen === 'site' && <SiteWelcome site={site} />}
      {screen === 'story' && <PaperReel site={site} />}
      {screen === 'overview' && <Overview site={site} />}
      {walked.current && (
        <Suspense fallback={null}>
          <Experience site={site} active={screen === 'tour'} />
        </Suspense>
      )}
      {screen === 'tour' && <EnterVeil name={site.content.name} />}
    </>
  )
}
