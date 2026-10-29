import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './loader.css'

// Loading as one big number: it counts to 100 with the real progress (a hairline beneath fills
// with it), then the whole sheet lifts away like a curtain to show the page.

const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function Loader({ done, stage = 0, stages = 1, label, status }: { done: boolean; stage?: number; stages?: number; label?: string; status?: string }) {
  // skip the whole thing if everything was ready from the start
  const [gone, setGone] = useState(done)
  const [out, setOut] = useState(false)
  const [p, setP] = useState(0)
  const pr = useRef(0)
  const t0 = useRef(performance.now())
  useEffect(() => {
    if (gone) return
    let id = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000))
      last = now
      // each stage fills its share; within a stage the count creeps on so it never looks stuck
      const cap = done ? 1 : Math.min(0.96, (stage + 0.92) / stages)
      // the count is seen to run, even on a fast load
      const long = (now - t0.current) / 1000 > (reduced ? 0 : 1.4)
      const target = done && !long ? 0.9 : cap
      pr.current += (target - pr.current) * (1 - Math.exp(-dt * (done ? 3 : 0.6)))
      if (done && long && pr.current > 0.995) pr.current = 1
      setP(pr.current)
      if (pr.current >= 1) {
        window.setTimeout(() => setOut(true), reduced ? 0 : 250)
        window.setTimeout(() => setGone(true), reduced ? 0 : 1300)
        return
      }
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [done, stage, stages, gone])
  if (gone) return null
  const n = Math.round(p * 100)
  // straight into the body, so it covers every control on the page whatever layer it sits in
  return createPortal(
    <div className={`ld${out ? ' out' : ''}`} role="status" aria-live="polite" aria-busy={!out} aria-label={`${n}%`}>
      {label && <p className="ld-label">{label}</p>}
      {status && <p className="ld-status">{status}</p>}
      <div className="ld-count" aria-hidden="true">
        {n}
        <span>%</span>
      </div>
      <div className="ld-line" aria-hidden="true">
        <i style={{ transform: `scaleX(${p})` }} />
      </div>
    </div>,
    document.body,
  )
}
