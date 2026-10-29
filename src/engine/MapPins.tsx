import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { tx, type SiteContent } from './content'
import { live, store, useStore } from './store'
import { flyToStop } from './actions'
import { Chakra } from '../journey/motifs'
import { declutter, easeTo, type Pt as XY } from '../ui/declutter'
import '../journey/overview.css'

// Labels over the aerial map: numbered stops (click to fly there), landmarks, and you.
// The canvas only projects points to the screen; the labels are ordinary DOM outside it,
// moved each frame by `translate` (no React renders, no nested React roots).

type Pt = { x: number; y: number; on: boolean }
const points = new Map<string, Pt>()

/** Inside the canvas: write each label's screen position. */
export function MapPinsProjector({ content }: { content: SiteContent }) {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const v = new THREE.Vector3()
  useFrame(() => {
    const put = (key: string, p: readonly number[] | THREE.Vector3) => {
      if (p instanceof THREE.Vector3) v.copy(p)
      else v.set(p[0], p[1], p[2])
      v.project(camera)
      points.set(key, { x: (v.x * 0.5 + 0.5) * size.width, y: (-v.y * 0.5 + 0.5) * size.height, on: v.z < 1 })
    }
    content.hotspots.forEach((h, i) => put(`s${i}`, [h.position[0], h.position[1] + 0.6, h.position[2]]))
    content.landmarks.forEach((l, i) => put(`l${i}`, l.position))
    put('me', [live.x, live.y + 2, live.z])
  })
  return null
}

function hoverAt(i: number, el: HTMLElement) {
  const r = el.getBoundingClientRect()
  store.set({ hoverStop: { i, x: r.left + r.width / 2, y: r.top + r.height / 2 } })
}
function unhover(i: number) {
  if (store.get().hoverStop?.i === i) store.set({ hoverStop: null })
}

/** Outside the canvas: the labels themselves. */
export function MapPins({ content }: { content: SiteContent }) {
  const overview = useStore((s) => s.overview)
  const flying = useStore((s) => s.flying)
  const visited = useStore((s) => s.visited)
  const phase = useStore((s) => s.phase)
  const lang = useStore((s) => s.lang)
  const root = useRef<HTMLDivElement>(null)
  const ready = useStore((s) => s.sceneReady)
  const show = overview && !flying && ready
  useEffect(() => {
    if (!show) return
    let id = 0
    let drawn: XY[] = []
    const tick = () => {
      // stop wheels that would overlap fan out around their group
      const stops = content.hotspots.map((_, i) => points.get(`s${i}`) ?? { x: -999, y: -999, on: false })
      drawn = easeTo(drawn, declutter(stops, 36, (i) => !stops[i].on), 0.2)
      root.current?.querySelectorAll<HTMLElement>('[data-pt]').forEach((el) => {
        const key = el.dataset.pt!
        const p = points.get(key)
        if (!p) return
        const d = key[0] === 's' ? drawn[Number(key.slice(1))] : p
        el.style.translate = `${d.x}px ${d.y}px`
        el.style.visibility = p.on ? 'visible' : 'hidden'
      })
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [show, content])
  if (!show) return null
  return (
    <div ref={root} className="map-pins">
      {content.landmarks.map((l, i) => (
        <span key={l.name.en} data-pt={`l${i}`} className="map-landmark" style={{ visibility: 'hidden' }}>
          {tx(l.name, lang)}
        </span>
      ))}
      {content.hotspots.map((h, i) => (
        <button
          key={h.id}
          data-pt={`s${i}`}
          style={{ visibility: 'hidden', ['--i' as string]: i }}
          className={`wheel-pin${visited.includes(h.id) ? ' visited' : ''}`}
          onClick={() => {
            if (store.get().screen === 'overview') store.set({ screen: 'tour', hoverStop: null })
            flyToStop(i)
          }}
          onMouseEnter={(e) => hoverAt(i, e.currentTarget)}
          onMouseLeave={() => unhover(i)}
          onFocus={(e) => hoverAt(i, e.currentTarget)}
          onBlur={() => unhover(i)}
          aria-label={`${i + 1}. ${tx(h.title, lang)}`}
        >
          <Chakra size={26} />
          <span className="num">{i + 1}</span>
        </button>
      ))}
      {phase === 'walk' && (
        <span data-pt="me" className="map-me" style={{ visibility: 'hidden' }}>
          You are here
        </span>
      )}
    </div>
  )
}
