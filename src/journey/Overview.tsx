import { useEffect, useRef, useState } from 'react'
import type { SiteDefinition } from '../engine/site'
import { tx } from '../engine/content'
import { store, useStore } from '../engine/store'
import { flyToStop } from '../engine/actions'
import { splitSentences } from '../engine/narrator'
import { useT } from '../i18n'
import { PLACES } from '../world/places'
import { LanguageMenu } from './LanguageSwitcher'
import { MuteButton } from '../entry/MuteButton'
import { mapState } from '../entry/mapState'
import { Chakra } from './motifs'
import { declutter, easeTo, type Pt } from '../ui/declutter'
import { GoldButton, HoverScroll, Scroll } from '../ui/Scroll'
import '../entry/map.css'
import './overview.css'

// Scene 5: arriving at Konark. The chamber platform (Entry/CarvedSlab) smooths India away,
// carves Konark's plan and raises the temple in miniature; then this scroll appears, with the
// stops as gold wheels on the model. Orbit and zoom with the pointer; Start journey enters.

/** Enter the walk once its scene is ready (a veil covers the wait), flying in to a stop. */
function enterWalk(index: number) {
  store.set({ screen: 'tour', mode: 'guided' })
  const go = () => requestAnimationFrame(() => flyToStop(index))
  if (store.get().sceneReady) return go()
  const off = store.subscribe(() => {
    if (!store.get().sceneReady) return
    off()
    go()
  })
}

/** The compact hover label for a stop: number, name, its first line, and how to go there. */
function StopCard({ index, total, title, line, lang, cta }: { index: number; total: number; title: string; line: string; lang: string; cta: string }) {
  return (
    <div lang={lang}>
      <p className="meta">
        {index + 1} / {total}
      </p>
      <h3>{title}</h3>
      <p className="line">{line}</p>
      <p className="go">{cta}</p>
    </div>
  )
}

export function Overview({ site }: { site: SiteDefinition }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const ready = useStore((s) => s.konarkReady)
  const c = site.content
  const list = c.hotspots
  const place = PLACES.find((p) => p.id === site.id)
  const minutes = Math.round((list.length * 2.5) / 5) * 5
  const [hover, setHover] = useState<number | null>(null)
  const pins = useRef<(HTMLButtonElement | null)[]>([])

  // prepare the walk in a background thread while the visitor looks at the model
  useEffect(() => {
    void import('../sites/konark/buildClient').then((m) => m.sceneData())
  }, [])
  // stop wheels follow the model as the view turns: positions straight to the DOM. Wheels that
  // would overlap fan out around their group, with a leader line to the true spot.
  const lines = useRef<(SVGLineElement | null)[]>([])
  const dots = useRef<(SVGCircleElement | null)[]>([])
  useEffect(() => {
    if (!ready) return
    let id = 0
    let drawn: Pt[] = []
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const pts = mapState.pins
      drawn = easeTo(drawn, declutter(pts, 36), Math.min(1, dt * 12))
      pts.forEach((p, i) => {
        const d = drawn[i]
        const el = pins.current[i]
        if (el) {
          el.style.translate = `${d.x - 17}px ${d.y - 17}px`
          el.style.visibility = 'visible'
        }
        const off = Math.hypot(d.x - p.x, d.y - p.y) > 4
        const ln = lines.current[i]
        if (ln) {
          ln.setAttribute('x1', String(p.x))
          ln.setAttribute('y1', String(p.y))
          ln.setAttribute('x2', String(d.x))
          ln.setAttribute('y2', String(d.y))
          ln.style.opacity = off ? '1' : '0'
        }
        const dot = dots.current[i]
        if (dot) {
          dot.setAttribute('cx', String(p.x))
          dot.setAttribute('cy', String(p.y))
          dot.style.opacity = off ? '1' : '0'
        }
      })
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [ready])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && store.set({ screen: 'india' })
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const h = hover != null ? list[hover] : null
  const el = hover != null ? pins.current[hover] : null
  const r = el?.getBoundingClientRect()
  const at = r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null
  const start = () => enterWalk(Math.max(0, store.get().current))
  return (
    <div className="overview-ui">
      <div className="map-top">
        <LanguageMenu />
      </div>
      <MuteButton />
      {ready && (
        <svg className="pin-leaders" aria-hidden="true">
          {list.map((s, i) => (
            <g key={s.id}>
              <line
                ref={(el) => {
                  lines.current[i] = el
                }}
              />
              <circle
                r={2.6}
                ref={(el) => {
                  dots.current[i] = el
                }}
              />
            </g>
          ))}
        </svg>
      )}
      {ready &&
        list.map((s, i) => (
          <button
            key={s.id}
            ref={(el) => {
              pins.current[i] = el
            }}
            className="wheel-pin plan-pin"
            // start where the wheel stands (the per-frame loop takes over from here)
            style={{ translate: mapState.pins[i] ? `${mapState.pins[i].x - 17}px ${mapState.pins[i].y - 17}px` : undefined, visibility: mapState.pins[i] ? undefined : 'hidden', ['--i' as string]: i }}
            aria-label={`${i + 1}. ${tx(s.title, lang)}`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover((v) => (v === i ? null : v))}
            onFocus={() => setHover(i)}
            onBlur={() => setHover((v) => (v === i ? null : v))}
            onClick={() => enterWalk(i)}
          >
            <Chakra size={26} />
            <span className="num">{i + 1}</span>
          </button>
        ))}
      {h && hover != null && at && (
        <HoverScroll key={hover} small x={at.x} y={at.y} width={260} height={240} label={tx(h.title, lang)}>
          <StopCard index={hover} total={list.length} title={tx(h.title, lang)} line={splitSentences(tx(h.body, lang))[0]} lang={lang} cta={t('overview.clickToGo')} />
        </HoverScroll>
      )}
      {ready && (
        <Scroll className="overview-panel" width={360}>
          <div className="ov" lang={lang}>
            <div className="ov-top">
              <button className="link-quiet" onClick={() => store.set({ screen: 'india' })}>
                ← {t('overview.backToMap')}
              </button>
              <button className="link-quiet" onClick={() => store.set({ screen: 'story' })}>
                ▸ {t('reel.watch')}
              </button>
            </div>
            <div className="ov-body">
              <p className="overview-kicker">{t('site.welcome')}</p>
              <h1>{tx(c.name, lang)}</h1>
              <p className="overview-line">{place ? tx(place.hook, lang) : tx(c.tagline, lang)}</p>
              <p className="overview-meta">{t('overview.meta', { n: list.length, m: minutes })}</p>
            </div>
            <GoldButton big onClick={start}>
              {t('overview.start')} →
            </GoldButton>
          </div>
        </Scroll>
      )}
    </div>
  )
}
