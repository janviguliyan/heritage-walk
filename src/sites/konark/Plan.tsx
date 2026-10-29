import { useState } from 'react'
import { LAYOUT } from './layout'
import type { SitePlanProps } from '../../engine/site'
import { tx } from '../../engine/content'
import { useT } from '../../i18n'

// Hand-drawn plan of the Konark complex, in the manner of an architect's sketch on old
// paper: ink outlines, hatched walls, wheels as little chakras. 1 unit = 1 m, north up,
// east to the right (the entrance). Stops sit where their markers are in the 3D walk.

const L = LAYOUT
const PLAN_LABELS = [
  { key: 'gate', x: 108, y: -14, en: 'East gate', hi: 'पूर्वी द्वार', or: 'ପୂର୍ବ ଦ୍ୱାର' },
  { key: 'nata', x: 46, y: -19, en: 'Nata mandir', hi: 'नाट मंदिर', or: 'ନାଟ ମନ୍ଦିର' },
  { key: 'jaga', x: -5, y: -25, en: 'Jagamohana', hi: 'जगमोहन', or: 'ଜଗମୋହନ' },
  { key: 'deul', x: -42, y: -25, en: 'Deul', hi: 'देउल', or: 'ଦେଉଳ' },
  { key: 'maya', x: -75, y: 60, en: 'Mayadevi', hi: 'मायादेवी', or: 'ମାୟାଦେବୀ' },
]

function rand(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
}

function Trees() {
  const r = rand(11)
  const out = []
  const E = L.enclosure
  for (let i = 0; i < 120; i++) {
    const x = (r() - 0.5) * 300
    const y = (r() - 0.5) * 230
    if (x > E.x0 - 6 && x < E.x1 + 6 && y > E.z0 - 6 && y < E.z1 + 6) continue
    if (x > E.x1 && Math.abs(y) < 14) continue
    const s = 2.2 + r() * 1.6
    out.push(
      <g key={i} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`} className="tree">
        <path d={`M${-s} ${s * 0.2} a${s * 0.55} ${s * 0.55} 0 0 1 ${s * 0.5} ${-s * 0.9} a${s * 0.6} ${s * 0.6} 0 0 1 ${s} ${-s * 0.1} a${s * 0.55} ${s * 0.55} 0 0 1 ${s * 0.45} ${s * 0.9} a${s * 0.5} ${s * 0.5} 0 0 1 ${-s * 0.9} ${s * 0.45} a${s * 0.5} ${s * 0.5} 0 0 1 ${-s * 1.05} ${-s * 0.35} z`} />
        <circle r={s * 0.18} className="trunk" />
      </g>,
    )
  }
  return <g>{out}</g>
}

function Wheel({ x, y }: { x: number; y: number }) {
  const spokes = []
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    spokes.push(<line key={i} x1={x} y1={y} x2={x + Math.cos(a) * 1.4} y2={y + Math.sin(a) * 1.4} />)
  }
  return (
    <g className="wheel">
      <circle cx={x} cy={y} r="1.6" />
      {spokes}
    </g>
  )
}

function Stairs({ x, y, w, h, dir }: { x: number; y: number; w: number; h: number; dir: 'x' | 'y' }) {
  const lines = []
  const n = 7
  for (let i = 1; i < n; i++) {
    if (dir === 'x') lines.push(<line key={i} x1={x + (w * i) / n} y1={y} x2={x + (w * i) / n} y2={y + h} />)
    else lines.push(<line key={i} x1={x} y1={y + (h * i) / n} x2={x + w} y2={y + (h * i) / n} />)
  }
  return (
    <g className="stairs">
      <rect x={x} y={y} width={w} height={h} />
      {lines}
    </g>
  )
}

export function KonarkPlan({ hotspots, lang, onSpot }: SitePlanProps) {
  const t = useT()
  const [hover, setHover] = useState<number | null>(null)
  const E = L.enclosure
  const C = L.chariot
  const N = L.nataMandir
  const J = L.jagamohana
  const D = L.deul
  const M = L.mayadevi
  const wheelsX = [10, 6, 2, ...Array.from({ length: 9 }, (_, i) => -11.5 - i * 6)]
  const pillars = []
  for (const px of [-9, -3, 3, 9]) for (const pz of [-9, -3, 3, 9]) pillars.push(<rect key={`${px}${pz}`} x={N.x + px - 0.8} y={pz - 0.8} width="1.6" height="1.6" className="solid" />)
  const h = hover != null ? hotspots[hover] : null

  return (
    <div className="plan-wrap">
      <svg className="plan-svg" viewBox="-118 -100 240 200" role="img" aria-label={tx({ en: 'Plan of the Konark temple complex', hi: 'कोणार्क मंदिर परिसर का नक्शा', or: 'କୋଣାର୍କ ମନ୍ଦିର ପରିସରର ନକ୍ସା' }, lang)}>
        <g filter="url(#ink-wobble)" className="plan-ink">
          <Trees />
          {/* lawns */}
          <rect x={E.x0 + 3} y={E.z0 + 3} width={E.x1 - E.x0 - 6} height={46} className="lawn" />
          <rect x={E.x0 + 3} y={E.z1 - 49} width={E.x1 - E.x0 - 6} height={46} className="lawn" />
          {/* enclosure wall with gates */}
          <path className="wall" d={`M${E.x1} -5 V${E.z0} H4 M-4 ${E.z0} H${E.x0} V${E.z1} H-4 M4 ${E.z1} H${E.x1} V5`} />
          <path className="wall thin" d={`M${E.x1 - 1.6} -5 V${E.z0 + 1.6} H4 M-4 ${E.z0 + 1.6} H${E.x0 + 1.6} V${E.z1 - 1.6} H-4 M4 ${E.z1 - 1.6} H${E.x1 - 1.6} V5`} />
          {[-7.5, 7.5].map((z) => (
            <rect key={z} x={E.x1 - 2.5} y={z - 2.5} width="5" height="5" className="poche" />
          ))}
          {/* approach path */}
          <path className="path" d={`M${E.x1 + 30} -3 H${N.x + 20} M${E.x1 + 30} 3 H${N.x + 20}`} />
          {/* nata mandir */}
          <rect x={N.x - N.size / 2} y={-N.size / 2} width={N.size} height={N.size} className="plinth" />
          <rect x={N.x - N.size / 2 + 1.2} y={-N.size / 2 + 1.2} width={N.size - 2.4} height={N.size - 2.4} className="thin" />
          {pillars}
          <Stairs x={N.x + N.size / 2} y={-4} w={8} h={8} dir="x" />
          <Stairs x={N.x - N.size / 2 - 8} y={-4} w={8} h={8} dir="x" />
          {[-7.5, 7.5].map((z) => (
            <rect key={z} x={N.x + N.size / 2 + 8.5} y={z - 1.1} width="4" height="2.2" className="solid" />
          ))}
          {/* chariot plinth with its wheels */}
          <rect x={C.x0} y={-C.half} width={C.x1 - C.x0} height={C.half * 2} className="plinth" />
          <rect x={C.x0 + 1.2} y={-C.half + 1.2} width={C.x1 - C.x0 - 2.4} height={C.half * 2 - 2.4} className="thin" />
          {wheelsX.map((x) => (
            <g key={x}>
              <Wheel x={x} y={C.half + 1.8} />
              <Wheel x={x} y={-C.half - 1.8} />
            </g>
          ))}
          <Stairs x={C.x1} y={-4.5} w={8} h={9} dir="x" />
          <Stairs x={C.x0 - 8} y={-4} w={8} h={8} dir="x" />
          <Stairs x={J.x - 3.5} y={C.half} w={7} h={8} dir="y" />
          <Stairs x={J.x - 3.5} y={-C.half - 8} w={7} h={8} dir="y" />
          {/* horses */}
          {[-16, -12, -8, 8, 12, 16, 20].map((z) => (
            <ellipse key={z} cx={C.x1 + 5} cy={z} rx="2" ry="0.9" className="solid soft" />
          ))}
          {/* jagamohana: square hall, pidha roof tiers in plan, amalaka at the crown */}
          {[0, 3.5, 7, 10, 12.4].map((inset, i) => (
            <rect key={i} x={J.x - J.w / 2 + inset} y={-J.w / 2 + inset} width={J.w - inset * 2} height={J.w - inset * 2} className={i === 0 ? 'hall' : 'thin'} />
          ))}
          <circle cx={J.x} cy={0} r="1.8" className="thin" />
          {/* deul: thick hatched walls, three niches */}
          <rect x={D.x - D.w / 2} y={-D.w / 2} width={D.w} height={D.w} className="hatch" />
          <rect x={D.x - D.w / 2 + 4} y={-D.w / 2 + 4} width={D.w - 8} height={D.w - 8} className="paperfill" />
          {[
            [D.x, D.w / 2 + 0.8],
            [D.x, -D.w / 2 - 0.8],
            [D.x - D.w / 2 - 0.8, 0],
          ].map(([x, y]) => (
            <rect key={`${x}${y}`} x={x - 2} y={y - 1} width="4" height="2" className="solid" />
          ))}
          {/* mayadevi temple */}
          <rect x={M.x - 6.5} y={M.z - 6.5} width="13" height="13" className="plinth" />
          <rect x={M.x - 4.5} y={M.z - 4.5} width="9" height="9" className="hatch" />
          <rect x={M.x + 6.5} y={M.z - 4.5} width="9" height="9" className="thin" />
        </g>

        {PLAN_LABELS.map((l) => (
          <text key={l.key} x={l.x} y={l.y} className="plan-label" textAnchor="middle" lang={lang}>
            {tx({ en: l.en, hi: l.hi, or: l.or }, lang)}
          </text>
        ))}

        {/* north arrow and scale */}
        <g className="plan-north" transform="translate(-104 -84)">
          <path d="M0 8 L3 -6 L6 8 L3 5 Z" />
          <text x="3" y="-9" textAnchor="middle">N</text>
        </g>
        <g className="plan-scale" transform="translate(-104 88)">
          <path d="M0 0 H50 M0 -2 V2 M25 -1.5 V1.5 M50 -2 V2" />
          <text x="0" y="-4">0</text>
          <text x="50" y="-4" textAnchor="middle">50 m</text>
        </g>

        {/* the stops */}
        {hotspots.map((hs, i) => (
          <g
            key={hs.id}
            className={`spot${hover === i ? ' hot' : ''}`}
            transform={`translate(${hs.position[0]} ${hs.position[2]})`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover((v) => (v === i ? null : v))}
            onFocus={() => setHover(i)}
            onBlur={() => setHover((v) => (v === i ? null : v))}
            onClick={() => onSpot(i)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSpot(i)}
            role="button"
            tabIndex={0}
            aria-label={`${i + 1}. ${tx(hs.title, lang)}`}
          >
            <circle r="4.6" className="spot-ring" />
            <circle r="3.4" className="spot-dot" />
            <text y="1.4" textAnchor="middle" className="spot-num">
              {i + 1}
            </text>
          </g>
        ))}
      </svg>
      {h && hover != null && (
        <div className="spot-tip" style={{ left: `${((h.position[0] + 118) / 240) * 100}%`, top: `${((h.position[2] + 100) / 200) * 100}%` }} lang={lang}>
          <strong>
            {hover + 1}. {tx(h.title, lang)}
          </strong>
          <span>{t('site.goThere')} →</span>
        </div>
      )}
    </div>
  )
}
