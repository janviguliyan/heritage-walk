import { createPortal } from 'react-dom'
import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import './scroll.css'

// A parchment scroll on two turned wooden rollers, with patterned red bands down both
// sides (after the reference). It unrolls from the top roller, then its words appear.

export function Scroll({ children, width = 320, className = '', style, label, small = false }: { children: ReactNode; width?: number; className?: string; style?: CSSProperties; label?: string; small?: boolean }) {
  // the roller travels the scroll's full height: measured once, then animated with transforms only
  const el = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (el.current) el.current.style.setProperty('--travel', `${el.current.offsetHeight}px`)
  }, [])
  return (
    <div ref={el} className={`scroll${small ? ' small' : ''} ${className}`} style={{ width, ...style }} role={label ? 'dialog' : undefined} aria-label={label}>
      <div className="scroll-sheet">
        <div className="scroll-band left" aria-hidden="true" />
        <div className="scroll-content">{children}</div>
        <div className="scroll-band right" aria-hidden="true" />
      </div>
      <div className="scroll-rod top" aria-hidden="true" />
      <div className="scroll-rod bottom" aria-hidden="true" />
    </div>
  )
}

/**
 * A hover scroll pinned to a point on screen (the hovered marker): the top roller sits just
 * below the point and the scroll opens downward; near the bottom of the screen it opens
 * upward instead. Rendered into <body> so nothing in the scene can shift or clip it.
 */
export function HoverScroll({ x, y, children, width = 300, height = 260, label, small = false, onMouseEnter, onMouseLeave }: { x: number; y: number; children: ReactNode; width?: number; height?: number; label?: string; small?: boolean; onMouseEnter?: () => void; onMouseLeave?: () => void }) {
  // open downward if it fits below the point, else upward
  const below = y + 20 + height < window.innerHeight - 12 || y < height + 40
  const left = Math.min(window.innerWidth - width / 2 - 34, Math.max(width / 2 + 34, x))
  const gap = small ? 16 : 20
  const style: CSSProperties = below ? { left: left - width / 2, top: y + gap } : { left: left - width / 2, bottom: window.innerHeight - y + gap }
  return createPortal(
    <div className={`hover-scroll ${below ? 'down' : 'up'}${small ? ' passive' : ''}`} style={style} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <Scroll width={width} label={label} small={small}>
        {children}
      </Scroll>
    </div>,
    document.body,
  )
}

/** The gold cartouche button (notched, curled ends), dark ink text for contrast. */
export function GoldButton({ children, onClick, big = false, className = '', ...rest }: { children: ReactNode; onClick?: () => void; big?: boolean; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`gold-btn${big ? ' big' : ''} ${className}`} onClick={onClick} {...rest}>
      <span>{children}</span>
    </button>
  )
}
