// Indian motifs, drawn as ink line-work so they sit on the paper like the rest of the map.
// Recreated from traditional forms: the Konark chakra, the lotus (padma), the paisley
// (kalka / buta), the creeper (lata) borders of Odisha pattachitra, kolam dot-loops,
// and a rekha temple silhouette for marking places.

import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }

const ink = 'currentColor'

/** Shared SVG defs: hand-drawn wobble for ink lines and a paper grain. Mount once. */
export function InkDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <filter id="ink-wobble" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="ink-bleed" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="3" result="g" />
          <feDisplacementMap in="SourceGraphic" in2="g" scale="1.2" result="d" />
          <feGaussianBlur in="d" stdDeviation="0.25" />
        </filter>
        <pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <line x1="0" y1="0" x2="0" y2="5" stroke="#5b3a1e" strokeWidth="0.7" opacity="0.55" />
        </pattern>
        <pattern id="hatch-fine" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(-40)">
          <line x1="0" y1="0" x2="0" y2="3" stroke="#5b3a1e" strokeWidth="0.45" opacity="0.5" />
        </pattern>
        <pattern id="waves" width="34" height="14" patternUnits="userSpaceOnUse">
          <path d="M2 8 q4 -4 8 0 t8 0" fill="none" stroke="#6b5a45" strokeWidth="0.8" opacity="0.35" />
          <path d="M19 3 q3 -3 6 0" fill="none" stroke="#6b5a45" strokeWidth="0.7" opacity="0.25" />
        </pattern>
      </defs>
    </svg>
  )
}

export function Chakra({ size = 24, ...p }: P) {
  const spokes = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2
    return <line key={i} x1={12 + Math.cos(a) * 2.6} y1={12 + Math.sin(a) * 2.6} x2={12 + Math.cos(a) * 9} y2={12 + Math.sin(a) * 9} strokeWidth={i % 2 ? 0.6 : 1.3} />
  })
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={ink} aria-hidden="true" {...p}>
      <circle cx="12" cy="12" r="10.2" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="8.9" strokeWidth="0.5" />
      <circle cx="12" cy="12" r="2.3" fill={ink} stroke="none" />
      {spokes}
    </svg>
  )
}

/** Eight-petal lotus, seen from above. */
export function Lotus({ size = 40, ...p }: P) {
  const petals = Array.from({ length: 8 }, (_, i) => (
    <path key={i} d="M20 20 C 16 13, 17 6, 20 3 C 23 6, 24 13, 20 20 Z" transform={`rotate(${i * 45} 20 20)`} />
  ))
  const inner = Array.from({ length: 8 }, (_, i) => (
    <path key={i} d="M20 20 C 18 16, 18.5 12, 20 10 C 21.5 12, 22 16, 20 20 Z" transform={`rotate(${i * 45 + 22.5} 20 20)`} />
  ))
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" stroke={ink} strokeWidth="0.9" aria-hidden="true" {...p}>
      {petals}
      {inner}
      <circle cx="20" cy="20" r="2.6" fill={ink} stroke="none" />
    </svg>
  )
}

/** Paisley (kalka) with an inner echo and dotted edge. */
export function Paisley({ size = 40, ...p }: P) {
  const dots = Array.from({ length: 11 }, (_, i) => {
    const t = i / 10
    const a = Math.PI * 0.15 + t * Math.PI * 1.55
    return <circle key={i} cx={20 + Math.cos(a) * 15.5} cy={24 + Math.sin(a) * 12.5} r="0.9" fill={ink} stroke="none" />
  })
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" stroke={ink} strokeWidth="1" aria-hidden="true" {...p}>
      <path d="M30 6 C 24 8, 8 14, 8 26 C 8 34, 18 37, 24 33 C 31 28, 30 18, 22 18 C 17 18, 16 24, 20 25" />
      <path d="M26 11 C 20 13, 12 18, 12 26 C 12 31, 18 33, 22 30" strokeWidth="0.6" />
      {dots}
    </svg>
  )
}

/** Rekha temple silhouette with kalasha, for marking heritage places on the map. */
export function TempleMark({ size = 28, ...p }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" stroke={ink} strokeWidth="1.1" aria-hidden="true" {...p}>
      <path d="M14 1.5 v2.5" />
      <path d="M12.6 5.4 h2.8 M12 6.4 c0 -1 4 -1 4 0 c0 1 -4 1 -4 0" />
      <path d="M9 25 C 9 17, 10.5 11, 14 7.2 C 17.5 11, 19 17, 19 25" fill="var(--wash, transparent)" />
      <path d="M10.3 15 h7.4 M9.6 19 h8.8 M9.2 22.5 h9.6" strokeWidth="0.6" />
      <path d="M5 25 h18 M6 27 h16" />
    </svg>
  )
}

/** Compass rose with a lotus heart and N/E/S/W. */
export function CompassRose({ size = 120, ...p }: P) {
  const pts = [0, 90, 180, 270].map((a) => (
    <g key={a} transform={`rotate(${a} 60 60)`}>
      <path d="M60 8 L65 55 L60 60 L55 55 Z" fill={a === 0 ? ink : 'none'} />
    </g>
  ))
  const minor = [45, 135, 225, 315].map((a) => (
    <g key={a} transform={`rotate(${a} 60 60)`}>
      <path d="M60 24 L63 56 L60 60 L57 56 Z" />
    </g>
  ))
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" stroke={ink} strokeWidth="0.9" aria-hidden="true" {...p}>
      <circle cx="60" cy="60" r="40" strokeWidth="0.5" strokeDasharray="1.5 2.5" />
      <circle cx="60" cy="60" r="46" strokeWidth="0.6" />
      {minor}
      {pts}
      <circle cx="60" cy="60" r="7" fill="var(--paper, #ecd9b4)" />
      {Array.from({ length: 8 }, (_, i) => (
        <path key={i} d="M60 60 C 58.5 57, 59 54.5, 60 53.5 C 61 54.5, 61.5 57, 60 60 Z" transform={`rotate(${i * 45} 60 60)`} strokeWidth="0.6" />
      ))}
      <text x="60" y="4.5" textAnchor="middle" fontSize="9" fill={ink} stroke="none" fontFamily="var(--hand)">N</text>
      <text x="117" y="63" textAnchor="middle" fontSize="8" fill={ink} stroke="none" fontFamily="var(--hand)">E</text>
      <text x="60" y="119" textAnchor="middle" fontSize="8" fill={ink} stroke="none" fontFamily="var(--hand)">S</text>
      <text x="3" y="63" textAnchor="middle" fontSize="8" fill={ink} stroke="none" fontFamily="var(--hand)">W</text>
    </svg>
  )
}

/** Kolam corner: dots with a looping line, for page corners. */
export function KolamCorner({ size = 64, ...p }: P) {
  const dots = []
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3 - r; c++) dots.push(<circle key={`${r}-${c}`} cx={10 + c * 14} cy={10 + r * 14} r="1.3" fill={ink} stroke="none" />)
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" fill="none" stroke={ink} strokeWidth="0.9" aria-hidden="true" {...p}>
      {dots}
      <path d="M3 17 C 3 3, 17 3, 17 10 C 17 17, 3 17, 3 24 C 3 31, 17 31, 17 24 C 17 17, 31 17, 31 10 C 31 3, 45 3, 45 10 C 45 17, 31 17, 31 24 C 31 31, 17 31, 17 38 C 17 45, 3 45, 3 38" />
      <path d="M2 56 L2 2 L56 2" strokeWidth="1.3" />
      <path d="M6 56 L6 6 L56 6" strokeWidth="0.5" />
    </svg>
  )
}

/** Pattachitra-style creeper (lata) border: a running vine with leaves and buds. Tiles horizontally. */
export function VineBorder({ width = 600, height = 22, ...p }: SVGProps<SVGSVGElement> & { width?: number; height?: number }) {
  const unit = 44
  const n = Math.ceil(width / unit)
  const parts = []
  for (let i = 0; i < n; i++) {
    const x = i * unit
    parts.push(
      <g key={i}>
        <path d={`M${x} 11 C ${x + 11} 2, ${x + 22} 2, ${x + 22} 11 S ${x + 33} 20, ${x + 44} 11`} />
        <path d={`M${x + 11} 6 c -3 -5 2 -6 4 -4 c 1 2 -2 4 -4 4 z`} fill={ink} fillOpacity="0.35" />
        <path d={`M${x + 33} 16 c 3 5 -2 6 -4 4 c -1 -2 2 -4 4 -4 z`} fill={ink} fillOpacity="0.35" />
        <circle cx={x + 22} cy={11} r="1.6" fill={ink} stroke="none" />
      </g>,
    )
  }
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} 22`} preserveAspectRatio="none" fill="none" stroke={ink} strokeWidth="0.9" aria-hidden="true" {...p}>
      <path d={`M0 1 H${width} M0 21 H${width}`} strokeWidth="0.6" />
      {parts}
    </svg>
  )
}
