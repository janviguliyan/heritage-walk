import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { chartPart, pack, writeUV1, type LayoutPart } from './lightmap'

export type V3 = [number, number, number]
/** material key; the site decides what each key looks like */
type MatKey = string

export type ColliderSpec =
  | { kind: 'box'; pos: V3; half: V3; rotY: number }
  | { kind: 'hull'; points: number[] }
  | { kind: 'cyl'; pos: V3; halfHeight: number; radius: number }

/** UV projection: 'world' = box-projected at `tile` metres per repeat; 'frieze' = a horizontal strip of height `h` starting at world `y0`. */
export type UVMode = { mode: 'world'; tile: number } | { mode: 'frieze'; y0: number; h: number } | { mode: 'native' }

export interface AddOpts {
  pos?: V3
  rot?: V3
  scale?: V3
  uv?: UVMode
}

const Y = new THREE.Vector3(0, 1, 0)

/**
 * Collects kit geometry in world space, grouped by material, plus simple collision shapes.
 * The whole static scene merges into one mesh per material (a handful of draw calls).
 * Groups may translate, rotate about Y and scale uniformly; colliders follow those transforms.
 */
export class Builder {
  private stack: { m: THREE.Matrix4; rotY: number; s: number }[] = [{ m: new THREE.Matrix4(), rotY: 0, s: 1 }]
  readonly geos = new Map<MatKey, THREE.BufferGeometry[]>()
  readonly colliders: ColliderSpec[] = []
  /** with lightmap layout: every added geometry, in order, cut into charts */
  readonly parts: LayoutPart[] = []
  pages = 0

  constructor(readonly opts: { lightmap?: boolean } = {}) {}

  private get top() {
    return this.stack[this.stack.length - 1]
  }

  group(pos: V3, rotY: number, fn: () => void, s = 1) {
    const local = new THREE.Matrix4().compose(
      new THREE.Vector3(...pos),
      new THREE.Quaternion().setFromAxisAngle(Y, rotY),
      new THREE.Vector3(s, s, s),
    )
    const t = this.top
    this.stack.push({ m: t.m.clone().multiply(local), rotY: t.rotY + rotY, s: t.s * s })
    fn()
    this.stack.pop()
  }

  add(mat: MatKey, geo: THREE.BufferGeometry, o: AddOpts = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone()
    geo.dispose()
    const local = new THREE.Matrix4().compose(
      new THREE.Vector3(...(o.pos ?? [0, 0, 0])),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...(o.rot ?? [0, 0, 0]))),
      new THREE.Vector3(...(o.scale ?? [1, 1, 1])),
    )
    g.applyMatrix4(this.top.m.clone().multiply(local))
    const keepUV = o.uv?.mode === 'native' && !!g.attributes.uv
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && !(keepUV && name === 'uv')) g.deleteAttribute(name)
    if (!g.attributes.normal) g.computeVertexNormals()
    let uv = o.uv ?? { mode: 'world', tile: mat === 'frieze' ? 4 : 2 }
    if (uv.mode === 'frieze') {
      // y0 and h are given in the group's local space
      const y0 = new THREE.Vector3(0, uv.y0, 0).applyMatrix4(this.top.m).y
      uv = { mode: 'frieze', y0, h: uv.h * this.top.s }
    }
    if (uv.mode !== 'native') projectUV(g, uv)
    if (this.opts.lightmap) {
      this.parts.push(chartPart(mat, g))
      return
    }
    const list = this.geos.get(mat) ?? []
    list.push(g)
    this.geos.set(mat, list)
  }

  box(mat: MatKey, size: V3, pos: V3, o: { rotY?: number; uv?: UVMode; collide?: boolean } = {}) {
    this.add(mat, new THREE.BoxGeometry(...size), { pos, rot: [0, o.rotY ?? 0, 0], uv: o.uv })
    if (o.collide) this.colliderBox(pos, [size[0] / 2, size[1] / 2, size[2] / 2], o.rotY ?? 0)
  }

  colliderBox(pos: V3, half: V3, rotY = 0) {
    const t = this.top
    const p = new THREE.Vector3(...pos).applyMatrix4(t.m)
    this.colliders.push({ kind: 'box', pos: [p.x, p.y, p.z], half: [half[0] * t.s, half[1] * t.s, half[2] * t.s], rotY: t.rotY + rotY })
  }

  colliderCyl(pos: V3, halfHeight: number, radius: number) {
    const t = this.top
    const p = new THREE.Vector3(...pos).applyMatrix4(t.m)
    this.colliders.push({ kind: 'cyl', pos: [p.x, p.y, p.z], halfHeight: halfHeight * t.s, radius: radius * t.s })
  }

  colliderHull(points: V3[]) {
    const t = this.top
    const out: number[] = []
    for (const pt of points) {
      const p = new THREE.Vector3(...pt).applyMatrix4(t.m)
      out.push(p.x, p.y, p.z)
    }
    this.colliders.push({ kind: 'hull', points: out })
  }

  build(): Map<MatKey, THREE.BufferGeometry> {
    if (this.opts.lightmap) return this.buildLightmapped()
    const out = new Map<MatKey, THREE.BufferGeometry>()
    for (const [mat, list] of this.geos) {
      const merged = mergeGeometries(list, false)
      for (const g of list) g.dispose()
      if (!merged) continue
      merged.computeBoundingSphere()
      merged.computeBoundingBox()
      out.set(mat, merged)
    }
    this.geos.clear()
    return out
  }
}

// One merged mesh per material and lightmap page ("mat#page"), plus "mat#v" for the parts lit
// per vertex. Keys and vertex order are deterministic, so baked data lines up at runtime.
Builder.prototype.buildLightmapped = function (this: Builder) {
  this.pages = pack(this.parts)
  const groups = new Map<string, THREE.BufferGeometry[]>()
  const push = (key: string, g: THREE.BufferGeometry) => {
    const l = groups.get(key) ?? []
    l.push(g)
    groups.set(key, l)
  }
  for (const part of this.parts) {
    if (part.kind === 'vertex') {
      push(`${part.mat}#v`, weld(part.geo))
      continue
    }
    writeUV1(part)
    // split the part's triangles by the page their chart landed on
    const byPage = new Map<number, number[]>()
    part.triChart!.forEach((ci, t) => {
      if (ci < 0) return
      const pg = part.charts[ci].page
      const l = byPage.get(pg) ?? []
      l.push(t)
      byPage.set(pg, l)
    })
    for (const [pg, tris] of byPage) push(`${part.mat}#${pg}`, byPage.size === 1 ? part.geo : pickTriangles(part.geo, tris))
  }
  const out = new Map<string, THREE.BufferGeometry>()
  for (const key of [...groups.keys()].sort()) {
    const merged = mergeGeometries(groups.get(key)!, false)
    if (!merged) continue
    merged.computeBoundingSphere()
    merged.computeBoundingBox()
    out.set(key, merged)
  }
  return out
}
declare module './builder' {
  interface Builder {
    buildLightmapped(): Map<string, THREE.BufferGeometry>
  }
}

/** Weld a triangle soup into an indexed mesh (shared vertices light once), with UVs projected per vertex. */
function weld(g: THREE.BufferGeometry) {
  const bare = new THREE.BufferGeometry()
  bare.setAttribute('position', g.attributes.position)
  bare.setAttribute('normal', g.attributes.normal)
  const w = mergeVertices(bare, 1e-4)
  const p = w.attributes.position as THREE.BufferAttribute
  const n = w.attributes.normal as THREE.BufferAttribute
  const uv = new Float32Array(p.count * 2)
  const tile = 1.2
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i))
    const ay = Math.abs(n.getY(i))
    const az = Math.abs(n.getZ(i))
    let u: number
    let v: number
    if (ay >= ax && ay >= az) [u, v] = [p.getX(i), p.getZ(i)]
    else if (ax >= az) [u, v] = [p.getZ(i), p.getY(i)]
    else [u, v] = [p.getX(i), p.getY(i)]
    uv[i * 2] = u / tile
    uv[i * 2 + 1] = v / tile
  }
  w.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  w.setAttribute('uv1', new THREE.BufferAttribute(new Float32Array(p.count * 2), 2))
  return w
}

function pickTriangles(g: THREE.BufferGeometry, tris: number[]) {
  const out = new THREE.BufferGeometry()
  for (const name of Object.keys(g.attributes)) {
    const src = g.attributes[name] as THREE.BufferAttribute
    const k = src.itemSize
    const arr = new Float32Array(tris.length * 3 * k)
    tris.forEach((t, i) => arr.set((src.array as Float32Array).subarray(t * 3 * k, t * 3 * k + 3 * k), i * 3 * k))
    out.setAttribute(name, new THREE.BufferAttribute(arr, k))
  }
  return out
}

// Per-triangle box projection in world space: consistent texel density on every part.
function projectUV(g: THREE.BufferGeometry, uv: Exclude<UVMode, { mode: 'native' }>) {
  const pos = g.attributes.position as THREE.BufferAttribute
  const n = pos.count
  const uvs = new Float32Array(n * 2)
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const ab = new THREE.Vector3()
  const ac = new THREE.Vector3()
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(pos, i)
    b.fromBufferAttribute(pos, i + 1)
    c.fromBufferAttribute(pos, i + 2)
    ab.subVectors(b, a)
    ac.subVectors(c, a)
    const fn = ab.cross(ac)
    const ax = Math.abs(fn.x)
    const ay = Math.abs(fn.y)
    const az = Math.abs(fn.z)
    for (let k = 0; k < 3; k++) {
      const p = k === 0 ? a : k === 1 ? b : c
      let u: number
      let v: number
      if (ay >= ax && ay >= az) {
        u = p.x
        v = p.z
      } else if (ax >= az) {
        u = fn.x > 0 ? -p.z : p.z
        v = p.y
      } else {
        u = fn.z > 0 ? p.x : -p.x
        v = p.y
      }
      if (uv.mode === 'world') {
        uvs[(i + k) * 2] = u / uv.tile
        uvs[(i + k) * 2 + 1] = v / uv.tile
      } else {
        const horizontal = ay >= ax && ay >= az
        uvs[(i + k) * 2] = u / (uv.h * 4)
        uvs[(i + k) * 2 + 1] = horizontal ? 0.02 : (p.y - uv.y0) / uv.h
      }
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
}
