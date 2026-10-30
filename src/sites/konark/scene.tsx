import { use, useMemo } from 'react'
import { StaticWorld } from '../../kit/StaticWorld'
import { Horizon } from '../../kit/Horizon'
import { BanyanTree, BroadleafTrees, Casuarinas, Palms, Shrubs } from '../../kit/Trees'
import { banyanPlacement, broadleafPlacements, palmPlacements, shrubPlacements, treePlacements } from './build'
import { LAYOUT } from './layout'
import { sceneData } from './buildClient'

export { buildKonark, konarkMiniature, wheelPlacements, treePlacements, banyanPlacement, broadleafPlacements, shrubPlacements, palmPlacements, LAYOUT } from './build'

// ?nobake (dev): live lighting, to look at changed geometry before it is re-baked
const NOBAKE = import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('nobake')

/** within ~50 m of the enclosure: the trees a visitor walks past, which keep their dense crowns */
const nearWalk = (x: number, z: number) => {
  const E = LAYOUT.enclosure
  return x > E.x0 - 50 && x < E.x1 + 50 && z > E.z0 - 50 && z < E.z1 + 50
}

export function KonarkScene({ low }: { low: boolean }) {
  // built in a worker (see buildClient); suspends until ready
  const data = use(sceneData(low))
  const trees = useMemo(() => treePlacements(low), [low])
  const broad = useMemo(() => broadleafPlacements(low), [low])
  const shrubs = useMemo(() => shrubPlacements(low), [low])
  const palms = useMemo(palmPlacements, [])
  const banyan = useMemo(banyanPlacement, [])
  return (
    <>
      <StaticWorld data={data} low={low} bake={NOBAKE ? undefined : "/sites/konark/bake/"} detail="/sites/konark/tex/" />
      <Casuarinas trees={trees} />
      <BroadleafTrees trees={broad} low={low} near={nearWalk} />
      <Shrubs shrubs={shrubs} low={low} />
      <Palms palms={palms} />
      <BanyanTree tree={banyan} />
      {/* the land beyond the walls, out to the sea (tools/blender/distant.py) */}
      <Horizon base="/sites/konark/horizon/" low={low} />
    </>
  )
}
