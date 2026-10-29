// Builds Konark off the main thread: the walk's static scene, or the stone miniature.
import { buildKonark, konarkMiniature } from './build'
import { packGeometry } from '../../kit/transfer'

self.onmessage = (e: MessageEvent<'scene' | 'mini'>) => {
  const transfer: Transferable[] = []
  if (e.data === 'mini') {
    const g = konarkMiniature()
    self.postMessage({ kind: 'mini', geo: packGeometry(g, transfer) }, { transfer })
    return
  }
  const b = buildKonark()
  const meshes = [...b.build()].map(([key, g]) => [key, packGeometry(g, transfer)] as const)
  self.postMessage({ kind: 'scene', meshes, colliders: b.colliders }, { transfer })
}
