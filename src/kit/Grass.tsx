import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { GROUND_GLSL, LAWN_TINT } from './materials'
import { upgradeTexture } from './Trees'

// Grass tufts standing on the lawns: crossed cards carrying a tuft modelled and rendered in
// Blender (tools/blender/foliage.py). Each takes its light from the lawn's own bake at its
// root, so tree and wall shadows fall across the grass as they do across the lawn. They grow
// in near the eye and shrink to nothing further out.

/** tufts a square metre, and the distance (m) at which they have shrunk away */
const DENSITY = 7
const FAR = 30

function seededRand(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let tuftTex: THREE.Texture | null = null
function tuftTexture() {
  if (tuftTex) return tuftTex
  // a plain stand-in until the rendered tuft arrives: fully transparent, so nothing shows
  const c = document.createElement('canvas')
  c.width = c.height = 4
  const t = new THREE.Texture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  t.needsUpdate = true
  tuftTex = upgradeTexture(t, 'tuft-albedo.webp')
  return t
}

/** Tufts over one lawn face (a triangle): positions, card uvs, the bake uv at each root. */
function tuftsOnTriangle(p: THREE.Vector3[], l: THREE.Vector2[], rand: () => number, out: { pos: number[]; uv: number[]; lm: number[]; root: number[] }) {
  const area = new THREE.Vector3().subVectors(p[1], p[0]).cross(new THREE.Vector3().subVectors(p[2], p[0])).length() / 2
  const n = Math.round(area * DENSITY)
  for (let i = 0; i < n; i++) {
    let u = rand()
    let v = rand()
    if (u + v > 1) {
      u = 1 - u
      v = 1 - v
    }
    const w = 1 - u - v
    const x = p[0].x * w + p[1].x * u + p[2].x * v
    const y = p[0].y * w + p[1].y * u + p[2].y * v
    const z = p[0].z * w + p[1].z * u + p[2].z * v
    const lx = l[0].x * w + l[1].x * u + l[2].x * v
    const ly = l[0].y * w + l[1].y * u + l[2].y * v
    const h = 0.08 + rand() * 0.1
    const half = h * (0.45 + rand() * 0.15)
    const yaw = rand() * Math.PI
    // two cards crossed at right angles
    for (let k = 0; k < 2; k++) {
      const a = yaw + k * Math.PI * 0.5
      const dx = Math.cos(a) * half
      const dz = Math.sin(a) * half
      const flip = rand() < 0.5
      const corners: [number, number][] = [
        [-1, 0],
        [1, 0],
        [1, 1],
        [-1, 0],
        [1, 1],
        [-1, 1],
      ]
      for (const [s, t] of corners) {
        out.pos.push(x + dx * s, y + t * h, z + dz * s)
        out.uv.push(flip ? (1 - s) / 2 : (s + 1) / 2, t)
        out.lm.push(lx, ly)
        out.root.push(x, y, z)
      }
    }
  }
}

/** Tufts for every lawn face of the built world, grouped by bake page and by face. */
function buildTufts(meshes: [string, THREE.BufferGeometry][]) {
  const groups: { page: number; geo: THREE.BufferGeometry }[] = []
  const rand = seededRand(91)
  const P = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
  const L = [new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2()]
  const e1 = new THREE.Vector3()
  const e2 = new THREE.Vector3()
  for (const [key, geo] of meshes) {
    const [mat, page] = key.split('#')
    if (mat !== 'lawn' || page === 'v' || !geo.attributes.uv1) continue
    const pos = geo.attributes.position as THREE.BufferAttribute
    const lm = geo.attributes.uv1 as THREE.BufferAttribute
    const idx = geo.index
    const tris = (idx ? idx.count : pos.count) / 3
    for (let t = 0; t < tris; t++) {
      for (let j = 0; j < 3; j++) {
        const i = idx ? idx.getX(t * 3 + j) : t * 3 + j
        P[j].fromBufferAttribute(pos, i)
        L[j].fromBufferAttribute(lm, i)
      }
      e1.subVectors(P[1], P[0])
      e2.subVectors(P[2], P[0])
      const n = e1.clone().cross(e2)
      const area = n.length() / 2
      // the tops of the lawn parterres only: not their sides, nor the open ground round the site
      if (n.normalize().y < 0.95 || area > 5000 || P[0].y < 0.05) continue
      const out = { pos: [] as number[], uv: [] as number[], lm: [] as number[], root: [] as number[] }
      tuftsOnTriangle(P, L, rand, out)
      if (!out.pos.length) continue
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3))
      g.setAttribute('uv', new THREE.Float32BufferAttribute(out.uv, 2))
      g.setAttribute('lmuv', new THREE.Float32BufferAttribute(out.lm, 2))
      g.setAttribute('aRoot', new THREE.Float32BufferAttribute(out.root, 3))
      // lit as the lawn is: facing straight up
      const nrm = new Float32Array(out.pos.length)
      for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1
      g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3))
      g.computeBoundingSphere()
      groups.push({ page: Number(page), geo: g })
    }
  }
  if (import.meta.env.DEV) console.info(`[grass] ${groups.length} lawn faces, ${groups.reduce((n, g) => n + g.geo.attributes.position.count / 12, 0)} tufts`)
  return groups
}

const uTime = { value: 0 }

function tuftMaterial(lm: THREE.Texture, sun: THREE.Texture, scale: number) {
  const m = new THREE.MeshStandardMaterial({ map: tuftTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime
    shader.uniforms.uLm = { value: lm }
    shader.uniforms.uSun = { value: sun }
    shader.uniforms.uLmScale = { value: scale }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nattribute vec2 lmuv;\nattribute vec3 aRoot;\nvarying vec2 vLmUv;\nvarying vec3 vWPos;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        // shrink away with distance, then sway in the wind (more toward the tip)
        float grow = 1.0 - smoothstep(${(FAR * 0.55).toFixed(1)}, ${FAR.toFixed(1)}, distance(aRoot, cameraPosition));
        transformed = aRoot + (transformed - aRoot) * grow;
        float tip = transformed.y - aRoot.y;
        float ph = uTime * 1.7 + aRoot.x * 0.37 + aRoot.z * 0.23;
        transformed.x += (sin(ph) + 0.35 * sin(ph * 2.3)) * tip * 0.14;
        transformed.z += cos(ph * 0.8) * tip * 0.09;
        vLmUv = lmuv;
        vWPos = aRoot;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${GROUND_GLSL}\nuniform float uLmScale;\nuniform sampler2D uLm;\nuniform sampler2D uSun;\nvarying vec2 vLmUv;`)
      .replace('#include <map_fragment>', `#include <map_fragment>\n${LAWN_TINT}`)
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
        vec4 bk = vec4(texture2D(uLm, vLmUv).rgb, texture2D(uSun, vLmUv).r);
        reflectedLight.directDiffuse *= bk.a;
        reflectedLight.directSpecular *= bk.a;
        reflectedLight.indirectDiffuse = bk.rgb * uLmScale * BRDF_Lambert(material.diffuseColor);
        reflectedLight.indirectSpecular *= 0.0;`,
      )
  }
  m.customProgramCacheKey = () => 'grass-tufts'
  return m
}

export function LawnTufts({ meshes, pages, sun, scale }: { meshes: [string, THREE.BufferGeometry][]; pages: THREE.Texture[]; sun: THREE.Texture[]; scale: number }) {
  const groups = useMemo(() => buildTufts(meshes), [meshes])
  const mats = useMemo(() => pages.map((p, i) => tuftMaterial(p, sun[i], scale)), [pages, sun, scale])
  useEffect(
    () => () => {
      groups.forEach((g) => g.geo.dispose())
      mats.forEach((m) => m.dispose())
    },
    [groups, mats],
  )
  useFrame((_, dt) => {
    uTime.value += dt
  })
  return (
    <>
      {groups.map((g, i) => (
        <mesh key={i} geometry={g.geo} material={mats[g.page]} />
      ))}
    </>
  )
}
