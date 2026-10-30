// Builds Konark off the main thread: the walk's static scene, or the stone miniature.
import { buildKonark, konarkMiniature } from './build'
import { packGeometry } from '../../kit/transfer'
import { setSculptGrain } from '../../kit/sculpt'

self.onmessage = (e: MessageEvent<'scene' | 'scene-low' | 'mini'>) => {
  const transfer: Transferable[] = []
  if (e.data === 'mini') {
    // at tablet scale the statues are lumps a few millimetres high: leave them out, and the
    // miniature builds in well under a second instead of several (it holds up the map)
    const g = konarkMiniature({ sculpture: false })
    self.postMessage({ kind: 'mini', geo: packGeometry(g, transfer) }, { transfer })
    return
  }
  // on a phone the sculpture is sculpted at a coarser grain (two million triangles at full detail,
  // and most of the build's time): its baked light then no longer matches, so it is lit live
  if (e.data === 'scene-low') setSculptGrain(2.2)
  const b = buildKonark()
  const meshes = [...b.build()].map(([key, g]) => [key, packGeometry(g, transfer)] as const)
  self.postMessage({ kind: 'scene', meshes, colliders: b.colliders }, { transfer })
}
