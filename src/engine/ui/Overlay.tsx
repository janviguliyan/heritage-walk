import { useEffect, useRef, useState } from 'react'
import type { SiteDefinition } from '../site'
import { tx, type Hotspot } from '../content'
import { useT } from '../../i18n'
import { commands, live, store, useStore } from '../store'
import { setLanguage } from '../../i18n'
import { closeCard, closeMap, goToStop, hideEnd, leaveTour, openHotspot, openMap } from '../actions'
import { pauseNarration, replayNarration, resumeNarration, seekNarration, storySentences } from '../narrator'
import { Chakra } from './Chakra'
import { declutter } from '../../ui/declutter'

export function Overlay({ site }: { site: SiteDefinition }) {
  const phase = useStore((s) => s.phase)
  const ready = useStore((s) => s.sceneReady)
  useKeys(site)
  return (
    <>
      {phase === 'walk' && ready && (
        <>
          <Hud site={site} />
          <MapBar />
          <StoryPanel site={site} />
          <EndScreen site={site} />
          <TouchControls />
        </>
      )}
    </>
  )
}

let hintSeen = false

function Hud({ site }: { site: SiteDefinition }) {
  const s = useStore((x) => x)
  const t = useT()
  const list = site.content.hotspots
  const near = list.find((h) => h.id === s.nearId)
  const inMap = s.overview || s.flying
  const showPrompt = near && near.id !== s.activeId && !s.gliding && !s.showEnd && !inMap
  // the controls hint goes for good once the mouse has been captured, or after 12 s on screen
  const [hintDone, setHintDone] = useState(hintSeen)
  useEffect(() => {
    if (hintDone) return
    if (s.locked) {
      hintSeen = true
      setHintDone(true)
      return
    }
    const id = window.setTimeout(() => {
      hintSeen = true
      setHintDone(true)
    }, 12000)
    return () => window.clearTimeout(id)
  }, [s.locked, hintDone])
  return (
    <>
      <div className="hud-left">
        <div className="site-name">{tx(site.content.name, s.lang)}</div>
        <div className="counter" aria-live="polite">
          {t('hud.stop', { n: Math.max(1, s.current + 1), total: list.length })}
          <span className="visited"> · {t('hud.visited', { n: s.visited.length })}</span>
        </div>
      </div>
      {!inMap && <RadialMenu site={site} />}
      {!inMap && <MiniMap site={site} />}
      {s.locked && !inMap && <div className="crosshair" />}
      {/* how to look around: once, until the visitor has tried it (and never beside the prompt) */}
      {!hintDone && !s.locked && !s.touch && !s.gliding && !s.showEnd && !inMap && !s.activeId && !showPrompt && <div className="hint">{t('hud.hint')}</div>}
      {showPrompt && (
        <button className="prompt" onClick={() => openHotspot(near.id)}>
          <Chakra size={22} className="spinning" />
          <span>
            {s.touch ? t('hud.tap') : t('hud.press')} — {tx(near.title, s.lang)}
          </span>
        </button>
      )}
    </>
  )
}

const ICON = {
  map: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14',
  guided: 'M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z',
  free: 'M13 4a2 2 0 1 1 0 .1M9 21l2-6 3 2v4M11 15l-1-5 4-1 3 3h3M10 10l-3 3',
  next: 'M5 12h12M13 6l6 6-6 6',
  lang: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  soundOn: 'M4 9h4l5-4v14l-5-4H4zM17 9a4 4 0 0 1 0 6M19.5 6.5a7.5 7.5 0 0 1 0 11',
  soundOff: 'M4 9h4l5-4v14l-5-4H4zM17 9l5 6M22 9l-5 6',
  music: 'M9 18V6l11-2v12M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM20 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z',
  voice: 'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  quality: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4',
  leave: 'M15 6l-6 6 6 6',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
}
export function Icon({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

/** Every control behind one ⋯ button: it fans out into an arc of icons. */
function RadialMenu({ site }: { site: SiteDefinition }) {
  const s = useStore((x) => x)
  const t = useT()
  const [open, setOpen] = useState(false)
  const langs = ['en', 'hi', 'or']
  const items: { key: string; icon: string; label: string; on?: boolean; act: () => void; disabled?: boolean }[] = [
    { key: 'map', icon: ICON.map, label: `${t('hud.map')} (M)`, act: () => openMap(), disabled: s.flying },
    { key: 'sound', icon: s.muted ? ICON.soundOff : ICON.soundOn, label: s.muted ? t('hud.soundOff') : t('hud.soundOn'), on: !s.muted, act: () => store.set({ muted: !s.muted }) },
    { key: 'lang', icon: ICON.lang, label: `${t('lang.label')}: ${s.lang.toUpperCase()}`, act: () => setLanguage(langs[(langs.indexOf(s.lang) + 1) % langs.length]) },
    { key: 'leave', icon: ICON.leave, label: t('hud.leave'), act: leaveTour },
  ]
  void site
  useEffect(() => {
    if (!open) return
    const off = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', off)
    return () => window.removeEventListener('keydown', off)
  }, [open])
  // a quarter circle fanning down and left from the top-right corner
  const R = 118
  return (
    <div className={`radial${open ? ' open' : ''}`}>
      {items.map((it, i) => {
        // one quarter-circle arc, down and to the left of the button
        const a = (Math.PI / 2) * (i / (items.length - 1))
        const r = R
        const x = -Math.sin(a) * r
        const y = Math.cos(a) * r
        return (
          <button
            key={it.key}
            className={`radial-item${it.on ? ' on' : ''}`}
            style={{ '--x': `${x}px`, '--y': `${y}px`, '--d': `${i * 28}ms` } as React.CSSProperties}
            onClick={() => {
              it.act()
              if (it.key === 'map' || it.key === 'leave' || it.key === 'next') setOpen(false)
            }}
            disabled={it.disabled}
            aria-label={it.label}
            title={it.label}
            tabIndex={open ? 0 : -1}
          >
            <Icon d={it.icon} />
          </button>
        )
      })}
      <button className="radial-toggle" aria-expanded={open} aria-label={t('hud.more')} onClick={() => setOpen(!open)}>
        <Icon d={open ? 'M6 6l12 12M18 6L6 18' : ICON.more} size={22} />
      </button>
    </div>
  )
}

const WINDS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

/** A GTA-style map in the corner that is also the compass: heading-up, the site around you,
 *  every stop (those off the map wait on its rim, pointing the way), a brass bezel with the
 *  eight directions and the sun; the one you face lights up under the mark at the top. Positions
 *  update per frame without re-rendering. */
function MiniMap({ site }: { site: SiteDefinition }) {
  const lang = useStore((x) => x.lang)
  const visited = useStore((x) => x.visited)
  const world = useRef<SVGGElement>(null)
  const bezel = useRef<SVGGElement>(null)
  const letters = useRef<(SVGTextElement | null)[]>([])
  const sun = useRef<SVGGElement>(null)
  const stops = useRef<(SVGGElement | null)[]>([])
  const leaders = useRef<(SVGLineElement | null)[]>([])
  const list = site.content.hotspots
  const R = 64 // metres from centre to the map's rim
  const B = R + 8.4 // radius of the bezel letters
  const O = R + 16 // outer edge of the bezel
  const nextIndex = list.findIndex((h) => !visited.includes(h.id))
  useEffect(() => {
    let id = 0
    let shown = -1
    const tick = () => {
      const yaw = live.yaw
      const deg = (yaw * 180) / Math.PI
      world.current?.setAttribute('transform', `rotate(${deg}) translate(${-live.x} ${-live.z})`)
      bezel.current?.setAttribute('transform', `rotate(${deg})`)
      // the letters ride round the bezel but stay upright
      letters.current.forEach((el, i) => el?.setAttribute('transform', `rotate(${i * 45 + deg}) translate(0 ${-B}) rotate(${-i * 45 - deg})`))
      sun.current?.setAttribute('transform', `rotate(${live.sunAzimuth}) translate(0 ${-R + 9})`)
      // the direction you face lights up on the bezel
      const hd = (((-deg % 360) + 360) % 360)
      const face = Math.round(hd / 45) % 8
      if (face !== shown) {
        letters.current.forEach((el, k) => el?.classList.toggle('facing', k === face))
        shown = face
      }
      const c = Math.cos(yaw)
      const sn = Math.sin(yaw)
      const edge = R - 7
      const pts = list.map((h) => {
        const dx = h.position[0] - live.x
        const dz = h.position[2] - live.z
        // rotate into the map's frame (same as the SVG rotate above)
        let x = dx * c - dz * sn
        let y = dx * sn + dz * c
        const d = Math.hypot(x, y)
        const off = d > edge
        if (off) {
          x = (x / d) * edge
          y = (y / d) * edge
        }
        return { x, y, off }
      })
      // stops close together fan out (kept inside the rim)
      const drawn = declutter(pts, 11.2)
      pts.forEach((p, i) => {
        const el = stops.current[i]
        if (!el) return
        const d = drawn[i]
        const r = Math.hypot(d.x, d.y)
        if (r > edge) {
          d.x *= edge / r
          d.y *= edge / r
        }
        el.setAttribute('transform', `translate(${d.x.toFixed(1)} ${d.y.toFixed(1)})`)
        el.classList.toggle('edge', p.off)
        const ln = leaders.current[i]
        if (ln) {
          ln.setAttribute('x1', p.x.toFixed(1))
          ln.setAttribute('y1', p.y.toFixed(1))
          ln.setAttribute('x2', d.x.toFixed(1))
          ln.setAttribute('y2', d.y.toFixed(1))
        }
      })
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [list, B, R])
  const L = site.plan2d
  return (
    <div className="minimap" role="img" aria-label="Map and compass">
      <svg viewBox={`${-O - 2} ${-O - 2} ${(O + 2) * 2} ${(O + 2) * 2}`}>
        <defs>
          <clipPath id="mm-clip">
            <circle r={R} />
          </clipPath>
          <radialGradient id="mm-disc" cx="0.5" cy="0.45" r="0.6">
            <stop offset="0" stopColor="#2c2016" />
            <stop offset="1" stopColor="#120b06" />
          </radialGradient>
          <radialGradient id="mm-brass" cx="0.4" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#5a3c1e" />
            <stop offset="0.7" stopColor="#2a190b" />
            <stop offset="1" stopColor="#1a0f06" />
          </radialGradient>
          <radialGradient id="mm-cone" cx="0" cy="0" r="1" gradientUnits="objectBoundingBox">
            <stop offset="0" stopColor="#ffe9b0" stopOpacity="0.45" />
            <stop offset="1" stopColor="#ffe9b0" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle r={O} fill="url(#mm-brass)" className="mm-outer" />
        <circle r={O - 2.2} className="mm-inner-line" />
        <circle r={R} fill="url(#mm-disc)" />
        <g clipPath="url(#mm-clip)">
          <g ref={world}>
            {L?.areas.map((a, i) => <rect key={i} x={a[0]} y={a[1]} width={a[2] - a[0]} height={a[3] - a[1]} rx={a[4] === 'wall' ? 0 : 0.6} className={`mm-${a[4]}`} />)}
          </g>
          {/* what you are looking at */}
          <path d="M0 0 L-20 -44 A48 48 0 0 1 20 -44 Z" fill="url(#mm-cone)" />
        </g>
        <g ref={bezel} className="mm-bezel">
          {Array.from({ length: 72 }, (_, i) => (
            <line key={i} x1={0} y1={-R - 1.5} x2={0} y2={-R - (i % 18 === 0 ? 5 : i % 6 === 0 ? 4 : 2.6)} transform={`rotate(${i * 5})`} className={i % 6 === 0 ? 'major' : ''} />
          ))}
          {/* north: a saffron pointer on the bezel's outer edge */}
          <path d={`M0 ${-O + 0.5} L3.2 ${-O + 5.5} L-3.2 ${-O + 5.5} Z`} className="mm-north" />
          <g ref={sun} className="mm-sun">
            <circle r={3.2} />
            {Array.from({ length: 8 }, (_, i) => (
              <line key={i} x1={0} y1={-4.6} x2={0} y2={-6.2} transform={`rotate(${i * 45})`} />
            ))}
          </g>
        </g>
        {WINDS.map((w, i) => (
          <text
            key={w}
            ref={(el) => {
              letters.current[i] = el
            }}
            textAnchor="middle"
            dominantBaseline="central"
            className={w === 'N' ? 'mm-n' : w.length === 1 ? 'mm-d' : 'mm-dd'}
          >
            {w}
          </text>
        ))}
        <circle r={R} className="mm-rim" />
        {/* the fixed mark you read your heading from */}
        <path d={`M0 ${-O + 2.5} L-3.2 ${-O - 3} L3.2 ${-O - 3} Z`} className="mm-lubber" />
        {list.map((h, i) => (
          <line
            key={h.id}
            className="mm-leader"
            ref={(el) => {
              leaders.current[i] = el
            }}
          />
        ))}
        {list.map((h, i) => (
          <g
            key={h.id}
            ref={(el) => {
              stops.current[i] = el
            }}
            className={`mm-stop${visited.includes(h.id) ? ' visited' : ''}${i === nextIndex ? ' next' : ''}`}
            onClick={() => goToStop(i)}
          >
            <title>{`${i + 1}. ${tx(h.title, lang)}`}</title>
            {i === nextIndex && <circle r={8.2} className="mm-halo" />}
            <circle r={5.3} />
            <text y={2.1} textAnchor="middle">
              {i + 1}
            </text>
          </g>
        ))}
        <path d="M0 -6.5 L4.8 5 L0 2.6 L-4.8 5 Z" className="mm-me" />
      </svg>
    </div>
  )
}

/** Over the aerial map: what to do, and zoom. The stops are the wheels on the map itself. */
function MapBar() {
  const overview = useStore((s) => s.overview)
  const flying = useStore((s) => s.flying)
  const t = useT()
  if (!overview || flying) return null
  return (
    <>
      <div className="map-bar">
        <span>{t('map.title')}</span>
        <button className="primary" onClick={closeMap}>
          {t('hud.backToWalking')} (M)
        </button>
      </div>
      <div className="map-zoom">
        <button aria-label={t('map.zoomIn')} onClick={() => (commands.zoom -= 250)}>
          +
        </button>
        <button aria-label={t('map.zoomOut')} onClick={() => (commands.zoom += 250)}>
          −
        </button>
      </div>
    </>
  )
}

/** The story beside the walk: real photos, the text with the spoken sentence highlighted,
 *  and narration controls. Docked to the right edge; it hides to a tab with the stop's name. */
function StoryPanel({ site }: { site: SiteDefinition }) {
  const id = useStore((s) => s.activeId)
  const list = site.content.hotspots
  const i = list.findIndex((h) => h.id === id)
  if (i < 0) return null
  // one dock across stops: it slides in once, and only its contents change from stop to stop
  return <Story site={site} h={list[i]} i={i} />
}

function Story({ site, h, i }: { site: SiteDefinition; h: Hotspot; i: number }) {
  const min = useStore((s) => s.panelMin)
  const speech = useStore((s) => s.speech)
  const sentence = useStore((s) => s.sentence)
  const muted = useStore((s) => s.muted)
  const overview = useStore((s) => s.overview)
  const touch = useStore((s) => s.touch)
  const lang = useStore((s) => s.lang)
  const nearId = useStore((s) => s.nearId)
  const gliding = useStore((s) => s.gliding)
  const t = useT()
  const [photo, setPhoto] = useState(0)
  // walking on to another stop while this story is open: play tells that stop's story, and once
  // this one has finished (or is paused) the panel moves on to it by itself
  const here = nearId && nearId !== h.id && !gliding ? site.content.hotspots.find((x) => x.id === nearId) : undefined
  useEffect(() => {
    if (here && store.get().speech !== 'speaking') openHotspot(here.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [here?.id])
  // photos move on by themselves
  const [zoomedState, setZoomedState] = useState(false)
  useEffect(() => {
    if (h.photos.length < 2 || zoomedState) return
    const id = window.setInterval(() => setPhoto((k) => (k + 1) % h.photos.length), 5000)
    return () => window.clearInterval(id)
  }, [h.photos.length, zoomedState])
  const [zoomed, setZoomedRaw] = useState(false)
  const setZoomed = (v: boolean) => {
    setZoomedRaw(v)
    setZoomedState(v)
  }
  // a new stop starts on its first photo, unzoomed
  useEffect(() => {
    setPhoto(0)
    setZoomedRaw(false)
    setZoomedState(false)
  }, [h.id])
  // keep the spoken sentence in view, unless the visitor has just scrolled the text themselves
  const textRef = useRef<HTMLDivElement>(null)
  const scrolledAt = useRef(0)
  useEffect(() => {
    const box = textRef.current
    const now = box?.querySelector<HTMLElement>('.now')
    if (!box || !now || performance.now() - scrolledAt.current < 4000) return
    const top = now.offsetTop - box.offsetTop
    if (top < box.scrollTop + 8 || top + now.offsetHeight > box.scrollTop + box.clientHeight - 8) {
      box.scrollTo({ top: Math.max(0, top - box.clientHeight * 0.3), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    }
  }, [sentence, h.id])
  const list = site.content.hotspots
  const last = i === list.length - 1
  const title = tx(h.title, lang)
  // a second line in the local language (Odia), or in English when Odia is the main language
  const subtitle = lang === 'or' ? h.title.en : h.title.or
  const sentences = storySentences(title, tx(h.body, lang))
  const body = sentences.slice(1)
  const p = h.photos[photo]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && zoomed) {
        e.stopImmediatePropagation()
        setZoomed(false)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [zoomed])

  if (overview) return null

  const playButton =
    speech === 'speaking' ? (
      <button key="pause" className="ic play" onClick={pauseNarration} title={`${t('story.pause')} (P)`} aria-label={t('story.pause')}>
        <Icon d="M8 5v14M16 5v14" size={22} />
      </button>
    ) : (
      <button
        key="play"
        className="ic play"
        onClick={() => {
          if (muted) store.set({ muted: false })
          if (!store.get().narration) store.set({ narration: true })
          if (here) openHotspot(here.id)
          else resumeNarration()
        }}
        title={here ? `${t('story.play')}: ${tx(here.title, lang)}` : `${t('story.play')} (P)`}
        aria-label={t('story.play')}
      >
        <Icon d="M7 4l13 8-13 8z" size={22} />
      </button>
    )
  const status = muted
    ? t('story.status.muted')
    : speech === 'unavailable'
      ? t('story.status.unavailable')
      : speech === 'speaking'
        ? t('story.status.speaking')
        : speech === 'paused'
          ? t('story.status.paused')
          : speech === 'done'
            ? t('story.status.done')
            : ''
  // jump back (or ahead) to a sentence: from the track, or by clicking it in the text
  const seek = (k: number) => {
    if (muted) store.set({ muted: false })
    if (!store.get().narration) store.set({ narration: true })
    seekNarration(k)
  }
  const heard = speech === 'done' ? 1 : Math.max(0, (sentence + 1) / sentences.length)
  const said = (k: number) => (speech === 'done' ? 'said' : sentence === k ? 'now' : sentence > k ? 'said' : '')

  return (
    <>
      {/* docked to the right edge; the tab on its left hides it, leaving only the tab and the name */}
      <aside className={`story-dock${min ? ' min' : ''}${touch ? ' touch' : ''}`} aria-labelledby="story-title">
        <button
          className="story-tab"
          onClick={() => store.set({ panelMin: !min })}
          aria-expanded={!min}
          aria-label={min ? t('story.show') : t('story.hide')}
          title={`${min ? t('story.show') : t('story.hide')} (H)`}
        >
          <span className="tab-name">
            {/* how far the narration has got, round the wheel */}
            <span className="tab-ring" aria-hidden="true">
              <svg className="ring" viewBox="0 0 24 24" width={24} height={24}>
                <circle cx={12} cy={12} r={10.5} className="ring-bg" />
                <circle cx={12} cy={12} r={10.5} className="ring-fg" pathLength={1} strokeDasharray={`${heard} 1`} transform="rotate(-90 12 12)" />
              </svg>
              <Chakra size={14} className={speech === 'speaking' ? 'spinning' : ''} />
            </span>
            <span className="tab-title">
              {i + 1}. {title}
            </span>
            {/* the chevron runs on from the name, in the same place open or closed */}
            <span className={`tab-chev${min ? ' flip' : ''}`}>
              <Icon d="M9 5l7 7-7 7" size={16} />
            </span>
          </span>
        </button>
        <div className="story-panel" inert={min}>
          {p && (
            // photo and text each re-mount per stop (to play their settle-in), under keys of their own:
            // sharing the stop id as a key confused React into keeping the old photo and losing the text
            <figure key={`photo-${h.id}`} className="story-photo swap">
              <button className="photo-frame" onClick={() => setZoomed(true)} aria-label="Enlarge photo">
                {h.photos.map((ph, k) => (
                  <img key={ph.src} src={site.assetBase + ph.src} alt={tx(ph.caption, lang)} className={k === photo ? 'on' : ''} />
                ))}
              </button>
              {h.photos.length > 1 && (
                <div className="photo-dots" aria-hidden="true">
                  {h.photos.map((ph, k) => (
                    <span key={ph.src} className={k === photo ? 'on' : ''} />
                  ))}
                </div>
              )}
              <figcaption>
                {tx(p.caption, lang)}
                <span className="credit">
                  {t('story.photo')}:{' '}
                  <a href={p.source} target="_blank" rel="noreferrer">
                    {p.author}
                  </a>
                  ,{' '}
                  {p.licenceUrl ? (
                    <a href={p.licenceUrl} target="_blank" rel="noreferrer">
                      {p.licence}
                    </a>
                  ) : (
                    p.licence
                  )}
                  , via Wikimedia Commons (resized)
                </span>
              </figcaption>
            </figure>
          )}
          <div
            key={`text-${h.id}`}
            ref={textRef}
            className="story-text swap"
            onWheel={() => (scrolledAt.current = performance.now())}
            onTouchMove={() => (scrolledAt.current = performance.now())}
          >
            {(h.legend || h.tradition) && (
              <div className="story-badges">
                {h.legend && <span className="badge legend">{t('story.legend')}</span>}
                {h.tradition && <span className="badge tradition">{t('story.tradition')}</span>}
              </div>
            )}
            <h2 id="story-title" className={said(0) === 'now' && speech === 'speaking' ? 'now' : ''}>
              {title}
            </h2>
            {subtitle && subtitle !== title && (
              <p className="odia" lang={lang === 'or' ? 'en' : 'or'}>
                {subtitle}
              </p>
            )}
            <p className="card-body">
              {body.map((line, k) => (
                <span key={k} className={said(k + 1)} onClick={() => seek(k + 1)} title={t('story.seek')}>
                  {line}{' '}
                </span>
              ))}
            </p>
          </div>
          <div className="story-player" aria-live="polite">
            <button className="ic" onClick={() => goToStop(i - 1)} disabled={i === 0} title={t('story.prevStop')} aria-label={t('story.prevStop')}>
              <Icon d="M19 5l-9 7 9 7zM6 5v14" />
            </button>
            {playButton}
            <button className="ic" onClick={() => goToStop(i + 1)} title={last ? t('story.thenAndNow') : t('story.nextStop')} aria-label={last ? t('story.thenAndNow') : t('story.nextStop')}>
              <Icon d="M5 5l9 7-9 7zM18 5v14" />
            </button>
            {/* one segment per sentence: click one to hear it again from there */}
            <div className="player-track" title={status}>
              {sentences.map((line, k) => (
                <button key={k} className={`seg ${said(k)}${speech === 'speaking' ? ' live' : ''}`} onClick={() => seek(k)} aria-label={`${t('story.seek')}: ${line}`} title={line} />
              ))}
            </div>
            <span className="player-count" title={t('hud.stop', { n: i + 1, total: list.length })}>
              {i + 1} / {list.length}
            </span>
          </div>
        </div>
      </aside>
      {zoomed && p && (
        <div className="lightbox" role="dialog" aria-label={tx(p.caption, lang)} onClick={() => setZoomed(false)}>
          <img src={site.assetBase + p.src} alt={tx(p.caption, lang)} onClick={(e) => e.stopPropagation()} />
          {h.photos.length > 1 && (
            <>
              <button
                className="lb-arrow prev"
                aria-label="Previous photo"
                onClick={(e) => {
                  e.stopPropagation()
                  setPhoto((photo + h.photos.length - 1) % h.photos.length)
                }}
              >
                <Icon d="M15 5l-7 7 7 7" size={28} />
              </button>
              <button
                className="lb-arrow next"
                aria-label="Next photo"
                onClick={(e) => {
                  e.stopPropagation()
                  setPhoto((photo + 1) % h.photos.length)
                }}
              >
                <Icon d="M9 5l7 7-7 7" size={28} />
              </button>
              <span className="lb-count">
                {photo + 1} / {h.photos.length}
              </span>
            </>
          )}
          <p>
            {tx(p.caption, lang)}{' '}
            <span className="credit">
              {t('story.photo')}: {p.author}, {p.licence}
            </span>
          </p>
        </div>
      )}
    </>
  )
}

function EndScreen({ site }: { site: SiteDefinition }) {
  const show = useStore((s) => s.showEnd)
  const recon = useStore((s) => s.reconstruction)
  const gliding = useStore((s) => s.gliding)
  const lang = useStore((s) => s.lang)
  const t = useT()
  if (!show) return null
  const e = site.content.end
  return (
    <div className="card-wrap end">
      <article className="card pattern-border" role="dialog" aria-labelledby="end-title">
        <h2 id="end-title">{tx(e.title, lang)}</h2>
        <p className="card-body">{tx(e.body, lang)}</p>
        {recon && !gliding && <p className="recon-label">{t('end.reconLabel')}</p>}
        <div className="card-actions">
          <button className="primary" onClick={() => store.set({ reconstruction: !recon })}>
            {recon ? t('end.showToday') : t('end.showTower')}
          </button>
          <button
            onClick={() => {
              hideEnd()
              store.set({ mode: 'free', current: -1 })
            }}
          >
            {t('end.keepWalking')}
          </button>
          <button
            onClick={() => {
              hideEnd()
              openMap()
            }}
          >
            {t('end.seeMap')}
          </button>
          <button
            onClick={() => {
              hideEnd()
              store.set({ visited: [], current: -1 })
              goToStop(0)
            }}
          >
            {t('end.startAgain')}
          </button>
        </div>
      </article>
    </div>
  )
}

function useKeys(site: SiteDefinition) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = store.get()
      if (s.phase !== 'walk' || e.repeat) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'SELECT' || tag === 'INPUT') return
      switch (e.code) {
        case 'Escape':
          if (s.overview) closeMap()
          else if (s.activeId) closeCard()
          break
        case 'KeyE':
          if (s.nearId && s.nearId !== s.activeId && !s.gliding) openHotspot(s.nearId)
          else if (s.activeId) closeCard()
          break
        case 'KeyN':
          if (!s.gliding && !s.flying) goToStop()
          break
        case 'KeyM':
          if (s.overview) closeMap()
          else openMap()
          break
        case 'KeyV':
          store.set({ muted: !s.muted })
          break
        case 'KeyR':
          if (s.activeId) replayNarration()
          break
        case 'KeyP':
          if (s.activeId && s.speech === 'speaking') pauseNarration()
          else if (s.nearId && s.nearId !== s.activeId && !s.gliding) openHotspot(s.nearId)
          else if (s.activeId) resumeNarration()
          break
        case 'KeyH':
          if (s.activeId) store.set({ panelMin: !s.panelMin })
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [site])
}

/** Virtual joystick (left thumb) and drag-to-look (anywhere else). Hidden on the map. */
function TouchControls() {
  const touch = useStore((s) => s.touch)
  const overview = useStore((s) => s.overview || s.flying)
  const panelOpen = useStore((s) => !!s.activeId && !s.panelMin)
  const knob = useRef<HTMLDivElement>(null)
  const base = useRef<HTMLDivElement>(null)
  const ids = useRef<{ stick: number | null; look: number | null; lx: number; ly: number }>({ stick: null, look: null, lx: 0, ly: 0 })
  if (!touch || overview) return null
  const moveStick = (x: number, y: number) => {
    const r = base.current!.getBoundingClientRect()
    let dx = (x - (r.left + r.width / 2)) / (r.width / 2)
    let dy = (y - (r.top + r.height / 2)) / (r.height / 2)
    const l = Math.hypot(dx, dy)
    if (l > 1) {
      dx /= l
      dy /= l
    }
    commands.moveX = dx
    commands.moveY = -dy
    knob.current!.style.transform = `translate(${dx * 40}px, ${dy * 40}px)`
  }
  const release = (e: React.PointerEvent) => {
    if (e.pointerId === ids.current.stick) {
      ids.current.stick = null
      commands.moveX = commands.moveY = 0
      knob.current!.style.transform = ''
    }
    if (e.pointerId === ids.current.look) ids.current.look = null
  }
  return (
    <div
      className={`touch-layer${panelOpen ? ' panel-open' : ''}`}
      onPointerDown={(e) => {
        const onStick = (e.target as HTMLElement).closest('.stick')
        if (onStick && ids.current.stick === null) {
          ids.current.stick = e.pointerId
          moveStick(e.clientX, e.clientY)
        } else if (ids.current.look === null) {
          ids.current.look = e.pointerId
          ids.current.lx = e.clientX
          ids.current.ly = e.clientY
        }
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (e.pointerId === ids.current.stick) moveStick(e.clientX, e.clientY)
        else if (e.pointerId === ids.current.look) {
          commands.lookDX += e.clientX - ids.current.lx
          commands.lookDY += e.clientY - ids.current.ly
          ids.current.lx = e.clientX
          ids.current.ly = e.clientY
        }
      }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <div className="stick" ref={base}>
        <div className="stick-knob" ref={knob} />
      </div>
    </div>
  )
}
