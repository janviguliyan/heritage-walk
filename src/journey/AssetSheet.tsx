import type { SiteDefinition } from '../engine/site'
import { useStore } from '../engine/store'
import { Chakra, CompassRose, KolamCorner, Lotus, Paisley, TempleMark, VineBorder } from './motifs'

// Development only (?screen=assets): every motif and illustration on one page, so they can be
// exported as clean SVG (e.g. into the Figma design file). `&paper` shows just the blank paper.
export function AssetSheet({ site }: { site: SiteDefinition }) {
  const lang = useStore((s) => s.lang)
  const paperOnly = new URLSearchParams(location.search).has('paper')
  const { Plan, StoryArt } = site
  if (paperOnly) return <div className="paper-page" />
  const art = site.content.story.map((s) => s.art)
  return (
    <div className="paper-page asset-sheet" style={{ display: 'block', padding: 24 }}>
      <div data-asset="motif-lotus"><Lotus size={80} /></div>
      <div data-asset="motif-paisley"><Paisley size={80} /></div>
      <div data-asset="motif-kolam"><KolamCorner size={80} /></div>
      <div data-asset="motif-compass"><CompassRose size={140} /></div>
      <div data-asset="motif-temple"><TempleMark size={56} /></div>
      <div data-asset="motif-chakra"><Chakra size={80} /></div>
      <div data-asset="motif-vine"><VineBorder width={1384} /></div>
      {art.map((a) => (
        <div key={a} data-asset={`story-${a}`} style={{ width: 800 }}>
          <StoryArt art={a} />
        </div>
      ))}
      <div data-asset="plan" style={{ width: 960, height: 800 }}>
        <Plan hotspots={site.content.hotspots} lang={lang} onSpot={() => {}} />
      </div>
    </div>
  )
}
