import * as THREE from 'three'
import { PAGE, tileSamples, type LayoutPart } from '../kit/lightmap'
import type { Builder } from '../kit/builder'

// Offline light bake on the GPU, in three.js. For every lightmap texel and every vertex of
// the per-vertex parts, it gathers:
//   A   — sun visibility, averaged over a jittered sun disc (soft, accurate shadows)
//   RGB — sky and ground-bounce irradiance with occlusion, from hundreds of sky directions
// Each direction renders the whole scene (trees included) to an orthographic depth map,
// then a full-screen pass tests every sample against it and adds its share.
// Runtime materials keep their live (normal-mapped) sun, scaled by A, and take RGB as
// their ambient — so the walk needs no live shadows or ambient occlusion.

export interface BakeSettings {
  sunDir: THREE.Vector3
  /** samples over the sun's disc and the sky */
  sunSamples: number
  skySamples: number
  /** the region whose occluders matter (world box) */
  region: THREE.Box3
  depthSize: number
  /** irradiance of an open sky on an up-facing surface, and of the ground bounce */
  sky: number
  ground: number
  /** baked irradiance is stored divided by this */
  scale: number
}

const TILE = 1024

const QUAD_VS = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`

const ACC_FS = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D posTex;
  uniform sampler2D norTex;
  uniform sampler2D depthTex;
  uniform mat4 lightMat;
  uniform vec3 dir;
  uniform vec3 radiance;
  uniform vec3 bounce;
  uniform float isSun;
  uniform float weight;
  uniform float texel;
  void main() {
    vec4 p = texture2D(posTex, vUv);
    if (p.w < 0.5) discard;
    vec3 n = normalize(texture2D(norTex, vUv).xyz);
    float ndl = dot(n, dir);
    // the mirror of this sky direction stands for light bounced off the ground
    vec3 down = vec3(dir.x, -dir.y, dir.z);
    float ndg = max(dot(n, down), 0.0);
    if (ndl <= 0.0 && (isSun > 0.5 || ndg <= 0.0)) { gl_FragColor = vec4(0.0); return; }
    vec3 wp = p.xyz + n * (0.03 + texel * 1.5) + dir * (texel * 0.5);
    vec4 lc = lightMat * vec4(wp, 1.0);
    vec3 ndc = lc.xyz / lc.w;
    vec2 suv = ndc.xy * 0.5 + 0.5;
    float z = ndc.z * 0.5 + 0.5;
    float vis = 1.0;
    if (suv.x > 0.0 && suv.x < 1.0 && suv.y > 0.0 && suv.y < 1.0 && z < 1.0) {
      float d = texture2D(depthTex, suv).r;
      vis = z <= d + 0.0005 ? 1.0 : 0.0;
    }
    if (isSun > 0.5) gl_FragColor = vec4(0.0, 0.0, 0.0, vis * weight * step(0.0, ndl));
    else gl_FragColor = vec4((radiance * max(ndl, 0.0) + bounce * ndg) * vis * weight, 0.0);
  }`

/** A soft dawn sky: blue overhead, warm at the horizon, brightest toward the sun. */
function skyRadiance(d: THREE.Vector3, sun: THREE.Vector3, out: THREE.Color) {
  const zen = new THREE.Color('#a9c3df')
  const hor = new THREE.Color('#f2d7b8')
  out.copy(hor).lerp(zen, Math.pow(Math.max(0, d.y), 0.5))
  const hs = new THREE.Vector2(sun.x, sun.z).normalize()
  const hd = new THREE.Vector2(d.x, d.z).normalize()
  const toward = Math.max(0, hs.dot(hd))
  return out.multiplyScalar(1 + 0.8 * Math.pow(toward, 3) * (1 - d.y))
}

/** Fibonacci-spaced directions over the upper hemisphere (uniform in solid angle). */
function hemisphere(n: number) {
  const out: THREE.Vector3[] = []
  const g = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = 0.02 + 0.98 * ((i + 0.5) / n)
    const r = Math.sqrt(1 - y * y)
    out.push(new THREE.Vector3(Math.cos(g * i) * r, y, Math.sin(g * i) * r))
  }
  return out
}

function sunDisc(sun: THREE.Vector3, n: number) {
  // ~1.2° half-angle: the sun's disc plus a little atmospheric softening
  const t = new THREE.Vector3().crossVectors(sun, new THREE.Vector3(0, 1, 0)).normalize()
  const b = new THREE.Vector3().crossVectors(t, sun).normalize()
  const out: THREE.Vector3[] = []
  const R = Math.tan(THREE.MathUtils.degToRad(1.2))
  for (let i = 0; i < n; i++) {
    const r = R * Math.sqrt((i + 0.5) / n)
    const a = i * 2.399963
    out.push(sun.clone().addScaledVector(t, Math.cos(a) * r).addScaledVector(b, Math.sin(a) * r).normalize())
  }
  return out
}

export class Baker {
  private renderer: THREE.WebGLRenderer
  private depthRT: THREE.WebGLRenderTarget
  private occ = new THREE.Scene()
  private quad: THREE.Mesh
  private acc: THREE.ShaderMaterial
  private quadScene = new THREE.Scene()
  private quadCam = new THREE.Camera()
  private dirs: { d: THREE.Vector3; sun: boolean; rad: THREE.Color; bounce: THREE.Color; w: number; mat: THREE.Matrix4; texel: number }[] = []

  constructor(
    readonly s: BakeSettings,
    occluders: THREE.Object3D[],
  ) {
    const canvas = document.createElement('canvas')
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
    this.renderer.setPixelRatio(1)
    this.renderer.autoClear = false
    this.depthRT = new THREE.WebGLRenderTarget(s.depthSize, s.depthSize, { depthTexture: new THREE.DepthTexture(s.depthSize, s.depthSize, THREE.FloatType) })
    this.occ.overrideMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide })
    for (const o of occluders) this.occ.add(o)
    this.acc = new THREE.ShaderMaterial({
      vertexShader: QUAD_VS,
      fragmentShader: ACC_FS,
      uniforms: {
        posTex: { value: null },
        norTex: { value: null },
        depthTex: { value: this.depthRT.depthTexture },
        lightMat: { value: new THREE.Matrix4() },
        dir: { value: new THREE.Vector3() },
        radiance: { value: new THREE.Vector3() },
        bounce: { value: new THREE.Vector3() },
        isSun: { value: 0 },
        weight: { value: 0 },
        texel: { value: 0 },
      },
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      depthTest: false,
      depthWrite: false,
    })
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.acc)
    this.quadScene.add(this.quad)

    // directions, weights and light matrices, prepared once
    const col = new THREE.Color()
    const sun = s.sunDir.clone().normalize()
    for (const d of sunDisc(sun, s.sunSamples)) this.dirs.push({ d, sun: true, rad: new THREE.Color(), bounce: new THREE.Color(), w: 1 / s.sunSamples, mat: new THREE.Matrix4(), texel: 0 })
    const ground = new THREE.Color('#c9a27e')
    for (const d of hemisphere(s.skySamples)) {
      skyRadiance(d, sun, col)
      // estimator for irradiance with uniform hemisphere samples: (2π/N)·Σ L·cos
      const rad = col.clone().multiplyScalar(s.sky / Math.PI)
      const bounce = ground.clone().multiplyScalar(s.ground / Math.PI)
      this.dirs.push({ d, sun: false, rad, bounce, w: (2 * Math.PI) / s.skySamples, mat: new THREE.Matrix4(), texel: 0 })
    }
    const corners: THREE.Vector3[] = []
    const r = s.region
    for (let i = 0; i < 8; i++) corners.push(new THREE.Vector3(i & 1 ? r.max.x : r.min.x, i & 2 ? r.max.y : r.min.y, i & 4 ? r.max.z : r.min.z))
    const centre = r.getCenter(new THREE.Vector3())
    for (const e of this.dirs) {
      const cam = new THREE.OrthographicCamera()
      cam.position.copy(centre).addScaledVector(e.d, 1500)
      cam.up.set(0, 1, 0)
      if (Math.abs(e.d.y) > 0.99) cam.up.set(0, 0, 1)
      cam.lookAt(centre)
      cam.updateMatrixWorld()
      const inv = cam.matrixWorldInverse
      let x0 = Infinity
      let x1 = -Infinity
      let y0 = Infinity
      let y1 = -Infinity
      let z1 = -Infinity
      for (const c of corners) {
        const p = c.clone().applyMatrix4(inv)
        x0 = Math.min(x0, p.x)
        x1 = Math.max(x1, p.x)
        y0 = Math.min(y0, p.y)
        y1 = Math.max(y1, p.y)
        z1 = Math.max(z1, -p.z)
      }
      cam.left = x0
      cam.right = x1
      cam.bottom = y0
      cam.top = y1
      // near at the camera (1500 m out) so occluders outside the region still cast
      cam.near = 1
      cam.far = z1 + 5
      cam.updateProjectionMatrix()
      e.mat.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)
      e.texel = Math.max(x1 - x0, y1 - y0) / s.depthSize
      Object.assign(e, { cam })
    }
  }

  get directionCount() {
    return this.dirs.length
  }

  /** Light a W×H grid of samples (float RGBA position/normal arrays); returns RGBA bytes. */
  light(pos: Float32Array, nor: Float32Array, W: number, H: number, onDir?: (i: number) => void) {
    const r = this.renderer
    const mk = (a: Float32Array) => {
      const t = new THREE.DataTexture(a, W, H, THREE.RGBAFormat, THREE.FloatType)
      t.minFilter = t.magFilter = THREE.NearestFilter
      t.needsUpdate = true
      return t
    }
    const pt = mk(pos)
    const nt = mk(nor)
    const accRT = new THREE.WebGLRenderTarget(W, H, { type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter })
    r.setRenderTarget(accRT)
    r.setClearColor(0x000000, 0)
    r.clear()
    const u = this.acc.uniforms
    u.posTex.value = pt
    u.norTex.value = nt
    this.dirs.forEach((e, i) => {
      const cam = (e as unknown as { cam: THREE.OrthographicCamera }).cam
      r.setRenderTarget(this.depthRT)
      r.clear()
      r.render(this.occ, cam)
      u.lightMat.value.copy(e.mat)
      u.dir.value.copy(e.d)
      u.radiance.value.set(e.rad.r, e.rad.g, e.rad.b)
      u.bounce.value.set(e.bounce.r, e.bounce.g, e.bounce.b)
      u.isSun.value = e.sun ? 1 : 0
      u.weight.value = e.w
      u.texel.value = e.texel
      r.setRenderTarget(accRT)
      r.render(this.quadScene, this.quadCam)
      onDir?.(i)
    })
    const f = new Float32Array(W * H * 4)
    r.readRenderTargetPixels(accRT, 0, 0, W, H, f)
    accRT.dispose()
    pt.dispose()
    nt.dispose()
    const out = new Uint8ClampedArray(W * H * 4)
    const k = 255 / this.s.scale
    for (let i = 0; i < W * H; i++) {
      out[i * 4] = f[i * 4] * k
      out[i * 4 + 1] = f[i * 4 + 1] * k
      out[i * 4 + 2] = f[i * 4 + 2] * k
      out[i * 4 + 3] = f[i * 4 + 3] * 255
    }
    return out
  }

  /** Bake one lightmap page, tile by tile (empty tiles are skipped). */
  page(parts: LayoutPart[], page: number, log: (m: string) => void) {
    const out = new Uint8ClampedArray(PAGE * PAGE * 4)
    const tp = new Float32Array(TILE * TILE * 4)
    const tn = new Float32Array(TILE * TILE * 4)
    const tiles = PAGE / TILE
    for (let ty = 0; ty < tiles; ty++)
      for (let tx = 0; tx < tiles; tx++) {
        if (!tileSamples(parts, page, tx * TILE, ty * TILE, TILE, tp, tn)) continue
        const lit = this.light(tp, tn, TILE, TILE)
        for (let y = 0; y < TILE; y++) out.set(lit.subarray(y * TILE * 4, (y + 1) * TILE * 4), ((ty * TILE + y) * PAGE + tx * TILE) * 4)
        log(`page ${page} tile ${tx},${ty}`)
      }
    return out
  }

  /** Bake the per-vertex parts of a merged mesh; returns RGBA bytes per vertex. */
  vertices(geo: THREE.BufferGeometry) {
    const p = geo.attributes.position as THREE.BufferAttribute
    const n = geo.attributes.normal as THREE.BufferAttribute
    const count = p.count
    const W = 1024
    const H = Math.ceil(count / W)
    const pos = new Float32Array(W * H * 4)
    const nor = new Float32Array(W * H * 4)
    for (let i = 0; i < count; i++) {
      pos.set([p.getX(i), p.getY(i), p.getZ(i), 1], i * 4)
      nor.set([n.getX(i), n.getY(i), n.getZ(i), 0], i * 4)
    }
    return this.light(pos, nor, W, H).slice(0, count * 4)
  }

  dispose() {
    this.depthRT.dispose()
    this.renderer.dispose()
  }
}

/** Everything a scene contributes to the bake. */
export interface BakeScene {
  builder: Builder
  meshes: Map<string, THREE.BufferGeometry>
  occluders: THREE.Object3D[]
}
