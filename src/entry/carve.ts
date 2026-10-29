import * as THREE from 'three'

// Carving a drawing into stone. You draw on two canvases:
//   groove  — white where stone is cut away (brighter = deeper)
//   arrival — when each groove gets carved, 0..1 as grey (white = never); drives the animation
//   inlay   — optional, white where gold leaf is laid into the cut (the live site's icon)
// bakeCarving turns them into a normal map (so light rakes the grooves) and a packed
// texture the stone shader reads; carvedMaterial reveals the cut as uProgress goes 0 → 1.

export interface CarveCanvases {
  w: number
  h: number
  groove: CanvasRenderingContext2D
  arrival: CanvasRenderingContext2D
  inlay: CanvasRenderingContext2D
}

export function carveCanvases(w: number, h: number): CarveCanvases {
  const mk = (bg: string) => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const g = c.getContext('2d')!
    g.fillStyle = bg
    g.fillRect(0, 0, w, h)
    g.lineCap = 'round'
    g.lineJoin = 'round'
    return g
  }
  return { w, h, groove: mk('#000'), arrival: mk('#fff'), inlay: mk('#000') }
}

/** Grey for an arrival time t (0..1). */
export const at = (t: number) => {
  const v = Math.round(Math.min(1, Math.max(0, t)) * 250)
  return `rgb(${v},${v},${v})`
}

function blur(src: Float32Array, w: number, h: number, passes: number) {
  let a = src
  for (let p = 0; p < passes; p++) {
    const b = new Float32Array(w * h)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let s = 0
        for (let dy = -1; dy <= 1; dy++) {
          const yy = Math.min(h - 1, Math.max(0, y + dy)) * w
          for (let dx = -1; dx <= 1; dx++) s += a[yy + Math.min(w - 1, Math.max(0, x + dx))]
        }
        b[y * w + x] = s / 9
      }
    a = b
  }
  return a
}

/** The stone's own surface under a carving: heights in metres, one per canvas pixel. */
export interface Surface {
  height: Float32Array
  /** canvas pixels per metre */
  px: number
}

export function bakeCarving(c: CarveCanvases, strength = 7, surface?: Surface) {
  const { w, h } = c
  // the stone's grain and wear tilt the normals as the grooves do (the carving cuts into it)
  const sh = surface && surface.height.length === w * h ? surface.height : null
  const sk = surface ? surface.px / 2 : 0
  const gd = c.groove.getImageData(0, 0, w, h).data
  const ad = c.arrival.getImageData(0, 0, w, h).data
  const id = c.inlay.getImageData(0, 0, w, h).data
  const raw = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) raw[i] = gd[i * 4] / 255
  // soften the cut into a rounded V so the walls catch light
  const depth = blur(raw, w, h, 2)
  const normal = new Uint8Array(w * h * 4)
  const packed = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++) {
    // canvas rows run top→bottom; texture v runs bottom→top
    const ty = h - 1 - y
    for (let x = 0; x < w; x++) {
      const l = depth[y * w + Math.max(0, x - 1)]
      const r = depth[y * w + Math.min(w - 1, x + 1)]
      const up = depth[Math.max(0, y - 1) * w + x]
      const dn = depth[Math.min(h - 1, y + 1) * w + x]
      // surface height is -depth; tangent-space normal = (-dh/du, -dh/dv, 1)
      let nx = (r - l) * strength
      let ny = (up - dn) * strength
      if (sh) {
        nx -= (sh[y * w + Math.min(w - 1, x + 1)] - sh[y * w + Math.max(0, x - 1)]) * sk
        ny -= (sh[Math.max(0, y - 1) * w + x] - sh[Math.min(h - 1, y + 1) * w + x]) * sk
      }
      const len = Math.hypot(nx, ny, 1)
      const o = (ty * w + x) * 4
      normal[o] = ((nx / len) * 0.5 + 0.5) * 255
      normal[o + 1] = ((ny / len) * 0.5 + 0.5) * 255
      normal[o + 2] = ((1 / len) * 0.5 + 0.5) * 255
      normal[o + 3] = 255
      const i = (y * w + x) * 4
      packed[o] = ad[i]
      packed[o + 1] = Math.min(255, depth[y * w + x] * 255 * 1.4)
      packed[o + 2] = id[i]
      packed[o + 3] = 255
    }
  }
  const mk = (data: Uint8Array) => {
    const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat)
    t.generateMipmaps = true
    t.minFilter = THREE.LinearMipmapLinearFilter
    t.magFilter = THREE.LinearFilter
    t.anisotropy = 8
    t.needsUpdate = true
    return t
  }
  return { normal: mk(normal), carve: mk(packed) }
}

export interface CarvedUniforms {
  uCarve: { value: THREE.Texture | null }
  uProgress: { value: number }
  uInlayGlow: { value: number }
  uFront: { value: number }
  /** 1 = the carving as revealed; fading to 0 smooths the whole drawing away at once */
  uFade?: { value: number }
}

/** A stone material whose carving is revealed by uProgress (0 → 1). */
export function carvedMaterial(base: THREE.MeshStandardMaterial, uniforms: CarvedUniforms) {
  const m = base.clone()
  uniforms.uFade ??= { value: 1 }
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform sampler2D uCarve;
uniform float uProgress;
uniform float uInlayGlow;
uniform float uFront;
uniform float uFade;`,
      )
      .replace(
        'void main() {',
        `void main() {
  vec4 cv = texture2D(uCarve, vNormalMapUv);
  float reveal = cv.r > 0.995 ? 0.0 : clamp((uProgress - cv.r) / 0.018, 0.0, 1.0);
  float front = reveal * (1.0 - reveal) * 4.0;
  reveal *= uFade;`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
  // cut stone is paler and dusty at the edges, darker deep in the groove
  float cut = cv.g * reveal;
  diffuseColor.rgb *= mix(1.0, 0.6, smoothstep(0.3, 1.0, cut));
  // freshly cut walls: a thin film of pale stone dust, not a bright outline
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.12 + 0.02, smoothstep(0.05, 0.3, cut) * (1.0 - smoothstep(0.3, 0.7, cut)) * 0.5);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.42, 0.12), cv.b * reveal * 0.95);`,
      )
      // the chunk is still an #include at this point: expand it so the grooves' relief can be
      // gated by the reveal too (otherwise light picks out the whole drawing before it is cut)
      .replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale * reveal;'))
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
  totalEmissiveRadiance += vec3(1.0, 0.45, 0.12) * cv.b * reveal * uInlayGlow;
  totalEmissiveRadiance += vec3(1.0, 0.74, 0.42) * front * cv.g * uFront;`,
      )
  }
  m.customProgramCacheKey = () => 'carved-stone'
  return m
}
