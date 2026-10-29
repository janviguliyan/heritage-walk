import { use, useMemo } from 'react'
import { StaticWorld } from '../../kit/StaticWorld'
import { BanyanTree, BroadleafTrees, Casuarinas, Palms, Shrubs } from '../../kit/Trees'
import { banyanPlacement, broadleafPlacements, palmPlacements, shrubPlacements, treePlacements } from './build'
import { sceneData } from './buildClient'

export { buildKonark, konarkMiniature, wheelPlacements, treePlacements, banyanPlacement, broadleafPlacements, shrubPlacements, palmPlacements, LAYOUT } from './build'

// ?nobake (dev): live lighting, to look at changed geometry before it is re-baked
const NOBAKE = import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('nobake')

export function KonarkScene({ low }: { low: boolean }) {
  // built in a worker (see buildClient); suspends until ready
  const data = use(sceneData())
  const trees = useMemo(() => treePlacements(low), [low])
  const broad = useMemo(() => broadleafPlacements(low), [low])
  const shrubs = useMemo(() => shrubPlacements(low), [low])
  const palms = useMemo(palmPlacements, [])
  const banyan = useMemo(banyanPlacement, [])
  return (
    <>
      <StaticWorld data={data} low={low} bake={NOBAKE ? undefined : "/sites/konark/bake/"} detail="/sites/konark/tex/" />
      <Casuarinas trees={trees} />
      <BroadleafTrees trees={broad} low={low} />
      <Shrubs shrubs={shrubs} />
      <Palms palms={palms} />
      <BanyanTree tree={banyan} />
    </>
  )
}
