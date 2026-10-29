import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { amalakaGeometry, kalashaGeometry } from '../../kit/geometry'
import { LAYOUT } from './layout'

// Conjectural rekha deul: a square curvilinear tower about 65 m tall, drawn as a gold ghost.
// Illustrative only — the original form and height are estimates.
const BASE_Y = LAYOUT.chariot.h + 2
const TOP = 58

function towerGeometry() {
  const half = LAYOUT.deul.w / 2 - 0.5
  const H = TOP - BASE_Y
  const pts: THREE.Vector2[] = []
  const courses = 40
  for (let i = 0; i <= courses; i++) {
    const t = i / courses
    const r = half * (1 - 0.62 * t ** 2.1) * Math.SQRT2
    // horizontal bhumi courses as small steps
    pts.push(new THREE.Vector2(r, t * H))
    if (i < courses) pts.push(new THREE.Vector2(r * 0.985, t * H + H / courses / 2))
  }
  const body = new THREE.LatheGeometry(pts, 4, Math.PI / 4)
  const amalaka = amalakaGeometry(half * 0.42, 2.6)
  amalaka.translate(0, H, 0)
  const kalasha = kalashaGeometry(1.4, 4.6)
  kalasha.translate(0, H + 2.6, 0)
  const parts = [body, amalaka, kalasha].map((g) => {
    const n = g.index ? g.toNonIndexed() : g
    n.deleteAttribute('uv')
    return n
  })
  const g = mergeGeometries(parts)!
  g.translate(LAYOUT.deul.x, BASE_Y, 0)
  return g
}

export function KonarkReconstruction({ visible }: { visible: boolean }) {
  const geo = useMemo(towerGeometry, [])
  const edges = useMemo(() => new THREE.EdgesGeometry(geo, 20), [geo])
  const fill = useRef<THREE.MeshStandardMaterial>(null)
  const line = useRef<THREE.LineBasicMaterial>(null)
  const group = useRef<THREE.Group>(null)
  const o = useRef(0)
  useFrame((_, dt) => {
    o.current += ((visible ? 1 : 0) - o.current) * Math.min(1, dt * 1.2)
    if (group.current) group.current.visible = o.current > 0.01
    if (fill.current) fill.current.opacity = o.current * 0.28
    if (line.current) line.current.opacity = o.current * 0.85
  })
  return (
    <group ref={group} visible={false}>
      <mesh geometry={geo}>
        <meshStandardMaterial ref={fill} color="#ffcf73" emissive="#ff9f2e" emissiveIntensity={0.6} transparent depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial ref={line} color="#ffd98a" transparent toneMapped={false} />
      </lineSegments>
    </group>
  )
}
