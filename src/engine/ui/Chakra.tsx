/** Konark wheel icon: 8 major and 8 minor spokes. */
export function Chakra({ size = 24, className }: { size?: number; className?: string }) {
  const spokes = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2
    return (
      <line
        key={i}
        x1={12 + Math.cos(a) * 2.6}
        y1={12 + Math.sin(a) * 2.6}
        x2={12 + Math.cos(a) * 9}
        y2={12 + Math.sin(a) * 9}
        strokeWidth={i % 2 ? 0.6 : 1.4}
      />
    )
  })
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" aria-hidden="true">
      <circle cx="12" cy="12" r="10" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
      {spokes}
    </svg>
  )
}
