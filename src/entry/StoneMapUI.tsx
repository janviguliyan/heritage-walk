import { useEffect, useState } from 'react'
import { PLACES } from '../world/places'
import { tx } from '../engine/content'
import { store, useStore } from '../engine/store'
import { useT } from '../i18n'
import { mapState } from './mapState'
import { MuteButton } from './MuteButton'
import { HoverScroll } from '../ui/Scroll'
import './map.css'
import { LanguageMenu } from '../journey/LanguageSwitcher'

// DOM layer over the carved stone map: language menu, sound, and the one live site (Konark):
// a steady hotspot over its carved wheel, a card on hover, and click → zoom into the stone.

export function StoneMapUI() {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const touch = useStore((s) => s.touch)
  const konark = PLACES.find((p) => p.status === 'live')!
  const [pos, setPos] = useState<{ x: number; y: number; r: number } | null>(null)
  const [ready, setReady] = useState(false)
  const [card, setCard] = useState(false)
  const [i, setI] = useState(0)
  const [leaving, setLeaving] = useState(false)
  // follow the carved wheel on screen (steady: only moves if the camera does)
  useEffect(() => {
    let id = 0
    const tick = () => {
      const k = mapState.konark
      if (k) setPos((p) => (p && Math.abs(p.x - k.x) < 0.5 && Math.abs(p.y - k.y) < 0.5 ? p : { ...k }))
      setReady(mapState.progress > 0.97)
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [])
  useEffect(() => {
    if (!card) return
    const id = window.setInterval(() => setI((k) => (k + 1) % konark.photos.length), 1500)
    return () => window.clearInterval(id)
  }, [card, konark])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !leaving && (card ? setCard(false) : store.set({ screen: 'entry' }))
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [card, leaving])
  const show = () => setCard(true)
  const hide = () => setCard(false)
  const enter = () => {
    if (leaving) return
    setCard(false)
    setLeaving(true)
    // the story of Konark plays first (once per session); then India is smoothed from the
    // stone, Konark is carved in its place and rises (CarvedSlab)
    store.set({ screen: 'story' })
  }
  const r = Math.max(30, pos?.r ?? 30)
  const p = konark.photos[i]
  return (
    <div className={`stone-ui${leaving ? ' leaving' : ''}`}>
      <div className="map-top">
        <button
          className="home-btn"
          onClick={() => {
            mapState.home = true
            store.set({ screen: 'entry' })
          }}
          aria-label={t('map.home')}
          title={t('map.home')}
        >
          ← {t('map.home')}
        </button>
        <LanguageMenu />
      </div>
      <MuteButton />
      {pos && ready && !leaving && (
        <div className="konark-hot" style={{ left: pos.x - r, top: pos.y - r, width: r * 2, height: r * 2 }} onMouseEnter={() => !touch && show()} onMouseLeave={() => !touch && hide()}>
          <button className="konark-hot-btn" aria-label={tx(konark.name, lang)} onFocus={show} onBlur={hide} onClick={() => (touch && !card ? show() : enter())}>
            <span className="konark-ring" aria-hidden="true" />
            <span className="konark-ring two" aria-hidden="true" />
          </button>
        </div>
      )}
      {pos && card && !leaving && (
        <HoverScroll small x={pos.x} y={pos.y + r * 0.6} width={260} height={315} label={tx(konark.name, lang)}>
          <div className="photo small">
            {konark.photos.map((ph, k) => (
              <img key={ph.src} src={ph.src} alt="" className={k === i ? 'on' : ''} />
            ))}
          </div>
          <p className="meta" lang={lang}>
            {tx(konark.stateName, lang)}
          </p>
          <h3 lang={lang}>{tx(konark.name, lang)}</h3>
          <p className="line" lang={lang}>
            {tx(konark.hook, lang)}
          </p>
          <p className="go">{touch ? t('map.tapEnter') : t('map.clickToEnter')}</p>
          <p className="credit">
            {t('story.photo')}: {p.author.split('\n')[0]}, {p.licence}
          </p>
        </HoverScroll>
      )}
      <p className="music-credit">
        {t('india.boundary')} · {t('map.musicCredit')}
      </p>
      <div className={`stone-fade${leaving ? ' on' : ''}`} />
    </div>
  )
}
