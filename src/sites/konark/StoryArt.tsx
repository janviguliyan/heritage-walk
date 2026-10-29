// Ink illustrations for the Konark prologue. Each path draws itself in (CSS stroke
// animation on .draw), so the scene appears like a sketch being made.

function Waves({ y, w = 400 }: { y: number; w?: number }) {
  const d = []
  for (let row = 0; row < 3; row++) {
    for (let x = row * 9; x < w; x += 26) d.push(`M${x} ${y + row * 9} q6 -5 12 0`)
  }
  return <path className="draw thin" d={d.join(' ')} />
}

/** Konark seen from the south: chariot plinth with wheels, the jagamohana's stepped roof, the ruined deul. */
export function KonarkElevation({ tower = false }: { tower?: boolean }) {
  const wheels = []
  for (let i = 0; i < 9; i++) {
    const cx = 92 + i * 24
    wheels.push(
      <g key={i}>
        <circle className="draw" cx={cx} cy={206} r="9" />
        <circle className="draw thin" cx={cx} cy={206} r="2" />
        <path className="draw thin" d={`M${cx - 9} 206 H${cx + 9} M${cx} 197 V215 M${cx - 6.4} 199.6 L${cx + 6.4} 212.4 M${cx + 6.4} 199.6 L${cx - 6.4} 212.4`} />
      </g>,
    )
  }
  const tiers = []
  let w = 104
  let y = 150
  for (let i = 0; i < 11; i++) {
    tiers.push(<path key={i} className="draw" d={`M${248 - w / 2} ${y} H${248 + w / 2} L${248 + w / 2 - 3} ${y - 5} H${248 - w / 2 + 3} Z`} />)
    y -= 6.5
    w -= i === 3 || i === 7 ? 12 : 6
  }
  return (
    <g>
      <path className="draw" d="M40 222 H372" />
      {/* plinth */}
      <path className="draw" d="M70 222 V190 H330 V222 M70 196 H330 M74 202 H326" />
      <rect x="74" y="203" width="252" height="17" fill="url(#hatch-fine)" className="fade" />
      {wheels}
      {/* jagamohana */}
      <path className="draw" d="M196 190 V152 H300 V190 M200 160 H296 M232 190 V166 H264 V190" />
      <rect x="236" y="168" width="24" height="22" fill="url(#hatch)" className="fade" />
      {tiers}
      <path className="draw" d="M240 82 h16 M242 82 q6 -8 12 0 M248 74 v-6 M246 66 q2 -5 4 0" />
      {/* deul: ruined, or as it may have stood */}
      {tower ? (
        <path className="draw dashed" d="M84 190 V128 C 86 90, 100 52, 124 32 C 148 52, 162 90, 164 128 V190 M116 32 h16 M118 32 q6 -8 12 0 M124 24 v-8" />
      ) : (
        <path className="draw" d="M84 190 V150 L92 146 L96 156 L108 140 L118 152 L128 138 L140 150 L152 142 L164 152 V190" />
      )}
      <rect x="88" y="156" width="74" height="34" fill="url(#hatch)" className="fade" />
      {/* horses at the east steps */}
      {[0, 1, 2].map((i) => (
        <path key={i} className="draw" d={`M${334 + i * 11} 190 l2 -12 c4 -6 9 -6 10 -1 l-3 3 l2 5 l-3 1 l-2 -3 l-2 7 z`} />
      ))}
    </g>
  )
}

function Sun({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const rays = []
  for (let i = 0; i < 13; i++) {
    const a = Math.PI + (i / 12) * Math.PI
    rays.push(`M${cx + Math.cos(a) * (r + 6)} ${cy + Math.sin(a) * (r + 6)} L${cx + Math.cos(a) * (r + 18)} ${cy + Math.sin(a) * (r + 18)}`)
  }
  return (
    <g>
      <path className="draw sun" d={`M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy}`} />
      <path className="draw thin sun" d={rays.join(' ')} />
    </g>
  )
}

function Horse({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <path
      className="draw"
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 0 C 4 -10, 12 -14, 20 -12 L 26 -22 C 28 -26, 34 -26, 36 -22 L 40 -16 L 36 -14 L 32 -18 L 30 -10 C 34 -4, 32 4, 28 8 L 30 20 M 26 10 L 22 20 M 8 4 L 4 20 M 12 6 L 14 20 M 0 0 C -4 2, -8 8, -10 14"
    />
  )
}

export function KonarkStoryArt({ art }: { art: string }) {
  return (
    <svg className="story-art" viewBox="0 0 400 250" aria-hidden="true" key={art}>
      {art === 'sun' && (
        <g>
          <Sun cx={250} cy={150} r={38} />
          <path className="draw" d="M0 150 H400" />
          <Waves y={168} />
          <path className="draw" d="M60 150 L64 132 H74 L78 150 M66 132 C 66 120, 69 112, 69 108 C 69 112, 72 120, 72 132" />
          <path className="draw thin" d="M120 70 q6 -6 12 0 q6 -6 12 0 M300 60 q5 -5 10 0 q5 -5 10 0" />
        </g>
      )}
      {art === 'chariot' && (
        <g>
          <g transform="translate(110 125)">
            <circle className="draw" r="70" />
            <circle className="draw thin" r="62" />
            <circle className="draw" r="14" />
            {Array.from({ length: 16 }, (_, i) => {
              const a = (i / 16) * Math.PI * 2
              return <path key={i} className={`draw${i % 2 ? ' thin' : ''}`} d={`M${Math.cos(a) * 14} ${Math.sin(a) * 14} L${Math.cos(a) * 62} ${Math.sin(a) * 62}`} />
            })}
            {Array.from({ length: 8 }, (_, i) => {
              const a = (i / 8) * Math.PI * 2
              return <circle key={i} className="draw thin" cx={Math.cos(a) * 40} cy={Math.sin(a) * 40} r="7" />
            })}
          </g>
          {Array.from({ length: 7 }, (_, i) => (
            <Horse key={i} x={214 + (i % 4) * 44} y={i < 4 ? 108 : 176} s={0.95} />
          ))}
        </g>
      )}
      {art === 'artisans' && (
        <g>
          {/* rising courses of stone and a lever lifting the crowning stone */}
          {Array.from({ length: 6 }, (_, row) => {
            const n = 7 - row
            const w = 30
            const x0 = 200 - (n * w) / 2
            return Array.from({ length: n }, (_, i) => <rect key={`${row}-${i}`} className="draw" x={x0 + i * w} y={220 - (row + 1) * 18} width={w} height={18} />)
          })}
          <path className="draw" d="M80 220 L150 70 M60 220 H110 M150 70 L230 90" />
          <path className="draw thin" d="M230 90 V104" />
          <ellipse className="draw" cx="230" cy="110" rx="18" ry="6" />
          <path className="draw thin" d="M300 210 l10 -30 l8 4 l-10 30 z M320 176 l18 -6" />
          <text x="330" y="60" className="tally">12 × 1200</text>
        </g>
      )}
      {art === 'ruin' && (
        <g>
          <KonarkElevation />
          <path className="draw thin" d="M206 186 q20 -10 40 -2 q20 -8 40 0" />
          <text x="300" y="70" className="tally">1903</text>
        </g>
      )}
      {art === 'dawn' && (
        <g>
          <g transform="translate(0 -10) scale(0.9) translate(20 10)">
            <KonarkElevation />
          </g>
          <Sun cx={360} cy={200} r={26} />
          {Array.from({ length: 7 }, (_, i) => (
            <ellipse key={i} className="draw thin" cx={390 - i * 22} cy={240 - (i % 2) * 6} rx="4" ry="2" />
          ))}
        </g>
      )}
    </svg>
  )
}
