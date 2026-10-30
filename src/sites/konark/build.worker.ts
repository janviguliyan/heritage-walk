// Builds Konark off the main thread: the walk's static scene, or the stone miniature.
import { BufferAttribute, type BufferGeometry } from 'three'
import { buildKonark, clusterSimplify, konarkMiniature } from './build'
import { packGeometry } from '../../kit/transfer'

self.onmessage = (e: MessageEvent<'scene' | 'scene-low' | 'mini'>) => {
  const transfer: Transferable[] = []
  if (e.data === 'mini') {
    const g = konarkMiniature()
    self.postMessage({ kind: 'mini', geo: packGeometry(g, transfer) }, { transfer })
    return
  }
  const b = buildKonark()
  // on a phone the sculpture (two million triangles at full detail) is clustered to ~6 cm: its
  // baked light then no longer matches, so it is lit live, as everything is on a phone
  const low = e.data === 'scene-low'
  const meshes = [...b.build()].map(([key, g]) => [key, packGeometry(low && key === 'carved#v' ? withUv(clusterSimplify(g, 0.06)) : g, transfer)] as const)
  self.postMessage({ kind: 'scene', meshes, colliders: b.colliders }, { transfer })
}

/** texture coordinates for simplified sculpture: the stone's grain from its position */
function withUv(g: BufferGeometry) {
  const p = g.attributes.position
  const uv = new Float32Array(p.count * 2)
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = (p.getX(i) + p.getZ(i)) / 1.2
    uv[i * 2 + 1] = p.getY(i) / 1.2
  }
  g.setAttribute('uv', new BufferAttribute(uv, 2))
  return g
}
