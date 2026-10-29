import * as THREE from 'three'
import { friezeTextures, stoneTextures } from '../engine/textures'

export type MatKey = 'khondalite' | 'laterite' | 'chlorite' | 'frieze' | 'sand' | 'grass' | 'path' | 'recess' | 'lawn' | 'carved'

let cache: Record<MatKey, THREE.Material> | null = null

/** Per-material state of the sculpted detail (see loadStoneDetail), shared with every shader
 *  compiled from it so it can switch on without a recompile. */
interface Detail {
  uHeight: { value: THREE.Texture }
  /** designs stacked in the atlas (one per row); each texture tile picks one */
  uRows: { value: number }
  /** relief depth in uv units (u, v); 0 until the sculpted maps arrive */
  uDepth: { value: THREE.Vector2 }
}
const flat = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
flat.needsUpdate = true
const details = new Map<MatKey, Detail>()
if (import.meta.env.DEV) Object.assign(globalThis, { __detail: details })

const DETAIL_GLSL = /* glsl */ `
uniform sampler2D uHeight;
uniform float uRows;
uniform vec2 uDepth;
vec2 dAtlas(vec2 uv) {
  if (uRows < 1.5) return uv;
  // one design per texture tile, chosen by the tile's index
  float r = floor(fract(sin(floor(uv.x) * 12.9898 + 7.13) * 43758.5453) * uRows);
  // frieze faces run v 0..1 across the band; other faces (lattice panels, pillar sides) repeat it
  float fy = uv.y >= 1.0 && uv.y < 1.0005 ? 1.0 : fract(uv.y);
  return vec2(uv.x, 1.0 - (r + 1.0) / uRows + clamp(fy, 0.004, 0.996) / uRows);
}
// parallax occlusion: march the view ray down into the carving's height field, so niches and
// figures keep their depth as you walk past (near the eye only)
void detailUv(vec2 uv, out vec2 dUv, out vec2 gx, out vec2 gy) {
  vec2 sc = vec2(1.0, uRows < 1.5 ? 1.0 : 1.0 / uRows);
  gx = dFdx(uv) * sc;
  gy = dFdy(uv) * sc;
  // every derivative first: after a per-pixel branch they are undefined
  vec3 q0 = dFdx(-vViewPosition), q1 = dFdy(-vViewPosition);
  vec2 st0 = dFdx(uv), st1 = dFdy(uv);
  // the face's own normal (stone faces are flat), as three.js finds it for flat shading
  vec3 N = normalize(cross(-q0, -q1));
  vec3 T = cross(q1, N) * st0.x + cross(N, q0) * st1.x;
  vec3 B = cross(q1, N) * st0.y + cross(N, q0) * st1.y;
  float dist = length(vViewPosition);
  float fade = clamp((32.0 - dist) / 14.0, 0.0, 1.0);
  if (uDepth.x <= 0.0 || fade <= 0.0 || dot(T, T) < 1e-20 || dot(B, B) < 1e-20) { dUv = dAtlas(uv); return; }
  T = normalize(T);
  B = normalize(B);
  vec3 V = normalize(vViewPosition);
  vec3 vt = vec3(dot(V, T), dot(V, B), dot(V, N));
  vec2 P = vt.xy / max(vt.z, 0.3) * uDepth * fade;
  const int STEPS = 14;
  float layer = 1.0 / float(STEPS);
  vec2 dt = P * layer;
  vec2 c = uv;
  float cur = 0.0;
  float d = 1.0 - textureGrad(uHeight, dAtlas(c), gx, gy).r;
  for (int i = 0; i < STEPS; i++) {
    if (cur >= d) break;
    c -= dt;
    cur += layer;
    d = 1.0 - textureGrad(uHeight, dAtlas(c), gx, gy).r;
  }
  vec2 prev = c + dt;
  float after = d - cur;
  float before = (1.0 - textureGrad(uHeight, dAtlas(prev), gx, gy).r) - cur + layer;
  c = mix(c, prev, clamp(after / (after - before + 1e-5), 0.0, 1.0));
  dUv = dAtlas(c);
}
`

// Lawns at the scale of the grounds: broad lighter and darker patches and sun-dried spots, from
// the world position, so the tiled grass never repeats across an open lawn.
export const GROUND_GLSL = /* glsl */ `
varying vec3 vWPos;
float gHash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
float gNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(gHash(i), gHash(i + vec2(1, 0)), u.x), mix(gHash(i + vec2(0, 1)), gHash(i + vec2(1, 1)), u.x), u.y);
}
`

/** The lawns' broad patches, by world position (shared with the grass tufts standing on them). */
export const LAWN_TINT = /* glsl */ `
      float gn1 = gNoise(vWPos.xz * 0.035);
      float gn2 = gNoise(vWPos.xz * 0.13 + 3.1);
      float gn3 = gNoise(vWPos.xz * 0.6 + 9.7);
      float dry = smoothstep(0.58, 0.86, gn1 * 0.65 + gn2 * 0.35);
      diffuseColor.rgb *= mix(0.8, 1.12, gn2 * 0.7 + gn3 * 0.3);
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.4, 1.2, 0.68), dry * 0.55);`

/** Sculpted detail in the shader: atlas design per tile, and parallax depth (or, for lawns,
 *  variation across the grounds). */
export function patchDetail(shader: THREE.WebGLProgramParametersWithUniforms, key: MatKey) {
  if (key === 'lawn') {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${GROUND_GLSL}`).replace(
      '#include <map_fragment>',
      `#include <map_fragment>\n${LAWN_TINT}`,
    )
    return
  }
  const d = details.get(key)
  if (!d) return
  Object.assign(shader.uniforms, d)
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${DETAIL_GLSL}`)
    .replace('void main() {', 'void main() {\n  vec2 dUv, dGx, dGy;\n  detailUv(vMapUv, dUv, dGx, dGy);')
    .replace('#include <map_fragment>', THREE.ShaderChunk.map_fragment.replace('texture2D( map, vMapUv )', 'textureGrad( map, dUv, dGx, dGy )'))
    .replace(
      '#include <normal_fragment_maps>',
      THREE.ShaderChunk.normal_fragment_maps.replaceAll('texture2D( normalMap, vNormalMapUv )', 'textureGrad( normalMap, dUv, dGx, dGy )'),
    )
}

// Shared materials, created once. Texture size drops in low quality.
export function getMaterials(low = false): Record<MatKey, THREE.Material> {
  if (cache) return cache
  const size = low ? 256 : 512
  const k = stoneTextures('khondalite', size)
  const l = stoneTextures('laterite', size)
  const c = stoneTextures('chlorite', 256)
  const s = stoneTextures('sand', size)
  const g = stoneTextures('grass', 256)
  const p = stoneTextures('path', size)
  const lw = stoneTextures('lawn', size)
  const cv = stoneTextures('carved', size)
  const f = friezeTextures(low ? 512 : 1024, low ? 128 : 256)
  cache = {
    khondalite: new THREE.MeshStandardMaterial({ ...k, roughness: 0.92, normalScale: new THREE.Vector2(0.9, 0.9) }),
    laterite: new THREE.MeshStandardMaterial({ ...l, roughness: 0.97 }),
    chlorite: new THREE.MeshPhysicalMaterial({
      ...c,
      roughness: 0.38,
      metalness: 0.05,
      clearcoat: 0.5,
      clearcoatRoughness: 0.35,
      sheen: 0.4,
      sheenColor: new THREE.Color('#4f6a5a'),
    }),
    frieze: new THREE.MeshStandardMaterial({ ...f, roughness: 0.9, normalScale: new THREE.Vector2(1.4, 1.4) }),
    sand: new THREE.MeshStandardMaterial({ ...s, roughness: 1 }),
    grass: new THREE.MeshStandardMaterial({ ...g, roughness: 1 }),
    path: new THREE.MeshStandardMaterial({ ...p, roughness: 0.95 }),
    recess: new THREE.MeshStandardMaterial({ color: '#3a2c20', roughness: 1 }),
    lawn: new THREE.MeshStandardMaterial({ ...lw, roughness: 1 }),
    carved: new THREE.MeshStandardMaterial({ ...cv, roughness: 0.9, normalScale: new THREE.Vector2(1.2, 1.2) }),
  }
  if (import.meta.env.DEV) Object.assign(globalThis, { __mats: cache })
  {
    const m = cache.lawn
    m.onBeforeCompile = (sh) => patchDetail(sh, 'lawn')
    m.customProgramCacheKey = () => 'ground-lawn'
    m.userData.detail = 'lawn'
  }
  for (const key of ['khondalite', 'frieze', 'path'] as MatKey[]) {
    details.set(key, { uHeight: { value: flat }, uRows: { value: 1 }, uDepth: { value: new THREE.Vector2(0, 0) } })
    const m = cache[key]
    m.onBeforeCompile = (sh) => patchDetail(sh, key)
    m.customProgramCacheKey = () => `detail-${key}`
    m.userData.detail = key
  }
  return cache
}

// Carved stone sculpted offline (tools/blender/relief.py): the frieze of dancers, musicians and
// elephants, weathered ashlar, dressed stone. Loaded after the walk opens and swapped into the
// procedural textures in place, so every material sharing them (baked clones too) picks it up.
// [material, set, designs in the atlas, relief depth in uv units (u, v)]
const DETAIL: [MatKey, string, number, [number, number]][] = [
  // smallest first
  ['carved', 'carved', 1, [0, 0]],
  // the lawns: a mown lawn grown and rendered in Blender (tools/blender/foliage.py), 5 m tiles
  ['lawn', 'lawn', 1, [0, 0]],
  // the paths' laterite flags: 3.6 m tiles, worn 3 cm deep at the joints
  ['path', 'paving', 1, [0.008, 0.008]],
  // the wall: 2 m tiles, 5 cm deep; the frieze: 4 × 1 band heights per tile, carving 0.06 deep
  ['khondalite', 'wall', 1, [0.025, 0.025]],
  ['frieze', 'frieze', 4, [0.015, 0.06]],
]
let detailLoaded = false

export async function loadStoneDetail(base: string) {
  if (detailLoaded || !cache) return
  detailLoaded = true
  const mats = cache
  const loader = new THREE.ImageLoader()
  const get = (file: string) => loader.loadAsync(base + file).catch(() => null)
  // one material at a time, small sets first, so the shared connection isn't flooded; each
  // material's maps are swapped together, so albedo and relief never disagree
  for (const [key, name, rows, depth] of DETAIL) {
    const m = mats[key] as THREE.MeshStandardMaterial
    const d = details.get(key)
    const [alb, nrm, hgt] = await Promise.all([
      m.map ? get(`${name}-albedo.webp`) : null,
      m.normalMap ? get(`${name}-normal.webp`) : null,
      d ? get(`${name}-height.webp`) : null,
    ])
    for (const [tex, img] of [[m.map, alb], [m.normalMap, nrm]] as const) {
      if (!tex || !img) continue
      // a texture already on the GPU keeps its old (smaller) storage: free it, so the next
      // upload allocates at the new size
      tex.dispose()
      tex.image = img
      tex.needsUpdate = true
    }
    // the sculpted normals are true slopes; the procedural ones were exaggerated
    if (nrm) m.normalScale.set(1, 1)
    if (d) d.uRows.value = rows
    if (d && hgt) {
      const t = new THREE.Texture(hgt)
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.colorSpace = THREE.NoColorSpace
      t.needsUpdate = true
      d.uHeight.value = t
      d.uDepth.value.set(...depth)
    }
  }
}

