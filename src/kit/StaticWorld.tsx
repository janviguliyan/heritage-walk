import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { ConvexHullCollider, CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import type { Builder, ColliderSpec, V3 } from './builder'
import { getMaterials, loadStoneDetail, patchDetail } from './materials'
import { wheelGeometry } from './geometry'
import { LawnTufts } from './Grass'
import { store } from '../engine/store'

interface BakeManifest {
  version: number
  pages: number
  scale: number
  sun: { azimuth: number; elevation: number }
  vertex: Record<string, string>
  keys: string[]
}

interface Baked {
  scale: number
  pages: THREE.Texture[]
  sun: THREE.Texture[]
  vertex: Map<string, Uint8Array>
}

/** Load a scene's baked light, if there is one and it matches the scene as built now. */
async function loadBake(base: string, keys: string[]): Promise<{ baked: Baked; sun: BakeManifest['sun'] } | null> {
  try {
    const r = await fetch(base + 'manifest.json')
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) return null
    const m = (await r.json()) as BakeManifest
    if (m.keys.join('|') !== keys.join('|')) {
      console.warn('[bake] the scene changed since it was baked; using live lighting. Re-run the bake.')
      return null
    }
    const loader = new THREE.TextureLoader()
    const load = (name: string) =>
      Promise.all(
        Array.from({ length: m.pages }, (_, i) =>
          loader.loadAsync(`${base}${name}-${i}.webp?v=${m.version}`).then((t) => {
          t.colorSpace = THREE.NoColorSpace
          // no mipmaps: lower levels would blend neighbouring charts (light is smooth anyway)
          t.generateMipmaps = false
          t.minFilter = THREE.LinearFilter
          t.magFilter = THREE.LinearFilter
          return t
        }),
        ),
      )
    const [pages, sun] = await Promise.all([load('lm'), load('sun')])
    const vertex = new Map<string, Uint8Array>()
    await Promise.all(
      Object.entries(m.vertex).map(async ([key, file]) => {
        const b = await (await fetch(`${base}${file}?v=${m.version}`)).arrayBuffer()
        vertex.set(key, new Uint8Array(b))
      }),
    )
    return { baked: { scale: m.scale, pages, sun, vertex }, sun: m.sun }
  } catch {
    return null
  }
}

/**
 * A material that takes its light from the bake: the live sun is kept (so normal maps still
 * read) but scaled by the baked sun visibility, and all ambient light is the baked sky.
 */
function bakedMaterial(base: THREE.Material, scale: number, page: THREE.Texture | null, sunPage: THREE.Texture | null = null) {
  const m = base.clone()
  const perVertex = !page
  m.onBeforeCompile = (shader) => {
    if (base.userData.detail) patchDetail(shader, base.userData.detail)
    shader.uniforms.uLm = { value: page }
    shader.uniforms.uSun = { value: sunPage }
    shader.uniforms.uLmScale = { value: scale }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${perVertex ? 'attribute vec2 bakeV; varying vec2 vBake;' : 'attribute vec2 lmuv; varying vec2 vLmUv;'}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${perVertex ? 'vBake = bakeV;' : 'vLmUv = lmuv;'}`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uLmScale;\n${perVertex ? 'varying vec2 vBake;' : 'uniform sampler2D uLm; uniform sampler2D uSun; varying vec2 vLmUv;'}`)
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
        // per-vertex light keeps luminance only; the sky's colour is a constant tint
        vec4 bk = ${perVertex ? 'vec4(vec3(0.86, 0.97, 1.14) * vBake.x, vBake.y)' : 'vec4(texture2D(uLm, vLmUv).rgb, texture2D(uSun, vLmUv).r)'};
        reflectedLight.directDiffuse *= bk.a;
        reflectedLight.directSpecular *= bk.a;
        vec3 sky = bk.rgb * uLmScale;
        reflectedLight.indirectDiffuse = sky * BRDF_Lambert(material.diffuseColor);
        reflectedLight.indirectSpecular *= clamp(dot(sky, vec3(0.45)), 0.0, 1.0);`,
      )
  }
  m.customProgramCacheKey = () => `baked-${perVertex ? 'v' : 'lm'}-${base.uuid}`
  return m
}

/** Renders a finished Builder: one merged mesh per material (and lightmap page), and one fixed body for every collider. */
export function StaticWorld({ build, data, low, bake, detail, onDispose }: { build?: () => Builder; data?: { meshes: [string, THREE.BufferGeometry][]; colliders: ColliderSpec[] }; low: boolean; bake?: string; /** folder of sculpted stone textures (high quality only) */ detail?: string; onDispose?: () => void }) {
  const { meshes, colliders } = useMemo(() => {
    if (data) return data
    const b = build!()
    return { meshes: [...b.build()], colliders: b.colliders }
  }, [build, data])
  const mats = getMaterials(low)
  useEffect(() => {
    if (!detail || low) return
    // after the walk is showing: the lighting comes first, the carving streams in behind it
    const go = () => store.get().sceneReady && (unsub(), void loadStoneDetail(detail))
    const unsub = store.subscribe(go)
    go()
    return () => void unsub()
  }, [detail, low])
  const [baked, setBaked] = useState<Baked | null>(null)
  useEffect(() => {
    store.set({ loadStage: 1 })
    if (!bake) {
      store.set({ sceneReady: true })
      return () => store.set({ sceneReady: false })
    }
    let alive = true
    loadBake(
      bake,
      meshes.map(([k]) => k),
    ).then((r) => {
      if (alive) store.set({ sceneReady: true })
      if (!alive || !r) return
      // the per-vertex light rides on the geometry; the lightmap UVs go in under their own name
      for (const [key, geo] of meshes) {
        const v = r.baked.vertex.get(key)
        if (v && v.length === geo.attributes.position.count * 2) geo.setAttribute('bakeV', new THREE.BufferAttribute(v, 2, true))
        else if (geo.attributes.uv1) geo.setAttribute('lmuv', geo.attributes.uv1)
      }
      setBaked(r.baked)
      store.set({ bakedSun: r.sun })
    })
    return () => {
      alive = false
      store.set({ bakedSun: null, sceneReady: false })
    }
  }, [bake, meshes])
  const geo = (k: string) => meshes.find(([key]) => key === k)?.[1]
  const materials = useMemo(
    () =>
      meshes.map(([key]) => {
        const [mat, page] = key.split('#')
        const base = mats[mat as keyof typeof mats]
        if (!baked || page === undefined) return base
        // per-vertex light only if it matches this mesh exactly; otherwise live lighting, never black
        if (page === 'v') return baked.vertex.has(key) && geo(key)?.attributes.bakeV ? bakedMaterial(base, baked.scale, null) : base
        return bakedMaterial(base, baked.scale, baked.pages[Number(page)], baked.sun[Number(page)])
      }),
    [meshes, mats, baked],
  )
  // geometry built here is ours to free; geometry handed in (`data`) belongs to its cache, which
  // keeps it for the session (an unmount/remount — StrictMode, a quality switch — reuses it)
  useEffect(
    () => () => {
      if (!data) meshes.forEach(([, g]) => g.dispose())
      onDispose?.()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meshes],
  )
  return (
    <>
      {meshes.map(([key, geo], i) => {
        const mat = key.split('#')[0]
        const ground = mat === 'sand' || mat === 'grass' || mat === 'path' || mat === 'lawn'
        return <mesh key={key} geometry={geo} material={materials[i]} castShadow={!baked && !ground} receiveShadow={!baked} />
      })}
      {/* grass standing on the lawns, lit by the lawn's bake (high quality only) */}
      {baked && !low && <LawnTufts meshes={meshes} pages={baked.pages} sun={baked.sun} scale={baked.scale} />}
      <RigidBody type="fixed" colliders={false}>
        {colliders.map((c, i) => {
          if (c.kind === 'box') return <CuboidCollider key={i} args={c.half} position={c.pos} rotation={[0, c.rotY, 0]} />
          if (c.kind === 'cyl') return <CylinderCollider key={i} args={[c.halfHeight, c.radius]} position={c.pos} />
          return <ConvexHullCollider key={i} args={[new Float32Array(c.points)]} />
        })}
      </RigidBody>
    </>
  )
}

export interface WheelPlacement {
  pos: V3
  /** rotation about Y so the wheel's front faces outward */
  rotY: number
  /** spin of the spokes, for variety */
  spin: number
}

/** All chariot wheels as one instanced mesh (for scenes that don't bake them in). */
export function Wheels({ placements, radius = 1.5, low }: { placements: WheelPlacement[]; radius?: number; low: boolean }) {
  const geo = useMemo(() => wheelGeometry(radius), [radius])
  const mat = getMaterials(low).carved
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(geo, mat, placements.length)
    const o = new THREE.Object3D()
    placements.forEach((p, i) => {
      o.position.set(...p.pos)
      o.rotation.set(0, p.rotY, p.spin)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    })
    m.castShadow = true
    m.receiveShadow = true
    m.computeBoundingSphere()
    return m
  }, [geo, mat, placements])
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <>
      <primitive object={mesh} />
      <RigidBody type="fixed" colliders={false}>
        {placements.map((p, i) => (
          <CuboidCollider key={i} args={[radius + 0.1, radius + 0.1, 0.45]} position={p.pos} rotation={[0, p.rotY, 0]} />
        ))}
      </RigidBody>
    </>
  )
}
