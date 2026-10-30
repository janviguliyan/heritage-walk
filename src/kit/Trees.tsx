import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export interface TreePlacement {
  x: number
  z: number
  h: number
}

const uTime = { value: 0 }

/** A small deterministic random sequence (tree shapes must match the bake). */
function seededRand(seed: number) {
  let x = seed * 9301 + 49297
  return () => {
    x = (x * 9301 + 49297) % 233280
    return x / 233280
  }
}

/** a lumpy crown: an icosphere pushed in and out by noise, for broadleaf trees and shrubs */
function crownGeometry(detail: number, seed: number) {
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, detail))
  const p = g.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    const n = Math.sin(v.x * 3.1 + seed) * Math.sin(v.y * 2.7 + seed * 1.3) * Math.sin(v.z * 3.3 + seed * 0.7)
    const k = 1 + n * 0.22 + Math.sin(v.x * 9 + v.z * 7 + seed) * 0.05
    p.setXYZ(i, v.x * k, v.y * k * 0.82, v.z * k)
  }
  g.computeVertexNormals()
  // self-shade: darker underneath and in the hollows, a little speckle of lit leaves
  const col = new Float32Array(p.count * 3)
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i)
    const speck = Math.sin(p.getX(i) * 17 + p.getZ(i) * 23 + seed) * 0.5 + 0.5
    const k = 0.45 + 0.55 * THREE.MathUtils.smoothstep(y, -0.8, 0.7) + speck * 0.12
    col.set([k, k, k * 0.95], i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}

/** Leaves, needles and grass modelled and rendered in Blender (tools/blender/foliage.py): each
 *  replaces its drawn stand-in once loaded (the drawing shows until then). */
export function upgradeTexture<T extends THREE.Texture | null>(tex: T, file: string): T {
  if (!tex || typeof document === 'undefined') return tex
  new THREE.ImageLoader()
    .loadAsync(`${import.meta.env.BASE_URL}foliage/${file}`)
    .then((img) => {
      // a texture already on the GPU has fixed storage at the stand-in's size: free it first
      tex.dispose()
      tex.image = img
      tex.needsUpdate = true
    })
    .catch(() => {})
  return tex
}

/** A plain colour, standing in for a texture that arrives later. */
function solidTexture(color: string, file: string) {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = c.height = 1
  const g = c.getContext('2d')!
  g.fillStyle = color
  g.fillRect(0, 0, 1, 1)
  const t = new THREE.Texture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  t.needsUpdate = true
  return upgradeTexture(t, file)
}
let frondTex: THREE.Texture | null = null
let frondNrm: THREE.Texture | null = null

/** A flat normal map, for a material whose normal map arrives later. */
function flatNormal(file: string) {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = c.height = 1
  const g = c.getContext('2d')!
  g.fillStyle = 'rgb(128,128,255)'
  g.fillRect(0, 0, 1, 1)
  const t = new THREE.Texture(c)
  t.needsUpdate = true
  return upgradeTexture(t, file)
}

/** A cluster of pointed leaves on transparency, drawn once (no photographs): near-white, so each
 *  tree's own green (its instance colour) tints it. Leaves radiate from twig tips. */
let leafTex: THREE.Texture | null = null
function leafTexture() {
  if (leafTex) return leafTex
  const S = 256
  const c = typeof document !== 'undefined' ? document.createElement('canvas') : null
  if (!c) return null
  c.width = c.height = S
  const g = c.getContext('2d')!
  const rand = seededRand(17)
  const leaf = (x: number, y: number, a: number, len: number, light: number) => {
    const w = len * (0.24 + rand() * 0.08)
    g.save()
    g.translate(x, y)
    g.rotate(a)
    g.beginPath()
    g.moveTo(0, 0)
    g.quadraticCurveTo(len * 0.45, -w, len, 0)
    g.quadraticCurveTo(len * 0.45, w, 0, 0)
    const l = Math.round(150 + light * 105)
    g.fillStyle = `rgb(${l - 18},${l},${l - 30})`
    g.fill()
    // the midrib, a shade darker
    g.strokeStyle = `rgba(60,70,40,0.35)`
    g.lineWidth = 1.2
    g.beginPath()
    g.moveTo(len * 0.05, 0)
    g.lineTo(len * 0.9, 0)
    g.stroke()
    g.restore()
  }
  // a few twigs, each with a spray of leaves; back leaves darker, front ones lit
  for (let layer = 0; layer < 3; layer++)
    for (let t = 0; t < 7; t++) {
      const tx = S / 2 + (rand() - 0.5) * S * 0.5
      const ty = S / 2 + (rand() - 0.5) * S * 0.5
      const base = rand() * Math.PI * 2
      for (let k = 0; k < 6; k++) {
        const a = base + (k - 2.5) * 0.55 + (rand() - 0.5) * 0.3
        leaf(tx, ty, a, S * (0.16 + rand() * 0.1), layer * 0.35 + rand() * 0.25)
      }
    }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  // repeats across the leafy cores of crowns and bushes (the cards use it once)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  leafTex = upgradeTexture(t, 'leaf-albedo.webp')
  return t
}

/** Leaf cards over a crown's surface, facing outward, so the silhouette breaks into foliage.
 *  Normals lean out from the surface for soft, rounded light; colours keep the crown's shading. */
function leafCards(base: THREE.BufferGeometry, count: number, size: number, seed: number, scatter = 0) {
  const rand = seededRand(seed)
  const g = base.index ? base.toNonIndexed() : base
  const p = g.attributes.position as THREE.BufferAttribute
  const c = g.attributes.color as THREE.BufferAttribute | undefined
  const tris = p.count / 3
  const area = new Float32Array(tris)
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const d = new THREE.Vector3()
  let total = 0
  for (let t = 0; t < tris; t++) {
    a.fromBufferAttribute(p, t * 3)
    b.fromBufferAttribute(p, t * 3 + 1).sub(a)
    d.fromBufferAttribute(p, t * 3 + 2).sub(a)
    total += b.cross(d).length() / 2
    area[t] = total
  }
  const pos = new Float32Array(count * 6 * 3)
  const nor = new Float32Array(count * 6 * 3)
  const uv = new Float32Array(count * 6 * 2)
  const col = new Float32Array(count * 6 * 3)
  const P = new THREE.Vector3()
  const N = new THREE.Vector3()
  const T = new THREE.Vector3()
  const B = new THREE.Vector3()
  const q = new THREE.Vector3()
  const corners: [number, number][] = [
    [-0.5, -0.5],
    [0.5, -0.5],
    [0.5, 0.5],
    [-0.5, -0.5],
    [0.5, 0.5],
    [-0.5, 0.5],
  ]
  for (let i = 0; i < count; i++) {
    const r = rand() * total
    let lo = 0
    let hi = tris - 1
    while (lo < hi) {
      const m = (lo + hi) >> 1
      if (area[m] < r) lo = m + 1
      else hi = m
    }
    const t = lo
    let u = rand()
    let v = rand()
    if (u + v > 1) {
      u = 1 - u
      v = 1 - v
    }
    a.fromBufferAttribute(p, t * 3)
    b.fromBufferAttribute(p, t * 3 + 1)
    d.fromBufferAttribute(p, t * 3 + 2)
    P.copy(a).addScaledVector(b.clone().sub(a), u).addScaledVector(d.clone().sub(a), v)
    N.copy(b).sub(a).cross(d.clone().sub(a)).normalize()
    // tilt each card a little, and spin it about its normal
    N.x += (rand() - 0.5) * 0.5
    N.y += (rand() - 0.5) * 0.5 + 0.15
    N.z += (rand() - 0.5) * 0.5
    N.normalize()
    T.set(0, 1, 0).cross(N)
    if (T.lengthSq() < 1e-4) T.set(1, 0, 0)
    T.normalize().applyAxisAngle(N, rand() * Math.PI * 2)
    B.copy(N).cross(T)
    const s = size * (0.75 + rand() * 0.5)
    // the crown's shading, deepened underneath: leaves on the underside sit in shade
    const k0 = c ? c.getX(t * 3) : 1
    const k = k0 * (0.55 + 0.45 * Math.min(1, k0 / 0.75))
    const flip = rand() < 0.5
    // some cards sit in the crown's surface, some stand well out of it: no clean ball outline
    // (scatter, in the crown's own units, throws some much further out, breaking the rim)
    const lift = s * 0.04 + rand() * (s * 0.34 + scatter)
    corners.forEach(([x, y], j) => {
      q.copy(P).addScaledVector(N, lift).addScaledVector(T, x * s).addScaledVector(B, y * s)
      pos.set([q.x, q.y, q.z], (i * 6 + j) * 3)
      const n = N.clone().addScaledVector(T, x * 0.8).addScaledVector(B, y * 0.8).normalize()
      nor.set([n.x, n.y, n.z], (i * 6 + j) * 3)
      uv.set([flip ? 0.5 - x : x + 0.5, y + 0.5], (i * 6 + j) * 2)
      col.set([k, k, k * 0.95], (i * 6 + j) * 3)
    })
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  out.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return out
}

let leafNrm: THREE.Texture | null = null
function leafMaterial() {
  leafNrm ??= flatNormal('leaf-normal.webp')
  const m = new THREE.MeshStandardMaterial({ map: leafTexture(), normalMap: leafNrm, normalScale: new THREE.Vector2(0.8, 0.8), alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true, roughness: 0.75 })
  addCoverage(m)
  keepCrownNormals(m)
  return m
}

/** Foliage cards are two-sided, with soft normals leaning out from the crown. three.js turns the
 *  normal round on a card's back face, which on half the cards points it into the crown and at
 *  the sun behind it: seen against the light they glowed pale, the rest went black. Keep the
 *  crown's own normal on both faces. */
function keepCrownNormals(m: THREE.Material) {
  patch(m, 'crown-normals', (s) => {
    s.fragmentShader = s.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''))
  })
}

/** Cut-out leaves and needles thin away as their texture shrinks into its smaller mipmaps (crowns
 *  go vague at a distance): raise the coverage with the mip level, so a crown stays as full as up
 *  close. */
function addCoverage(m: THREE.MeshStandardMaterial) {
  patch(m, 'leaf-coverage', (s) => {
    s.fragmentShader = s.fragmentShader.replace(
      '#include <alphatest_fragment>',
      `#ifdef USE_MAP
        vec2 texel = vMapUv * vec2(textureSize(map, 0));
        float lod = 0.5 * log2(max(dot(dFdx(texel), dFdx(texel)), dot(dFdy(texel), dFdy(texel))));
        diffuseColor.a *= 1.0 + max(lod, 0.0) * 0.3;
      #endif
      #include <alphatest_fragment>`,
    )
  })
}

// Wind sway for a single (non-instanced) mesh: a gentle bend by height.
/** Chain a shader patch onto a material (sway, leaf coverage, leafy core), giving each
 *  combination of patches its own compiled program. */
function patch(mat: THREE.Material, key: string, fn: (s: THREE.WebGLProgramParametersWithUniforms) => void) {
  const prev = mat.onBeforeCompile
  mat.onBeforeCompile = (s, r) => {
    prev.call(mat, s, r)
    fn(s)
  }
  const k = `${mat.userData.patchKey ?? mat.type}|${key}`
  mat.userData.patchKey = k
  mat.customProgramCacheKey = () => k
}

// Wind sway for a single (non-instanced) mesh: a gentle bend by height.
function addSwayStatic(mat: THREE.MeshStandardMaterial, amount: number) {
  patch(mat, `sway-static-${amount}`, (shader) => {
    shader.uniforms.uTime = uTime
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float ph = uTime * 0.9 + position.x * 0.05;
        transformed.x += sin(ph) * position.y * ${amount.toFixed(4)};`,
      )
  })
}

// Wind sway: bend the vertex by height, phase from the instance position.
function addSway(mat: THREE.MeshStandardMaterial, amount: number) {
  patch(mat, `sway-${amount}`, (shader) => {
    shader.uniforms.uTime = uTime
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec3 ip = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
        float bend = pow(max(position.y, 0.0), 1.6) * ${amount.toFixed(4)};
        float ph = uTime * 1.3 + ip.x * 0.11 + ip.z * 0.07;
        transformed.x += sin(ph) * bend + sin(ph * 2.7) * bend * 0.3;
        transformed.z += cos(ph * 0.8) * bend * 0.6;`,
      )
  })
}

/** The inside of a bush or crown: deep leaves in shade. The leaf render is mapped onto it from
 *  three sides and it takes little direct sun, so where the outer leaves part one sees more
 *  leaves further in, never the smooth surface of a ball. */
function coreMaterial(color: THREE.ColorRepresentation) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.95, vertexColors: true })
  const tex = leafTexture()
  patch(m, 'core', (s) => {
    s.uniforms.uLeaf = { value: tex }
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCoreP;\nvarying vec3 vCoreN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCoreP = position * 2.6;\nvCoreN = normal;')
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uLeaf;\nvarying vec3 vCoreP;\nvarying vec3 vCoreN;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        vec3 bw = pow(abs(normalize(vCoreN)), vec3(4.0));
        bw /= bw.x + bw.y + bw.z;
        vec3 lf = texture2D(uLeaf, vCoreP.yz).rgb * bw.x + texture2D(uLeaf, vCoreP.xz).rgb * bw.y + texture2D(uLeaf, vCoreP.xy).rgb * bw.z;
        diffuseColor.rgb *= lf * 1.15;`,
      )
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.directDiffuse *= 0.45;\nreflectedLight.directSpecular *= 0.0;')
  })
  return m
}

let barkTex: THREE.Texture | null = null
/** Bark (tools/blender/bark.py: furrowed plates, lichen) mapped by world position from three
 *  sides, so it keeps its scale on every trunk, root and limb however each is stretched. */
function barkMaterial(color: THREE.ColorRepresentation) {
  if (!barkTex) {
    barkTex = solidTexture('#7d6f62', 'bark-albedo.webp')
    if (barkTex) barkTex.wrapS = barkTex.wrapT = THREE.RepeatWrapping
  }
  const m = new THREE.MeshStandardMaterial({ color, roughness: 1 })
  const tex = barkTex
  patch(m, 'bark', (s) => {
    s.uniforms.uBark = { value: tex }
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBarkP;\nvarying vec3 vBarkN;')
      .replace(
        '#include <project_vertex>',
        `vec4 bp = vec4(transformed, 1.0);
        vec3 bn = objectNormal;
        #ifdef USE_INSTANCING
          bp = instanceMatrix * bp;
          bn = mat3(instanceMatrix) * bn;
        #endif
        vBarkP = (modelMatrix * bp).xyz;
        vBarkN = mat3(modelMatrix) * bn;
        #include <project_vertex>`,
      )
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uBark;\nvarying vec3 vBarkP;\nvarying vec3 vBarkN;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        vec3 bw = pow(abs(normalize(vBarkN)), vec3(4.0));
        bw /= bw.x + bw.y + bw.z;
        // a tile is ~0.5 m round and 1 m up the trunk
        vec3 bk = texture2D(uBark, vec2(vBarkP.z * 2.0, vBarkP.y)).rgb * bw.x
          + texture2D(uBark, vec2(vBarkP.x * 2.0, vBarkP.z * 2.0)).rgb * bw.y
          + texture2D(uBark, vec2(vBarkP.x * 2.0, vBarkP.y)).rgb * bw.z;
        diffuseColor.rgb *= bk * 1.4;`,
      )
  })
  return m
}

/** Shape a cylinder (radius 1, height 1, base at y = 0) vertex by vertex: f(angle, t 0..1 up)
 *  returns [radius, dx, dz]. */
function shapeCylinder(g: THREE.BufferGeometry, f: (a: number, t: number) => [number, number, number]) {
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const z = p.getZ(i)
    const t = p.getY(i)
    const [r, dx, dz] = f(Math.atan2(z, x), t)
    p.setXYZ(i, x * r + dx, t, z * r + dz)
  }
  g.computeVertexNormals()
  return g
}

/** Casuarinas, as they stand in the plantations along the Odisha coast: a tall straight trunk with
 *  thin branches spiralling up it, rising and spreading, each hung with tufts of fine drooping
 *  branchlets (a tuft rendered in Blender, tools/blender/foliage.py) — an open, see-through crown,
 *  narrowing toward the top. Built at 17 m and scaled to each tree. Instanced, wind-swayed. */
const CAS_H = 17
let branchletTex: THREE.Texture | null = null
let branchletNrm: THREE.Texture | null = null
export function casuarinaMeshes(trees: TreePlacement[]) {
    const rand = seededRand(5)
    const wood: THREE.BufferGeometry[] = []
    const trunk = new THREE.CylinderGeometry(0.1, 0.26, CAS_H, 7, 6)
    trunk.translate(0, CAS_H / 2, 0)
    wood.push(trunk)
    const tufts: THREE.BufferGeometry[] = []
    const tuft = (p: THREE.Vector3, w: number) => {
      const yaw = rand() * Math.PI
      const out = new THREE.Vector3(p.x, 0, p.z)
      if (out.lengthSq() < 1e-4) out.set(Math.cos(yaw), 0, Math.sin(yaw))
      out.normalize()
      for (const turn of [0, Math.PI / 2]) {
        const h = w * 1.5
        const g = new THREE.PlaneGeometry(w, h)
        // the twig runs along the card's top edge, at the branch
        g.translate(0, -h / 2 + 0.25, 0)
        g.rotateX((rand() - 0.5) * 0.3)
        g.rotateY(yaw + turn)
        // normals out from the trunk and up, for soft light all round the crown
        const n = g.attributes.normal
        for (let k = 0; k < n.count; k++) n.setXYZ(k, out.x * 0.7, 0.55, out.z * 0.7)
        g.translate(p.x, p.y, p.z)
        tufts.push(g.toNonIndexed())
      }
    }
    const branches = 24
    for (let i = 0; i < branches; i++) {
      const t = 0.36 + (i / (branches - 1)) * 0.58
      const a = i * 2.39996 + rand() * 0.4
      const e = 0.55 + rand() * 0.4
      const len = Math.pow(1 - (t - 0.36) / 0.62, 0.7) * 4.2 + 0.9 + rand() * 0.8
      const d = new THREE.Vector3(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e))
      const base = new THREE.Vector3(0, t * CAS_H, 0)
      const g = new THREE.CylinderGeometry(0.025, 0.07, len, 5)
      g.translate(0, len / 2, 0)
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d))
      g.translate(base.x, base.y, base.z)
      wood.push(g.toNonIndexed())
      const n = 3 + Math.floor(rand() * 3)
      for (let k = 0; k < n; k++) {
        const f = 0.3 + (k / (n - 1)) * 0.7
        tuft(base.clone().addScaledVector(d, len * f), 1.1 + rand() * 0.9)
      }
    }
    // and a few at the leader, so the crown ends in a soft point
    for (let k = 0; k < 3; k++) tuft(new THREE.Vector3((rand() - 0.5) * 0.5, CAS_H + 0.6 - k * 0.5, (rand() - 0.5) * 0.5), 1.0 + rand() * 0.5)
    const trunkGeo = mergeGeometries(wood.map((g) => (g.index ? g.toNonIndexed() : g)))!
    const foliageGeo = mergeGeometries(tufts)!
    const trunkMat = barkMaterial('#6a5646')
    // a dull grey-green (on the material: these cards have no vertex colours)
    branchletTex ??= solidTexture('#00000000', 'branchlet-albedo.webp')
    branchletNrm ??= flatNormal('branchlet-normal.webp')
    const foliageMat = new THREE.MeshStandardMaterial({ map: branchletTex, normalMap: branchletNrm, normalScale: new THREE.Vector2(0.5, 0.5), alphaTest: 0.4, color: '#3d4733', roughness: 0.95, side: THREE.DoubleSide })
    addCoverage(foliageMat)
    keepCrownNormals(foliageMat)
    addSway(trunkMat, 0.0025)
    addSway(foliageMat, 0.0025)
    const t = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length)
    const f = new THREE.InstancedMesh(foliageGeo, foliageMat, trees.length)
    const o = new THREE.Object3D()
    trees.forEach((tr, i) => {
      o.position.set(tr.x, 0, tr.z)
      o.rotation.set(0, (tr.x * 13.1 + tr.z * 7.7) % (Math.PI * 2), 0)
      o.scale.setScalar(tr.h / CAS_H)
      o.updateMatrix()
      t.setMatrixAt(i, o.matrix)
      f.setMatrixAt(i, o.matrix)
    })
    for (const m of [t, f]) {
      m.castShadow = true
      m.receiveShadow = true
      m.computeBoundingSphere()
    }
    return { trunk: t, foliage: f }
}

export function Casuarinas({ trees }: { trees: TreePlacement[] }) {
  const { trunk, foliage } = useMemo(() => casuarinaMeshes(trees),  [trees])
  useEffect(
    () => () => {
      for (const m of [trunk, foliage]) {
        m.geometry.dispose()
        ;(m.material as THREE.Material).dispose()
      }
    },
    [trunk, foliage],
  )
  useFrame((_, dt) => {
    uTime.value += dt
  })
  return (
    <>
      <primitive object={trunk} />
      <primitive object={foliage} />
    </>
  )
}


export interface Broadleaf {
  x: number
  z: number
  /** crown radius (m) */
  r: number
  h: number
}

/** A broadleaf crown as a cluster of leaf masses: a broken, irregular silhouette with gaps of
 *  sky, flatter underneath; dark in the hollows and under the canopy, lit on top. */
function clumpCrown(seed: number, clumps: number, spread: number) {
  const rand = seededRand(seed)
  const parts: THREE.BufferGeometry[] = []
  for (let j = 0; j < clumps; j++) {
    const a = rand() * Math.PI * 2
    const up = j === 0 ? 0.3 : rand() * 1.1 - 0.35
    const d = j === 0 ? 0 : (0.45 + rand() * 0.4) * spread
    const s = (j === 0 ? 0.62 : 0.34 + rand() * 0.24) * (spread > 1.2 ? 0.85 : 1)
    const g = crownGeometry(1, seed * 7 + j)
    g.deleteAttribute('color')
    g.scale(s, s * 0.92, s)
    g.translate(Math.cos(a) * d, Math.max(-0.25, up * 0.8), Math.sin(a) * d)
    parts.push(g)
  }
  const g = mergeGeometries(parts)!
  const p = g.attributes.position
  const col = new Float32Array(p.count * 3)
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const y = p.getY(i)
    const z = p.getZ(i)
    const out = Math.min(1, Math.hypot(x, z) / spread)
    const speck = Math.sin(x * 19 + z * 23 + y * 11 + seed) * 0.5 + 0.5
    const k = 0.32 + 0.45 * THREE.MathUtils.smoothstep(y, -0.4, 0.75) + 0.18 * out + speck * 0.1
    col.set([k, k, k * 0.92], i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}

/** A trunk that forks into limbs reaching up into the crown. */
function forkedTrunk(limbs: number, seed: number) {
  const rand = seededRand(seed)
  const parts: THREE.BufferGeometry[] = []
  const t = new THREE.CylinderGeometry(0.06, 0.11, 1, 7)
  t.translate(0, 0.5, 0)
  parts.push(t)
  for (let k = 0; k < limbs; k++) {
    const a = (k / limbs) * Math.PI * 2 + rand() * 0.8
    const lean = 0.5 + rand() * 0.35
    const len = 0.5 + rand() * 0.25
    const g = new THREE.CylinderGeometry(0.025, 0.05, len, 5)
    g.translate(0, len / 2, 0)
    g.rotateZ(lean)
    g.rotateY(a)
    g.translate(0, 0.88, 0)
    parts.push(g)
  }
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)))!
}

/** Broadleaf trees (mango, neem, jamun): a forked trunk and a clumped crown. Instanced. */
/** One broadleaf tree's shapes, built once per detail level. `lite`: a crown of fewer, larger
 *  leaf cards, for trees seen only from a distance (and every tree on a phone). */
const broadleafCache = new Map<boolean, { trunkGeo: THREE.BufferGeometry; crownGeo: THREE.BufferGeometry; leafGeo: THREE.BufferGeometry; mats: THREE.MeshStandardMaterial[] }>()
function broadleafParts(lite: boolean) {
  let c = broadleafCache.get(lite)
  if (!c) {
    const trunkGeo = forkedTrunk(3, 2)
    const crownGeo = clumpCrown(3, 8, 1)
    const leafGeo = lite ? leafCards(crownGeo, 450, 0.36, 5, 0.12) : leafCards(crownGeo, 1700, 0.22, 5, 0.14)
    // the crown's mass is the shadowed inside of the tree; the leaf cards make its surface
    crownGeo.scale(0.9, 0.9, 0.9)
    const trunkMat = barkMaterial('#5a4636')
    const crownMat = coreMaterial('#8c8c8c')
    const leafMat = leafMaterial()
    addSway(crownMat, 0.012)
    addSway(leafMat, 0.012)
    broadleafCache.set(lite, (c = { trunkGeo, crownGeo, leafGeo, mats: [trunkMat, crownMat, leafMat] }))
  }
  return c
}

export function broadleafMeshes(trees: Broadleaf[], low: boolean, lite = false) {
    void low
    const { trunkGeo, crownGeo, leafGeo, mats } = broadleafParts(lite)
    const [trunkMat, crownMat, leafMat] = mats
    const t = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length)
    const c = new THREE.InstancedMesh(crownGeo, crownMat, trees.length)
    const l = new THREE.InstancedMesh(leafGeo, leafMat, trees.length)
    const o = new THREE.Object3D()
    const col = new THREE.Color()
    trees.forEach((tr, i) => {
      const rot = (tr.x * 13.1 + tr.z * 7.7) % (Math.PI * 2)
      o.position.set(tr.x, 0, tr.z)
      o.rotation.set(0, rot, 0)
      o.scale.set(tr.r * 1.1, tr.h * 0.62, tr.r * 1.1)
      o.updateMatrix()
      t.setMatrixAt(i, o.matrix)
      o.position.set(tr.x, tr.h * 0.66, tr.z)
      // each tree a little different in shape: squash and stretch the shared crown
      const sx = 0.85 + ((i * 0.29) % 1) * 0.3
      o.scale.set(tr.r * sx, tr.r * (0.98 + ((i * 0.47) % 1) * 0.22), tr.r * (2 - sx))
      o.updateMatrix()
      c.setMatrixAt(i, o.matrix)
      l.setMatrixAt(i, o.matrix)
      // deep, varied greens (mango is almost black-green; neem lighter), as in aerial photos
      col.setHSL(0.24 + ((i * 0.37) % 1) * 0.07, 0.34 + ((i * 0.53) % 1) * 0.14, 0.12 + ((i * 0.61) % 1) * 0.07)
      c.setColorAt(i, col)
      l.setColorAt(i, col)
    })
    for (const m of [t, c, l]) {
      m.castShadow = true
      m.receiveShadow = true
      m.computeBoundingSphere()
    }
    return { trunk: t, crown: c, leaves: l }
}

export interface Banyan {
  x: number
  z: number
  /** canopy radius (m) */
  r: number
  h: number
}

/** The great banyan: a broad, low, spreading canopy on a thick trunk and many prop roots. */
export function banyanMeshes(b: Banyan) {
  const rand = seededRand(41)
  const wood: THREE.BufferGeometry[] = []
  // the trunk: fluted, many old roots fused together, flaring at the foot
  const th = b.h * 0.55
  const trunk = shapeCylinder(new THREE.CylinderGeometry(1, 1, 1, 28, 14).translate(0, 0.5, 0), (a, t) => {
    const r = b.r * (0.13 - 0.05 * t) * (1 + 0.16 * Math.sin(a * 7 + t * 2.5) + 0.06 * Math.sin(a * 13 - t * 4)) * (1 + 0.7 * Math.exp((-t * th) / 0.9))
    return [r, 0, 0]
  })
  trunk.scale(1, th, 1)
  trunk.translate(b.x, 0, b.z)
  wood.push(trunk)
  // aerial roots dropped from the branches: knotted, wandering a little, thickened and flared
  // where they reached the ground, some in twos and threes twisted together
  const root = (x: number, z: number, top: number, r0: number, r1: number, seed: number) => {
    const g = shapeCylinder(new THREE.CylinderGeometry(1, 1, 1, 8, 16, true).translate(0, 0.5, 0), (a, t) => {
      const h = t * top
      const r = (r1 + (r0 - r1) * t) * (1 + 0.16 * Math.sin(t * 29 + seed) * Math.sin(a * 3 + seed)) * (1 + 1.6 * Math.exp(-h / 0.3))
      return [r, Math.sin(t * 4.3 + seed) * 0.09 * (1 - t), Math.cos(t * 3.7 + seed * 2) * 0.09 * (1 - t)]
    })
    g.scale(1, top, 1)
    g.translate(x, 0, z)
    wood.push(g)
  }
  for (let k = 0; k < 26; k++) {
    const a = rand() * Math.PI * 2
    const d = b.r * (0.25 + rand() * 0.6)
    const top = b.h * (0.5 + rand() * 0.1)
    const x = b.x + Math.cos(a) * d
    const z = b.z + Math.sin(a) * d
    const r1 = 0.1 + rand() * 0.14
    root(x, z, top, 0.05 + rand() * 0.05, r1, k * 3.1)
    const twins = rand() < 0.5 ? 1 + Math.floor(rand() * 2) : 0
    for (let j = 0; j < twins; j++) {
      const o = rand() * Math.PI * 2
      root(x + Math.cos(o) * r1 * 1.3, z + Math.sin(o) * r1 * 1.3, top * (0.96 + rand() * 0.04), 0.03, r1 * 0.55, k * 3.1 + j + 1.7)
    }
  }
  // great limbs out to the canopy edge
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + rand() * 0.4
    const len = b.r * (0.6 + rand() * 0.3)
    // tapering, bending up toward its end, knotted where side branches left it
    const sd = k * 1.9
    const g = shapeCylinder(new THREE.CylinderGeometry(1, 1, 1, 10, 14).translate(0, 0.5, 0), (an, t) => {
      const r = (0.3 - 0.2 * t) * (1 + 0.12 * Math.sin(t * 17 + sd) * Math.sin(an * 2 + sd))
      return [r, -Math.sin(t * Math.PI * 0.8) * 0.35 + Math.sin(t * 6 + sd) * 0.08, Math.sin(t * 5 + sd) * 0.12]
    })
    g.scale(1, len, 1)
    g.rotateZ(1.25)
    g.rotateY(a)
    g.translate(b.x, b.h * 0.5, b.z)
    wood.push(g)
  }
  const woodGeo = mergeGeometries(wood.map((g) => (g.index ? g.toNonIndexed() : g)))!
  const crownGeo = clumpCrown(12, 38, 1.6)
  crownGeo.scale(b.r * 0.72, b.h * 0.32, b.r * 0.72)
  crownGeo.translate(b.x, b.h * 0.72, b.z)
  const leafGeo = leafCards(crownGeo, 11000, 0.8, 23, 1.4)
  const green = new THREE.Color().setHSL(0.27, 0.36, 0.13)
  const crownMat = coreMaterial(green.clone().multiplyScalar(0.85))
  const leafMat = leafMaterial()
  leafMat.color.copy(green)
  addSwayStatic(crownMat, 0.004)
  addSwayStatic(leafMat, 0.004)
  // banyan bark is pale grey
  const w = new THREE.Mesh(woodGeo, barkMaterial('#a39888'))
  const c = new THREE.Mesh(crownGeo, crownMat)
  const l = new THREE.Mesh(leafGeo, leafMat)
  for (const m of [w, c, l]) {
    m.castShadow = true
    m.receiveShadow = true
  }
  return { wood: w, crown: c, leaves: l }
}

export function BanyanTree({ tree }: { tree: Banyan }) {
  const { wood, crown, leaves } = useMemo(() => banyanMeshes(tree), [tree])
  useEffect(
    () => () => {
      for (const m of [wood, crown, leaves]) {
        m.geometry.dispose()
        ;(m.material as THREE.Material).dispose()
      }
    },
    [wood, crown, leaves],
  )
  return (
    <>
      <primitive object={wood} />
      <primitive object={crown} />
      <primitive object={leaves} />
    </>
  )
}

/** Broadleaf trees, drawn in groups: those near the walk (`near`) keep their dense crowns, the
 *  rest a lighter one (all of them on a phone); and each set is split into eight sectors round
 *  the site, so the trees behind the eye are culled instead of drawn. */
export function BroadleafTrees({ trees, low, near }: { trees: Broadleaf[]; low: boolean; near?: (x: number, z: number) => boolean }) {
  const meshes = useMemo(() => {
    const cx = trees.reduce((a, t) => a + t.x, 0) / Math.max(1, trees.length)
    const cz = trees.reduce((a, t) => a + t.z, 0) / Math.max(1, trees.length)
    const groups = new Map<string, Broadleaf[]>()
    for (const t of trees) {
      const lite = low || !near?.(t.x, t.z)
      const sector = Math.floor(((Math.atan2(t.z - cz, t.x - cx) + Math.PI) / (Math.PI * 2)) * 8) % 8
      const k = `${lite ? 1 : 0}-${sector}`
      let g = groups.get(k)
      if (!g) groups.set(k, (g = []))
      g.push(t)
    }
    return [...groups.entries()].flatMap(([k, g]) => {
      const { trunk, crown, leaves } = broadleafMeshes(g, low, k.startsWith('1'))
      return [trunk, crown, leaves]
    })
  }, [trees, low, near])
  // the shapes and materials are shared and kept for the session; only the instances go
  useEffect(() => () => meshes.forEach((m) => m.dispose()), [meshes])
  return (
    <>
      {meshes.map((m) => (
        <primitive key={m.uuid} object={m} />
      ))}
    </>
  )
}

export interface Shrub {
  x: number
  z: number
  r: number
  /** 0 = green, 1 = in yellow flower */
  bloom: number
}

/** Clipped shrubs along the paths, many in yellow flower. */
export function shrubMesh(shrubs: Shrub[]) {
    return shrubMeshes(shrubs).body
}

/** Shrubs as a dark body under a skin of leaf cards (the body alone is what the bake sees). */
export function shrubMeshes(shrubs: Shrub[], low = false) {
    const geo = crownGeometry(1, 3)
    // a clipped mound, settled into the lawn rather than a ball resting on it
    geo.translate(0, 0.6, 0)
    const leafGeo = low ? leafCards(geo, 380, 0.36, 9, 0.05) : leafCards(geo, 900, 0.26, 9, 0.06)
    geo.scale(0.9, 0.9, 0.9)
    geo.translate(0, 0.07, 0)
    // the body is the deep shade inside the bush, seen only through gaps in the leaves
    const mat = coreMaterial('#909090')
    const m = new THREE.InstancedMesh(geo, mat, shrubs.length)
    const l = new THREE.InstancedMesh(leafGeo, leafMaterial(), shrubs.length)
    const o = new THREE.Object3D()
    const col = new THREE.Color()
    shrubs.forEach((sh, i) => {
      o.position.set(sh.x, 0, sh.z)
      o.rotation.set(0, i * 1.7, 0)
      o.scale.set(sh.r, sh.r * 0.9, sh.r)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      l.setMatrixAt(i, o.matrix)
      if (sh.bloom > 0.5) col.setHSL(0.12 + ((i * 0.31) % 1) * 0.03, 0.62, 0.42 + ((i * 0.7) % 1) * 0.06)
      else col.setHSL(0.25, 0.45, 0.24 + ((i * 0.7) % 1) * 0.06)
      m.setColorAt(i, col)
      l.setColorAt(i, col)
    })
    for (const x of [m, l]) {
      x.castShadow = true
      x.receiveShadow = true
      x.computeBoundingSphere()
    }
    return { body: m, leaves: l }
}

export function Shrubs({ shrubs, low = false }: { shrubs: Shrub[]; low?: boolean }) {
  const { body, leaves } = useMemo(() => shrubMeshes(shrubs, low), [shrubs, low])
  useEffect(
    () => () => {
      body.geometry.dispose()
      leaves.geometry.dispose()
    },
    [body, leaves],
  )
  return (
    <>
      <primitive object={body} />
      <primitive object={leaves} />
    </>
  )
}

export interface Palm {
  x: number
  z: number
  h: number
}

/** Coconut palms: a slender leaning trunk ringed with old leaf scars, swelling at the foot, and a
 *  crown of arching fronds (a frond rendered in Blender: midrib and drooping leaflets), with a
 *  bunch of coconuts under it. Sizes are fractions of the palm's height. */
export function palmMeshes(palms: Palm[]) {
    const trunkGeo = new THREE.CylinderGeometry(0.014, 0.02, 1, 10, 90)
    trunkGeo.translate(0, 0.5, 0)
    const tp = trunkGeo.attributes.position
    const tc = new Float32Array(tp.count * 3)
    for (let i = 0; i < tp.count; i++) {
      const y = tp.getY(i)
      // the foot swells; every ~12 cm a ridge where a frond fell
      const ring = Math.abs(((y * 90) % 1) - 0.5) < 0.12 ? 1.07 : 1
      const k = (1 + Math.max(0, 0.06 - y) * 10) * ring
      tp.setX(i, tp.getX(i) * k + Math.pow(y, 2) * 0.12)
      tp.setZ(i, tp.getZ(i) * k)
      const shade = ring > 1 ? 0.78 : 0.95 + 0.05 * Math.sin(y * 37)
      tc.set([shade, shade, shade], i * 3)
    }
    trunkGeo.setAttribute('color', new THREE.BufferAttribute(tc, 3))
    trunkGeo.computeVertexNormals()
    // coconuts, and the boss the fronds spring from
    const nuts: THREE.BufferGeometry[] = [trunkGeo.toNonIndexed()]
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2
      const g = new THREE.SphereGeometry(0.012, 8, 6)
      g.translate(0.12 + Math.cos(a) * 0.022, 0.975 - (k % 2) * 0.012, Math.sin(a) * 0.022)
      nuts.push(g.toNonIndexed())
    }
    const boss = new THREE.SphereGeometry(0.026, 10, 8)
    boss.scale(1, 1.3, 1)
    boss.translate(0.12, 1.0, 0)
    nuts.push(boss.toNonIndexed())
    for (const g of nuts.slice(1)) {
      const c = new Float32Array(g.attributes.position.count * 3).fill(0.7)
      g.setAttribute('color', new THREE.BufferAttribute(c, 3))
    }
    const solid = mergeGeometries(nuts)!
    const leaves: THREE.BufferGeometry[] = []
    // two tiers: the upper fronds rising, the older ones below arching over and drooping
    const tiers: [number, number, number][] = [
      [10, -0.55, 0],
      [7, 0.05, 0.3],
    ]
    for (const [n, tilt, off] of tiers) {
      for (let k = 0; k < n; k++) {
        const len = 0.5 + ((k * 0.37) % 1) * 0.1
        const g = new THREE.PlaneGeometry(0.15, len, 2, 10)
        const p = g.attributes.position
        for (let i = 0; i < p.count; i++) {
          const y = p.getY(i) + len / 2
          const x = p.getX(i)
          // folded up along the midrib, arching out and down toward the tip
          p.setXYZ(i, x, y * 0.95, -(y * y) * 1.0 + Math.abs(x) * 0.25)
        }
        g.computeVertexNormals()
        g.rotateX(tilt)
        g.rotateY(((k + off) / n) * Math.PI * 2)
        g.translate(0.12, 1, 0)
        leaves.push(g)
      }
    }
    const frondGeo = mergeGeometries(leaves)!
    const t = new THREE.InstancedMesh(solid, new THREE.MeshStandardMaterial({ color: '#8c7d68', roughness: 1, vertexColors: true }), palms.length)
    frondTex ??= solidTexture('#5b7a2e', 'frond-albedo.webp')
    frondNrm ??= flatNormal('frond-normal.webp')
    const fm = new THREE.MeshStandardMaterial({ map: frondTex, normalMap: frondNrm, normalScale: new THREE.Vector2(0.7, 0.7), alphaTest: 0.5, roughness: 0.8, side: THREE.DoubleSide })
    keepCrownNormals(fm)
    addSway(fm, 0.05)
    const f = new THREE.InstancedMesh(frondGeo, fm, palms.length)
    const o = new THREE.Object3D()
    palms.forEach((pl, i) => {
      o.position.set(pl.x, 0, pl.z)
      o.rotation.set(0, i * 2.3, 0)
      o.scale.set(pl.h, pl.h, pl.h)
      o.updateMatrix()
      t.setMatrixAt(i, o.matrix)
      f.setMatrixAt(i, o.matrix)
    })
    for (const m of [t, f]) {
      m.castShadow = true
      m.computeBoundingSphere()
    }
    return { trunk: t, fronds: f }
}

export function Palms({ palms }: { palms: Palm[] }) {
  const { trunk, fronds } = useMemo(() => palmMeshes(palms),  [palms])
  return (
    <>
      <primitive object={trunk} />
      <primitive object={fronds} />
    </>
  )
}
