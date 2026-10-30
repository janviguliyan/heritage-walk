import { useEffect, useRef } from 'react'

// Scroll that moves the visitor, not the page. Each gesture (one trackpad swipe with its
// momentum, a quick spin of the wheel, an arrow key, a swipe on touch) moves one step, and
// four steps reach the chamber; the camera follows with an eased catch-up (see `follow`).

export interface ScrollState {
  target: number
  current: number
  /** set once the visitor has interacted (wheel, key, touch, click) — audio may start */
  touched: boolean
}

const STEPS = 4
/** a pause this long between wheel events ends a gesture */
const GAP_MS = 200

export function useScrollDrive(max: number, enabled = true) {
  const s = useRef<ScrollState>({ target: 0, current: 0, touched: false })
  useEffect(() => {
    if (!enabled) return
    const st = s.current
    const step = max / STEPS
    // one step forward or back, landing on the next whole step
    const push = (dir: number) => {
      const at = Math.round(st.target / step)
      st.target = Math.min(max, Math.max(0, (at + dir) * step))
      st.touched = true
    }
    let last = 0
    let lastAbs = 0
    let startedAt = 0
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const now = performance.now()
      const d = e.deltaY
      const a = Math.abs(d)
      // a new gesture: after a pause, or a fresh swipe rising out of the last one's momentum
      const fresh = now - last > GAP_MS || (a > lastAbs * 1.8 && a > 12 && now - startedAt > 250)
      last = now
      lastAbs = a
      if (!fresh || a < 2) return
      startedAt = now
      push(Math.sign(d))
    }
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowDown', 'PageDown', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault()
        if (!e.repeat) push(1)
      } else if (['ArrowUp', 'PageUp', 'ArrowLeft'].includes(e.key)) {
        e.preventDefault()
        if (!e.repeat) push(-1)
      }
    }
    let startY: number | null = null
    let lastY = 0
    const onStart = (e: TouchEvent) => {
      startY = lastY = e.touches[0].clientY
      st.touched = true
    }
    const onMove = (e: TouchEvent) => {
      if (startY == null) return
      lastY = e.touches[0].clientY
      e.preventDefault()
    }
    const onEnd = () => {
      if (startY != null && Math.abs(startY - lastY) > 40) push(Math.sign(startY - lastY))
      startY = null
    }
    const onDown = () => (st.touched = true)
    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKey)
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [max, enabled])
  return s
}

/** the most the walk moves in a second: a step takes about a second at least, an unhurried pace */
const MAX_SPEED = 0.5

/** Ease `current` toward `target` (frame-rate independent), never faster than a walking pace;
 *  calmer when motion is reduced. */
export function follow(s: ScrollState, dt: number, reduced: boolean) {
  const k = 1 - Math.exp(-dt * (reduced ? 5 : 1.4))
  const gap = s.target - s.current
  const move = gap * k
  // a scroll step walks; a long jump (back to the start from the map) may hurry
  const cap = Math.abs(gap) > 0.6 ? MAX_SPEED * 2.5 : MAX_SPEED
  s.current += reduced ? move : Math.sign(move) * Math.min(Math.abs(move), cap * dt)
  if (Math.abs(s.target - s.current) < 1e-4) s.current = s.target
}
