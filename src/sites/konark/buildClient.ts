import type * as THREE from 'three'
import type { ColliderSpec } from '../../kit/builder'
import { unpackGeometry, type PackedGeometry } from '../../kit/transfer'

// The page side of build.worker: each build runs once, in the background, and is cached, so the
// overview can prepare the 3D site while the visitor looks at the stone plan.

export interface SceneData {
  meshes: [string, THREE.BufferGeometry][]
  colliders: ColliderSpec[]
}

function run<T>(kind: 'scene' | 'scene-low' | 'mini', read: (d: unknown) => T): Promise<T> {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL('./build.worker.ts', import.meta.url), { type: 'module' })
    w.onmessage = (e) => {
      resolve(read(e.data))
      w.terminate()
    }
    w.onerror = (e) => {
      reject(e)
      w.terminate()
    }
    w.postMessage(kind)
  })
}

const scenes = new Map<boolean, Promise<SceneData>>()
/** The walk's static scene: built once per session in the background, then reused. `low` (phones):
 *  the sculpture simplified, the rest the same. */
export function sceneData(low = false) {
  let scene = scenes.get(low)
  if (!scene)
    scenes.set(
      low,
      (scene = run(low ? 'scene-low' : 'scene', (d) => {
      const data = d as { meshes: [string, PackedGeometry][]; colliders: ColliderSpec[] }
        return { meshes: data.meshes.map(([k, p]) => [k, unpackGeometry(p)] as [string, THREE.BufferGeometry]), colliders: data.colliders }
      })),
    )
  return scene
}
let mini: Promise<THREE.BufferGeometry> | null = null
export function miniatureData() {
  if (!mini) mini = run('mini', (d) => unpackGeometry((d as { geo: PackedGeometry }).geo))
  return mini
}
