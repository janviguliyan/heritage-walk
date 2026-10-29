import * as THREE from 'three'

// Moving geometry between a worker and the page without copying: plain typed arrays, transferred.

export interface PackedGeometry {
  attributes: Record<string, { array: Float32Array | Uint8Array; itemSize: number; normalized: boolean }>
  index: Uint32Array | Uint16Array | null
}

export function packGeometry(g: THREE.BufferGeometry, transfer: Transferable[]): PackedGeometry {
  const attributes: PackedGeometry['attributes'] = {}
  for (const [name, a] of Object.entries(g.attributes)) {
    const attr = a as THREE.BufferAttribute
    attributes[name] = { array: attr.array as Float32Array, itemSize: attr.itemSize, normalized: attr.normalized }
    transfer.push((attr.array as Float32Array).buffer)
  }
  const index = g.index ? (g.index.array as Uint32Array) : null
  if (index) transfer.push(index.buffer)
  return { attributes, index }
}

export function unpackGeometry(p: PackedGeometry) {
  const g = new THREE.BufferGeometry()
  for (const [name, a] of Object.entries(p.attributes)) g.setAttribute(name, new THREE.BufferAttribute(a.array, a.itemSize, a.normalized))
  if (p.index) g.setIndex(new THREE.BufferAttribute(p.index, 1))
  g.computeBoundingSphere()
  g.computeBoundingBox()
  return g
}
