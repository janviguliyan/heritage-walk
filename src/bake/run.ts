import * as THREE from 'three'
import { Baker } from './bake'
import { sunDirection } from '../engine/Atmosphere'
import { banyanPlacement, buildKonark, broadleafPlacements, palmPlacements, shrubPlacements, treePlacements } from '../sites/konark/scene'
import { banyanMeshes, broadleafMeshes, casuarinaMeshes, palmMeshes, shrubMesh } from '../kit/Trees'
import { PAGE } from '../kit/lightmap'
import { konark } from '../sites/konark'

// Dev-only: open /?bake in Chrome (with GPU) to bake Konark's light. Results land in
// window.__bake as base64 files for the driver script to save into public/sites/konark/bake/.

export const BAKE = { sunAzimuth: konark.sunAzimuth, sunElevation: 26, scale: 3 }

/** Encode one channel set as an opaque image: canvases drop colour wherever alpha is 0, so
 *  sky light (RGB) and sun visibility (A, written as grey) go in separate opaque files. */
async function toWebp(bytes: Uint8ClampedArray, w: number, h: number, which: 'rgb' | 'a') {
  const c = new OffscreenCanvas(w, h)
  const g = c.getContext('2d')!
  // canvas rows run top-down; texture rows (readPixels) bottom-up — flip
  const img = new ImageData(w, h)
  const d = img.data
  for (let y = 0; y < h; y++) {
    const src = (h - 1 - y) * w * 4
    const dst = y * w * 4
    for (let x = 0; x < w * 4; x += 4) {
      if (which === 'rgb') {
        d[dst + x] = bytes[src + x]
        d[dst + x + 1] = bytes[src + x + 1]
        d[dst + x + 2] = bytes[src + x + 2]
      } else d[dst + x] = d[dst + x + 1] = d[dst + x + 2] = bytes[src + x + 3]
      d[dst + x + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  const blob = await c.convertToBlob({ type: 'image/webp', quality: 0.9 })
  return b64(new Uint8Array(await blob.arrayBuffer()))
}

function b64(u: Uint8Array) {
  let s = ''
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000))
  return btoa(s)
}

export async function runBake() {
  const log = (m: string) => {
    console.log('[bake]', m)
    document.body.textContent = m
  }
  const t0 = performance.now()
  const b = buildKonark()
  const meshes = b.build()
  log(`built: ${meshes.size} meshes, ${b.pages} lightmap pages`)
  const occluders: THREE.Object3D[] = []
  for (const g of meshes.values()) occluders.push(new THREE.Mesh(g))
  const low = false
  const bl = broadleafMeshes(broadleafPlacements(low), low)
  const ca = casuarinaMeshes(treePlacements(low))
  const pa = palmMeshes(palmPlacements())
  const bn = banyanMeshes(banyanPlacement())
  occluders.push(bl.trunk, bl.crown, ca.trunk, ca.foliage, pa.trunk, pa.fronds, bn.wood, bn.crown, shrubMesh(shrubPlacements(low)))
  for (const o of occluders) o.updateMatrixWorld(true)

  const baker = new Baker(
    {
      sunDir: sunDirection(BAKE.sunAzimuth, BAKE.sunElevation),
      sunSamples: 48,
      skySamples: 192,
      region: new THREE.Box3(new THREE.Vector3(-140, -1, -118), new THREE.Vector3(150, 48, 118)),
      depthSize: 4096,
      sky: 2.3,
      ground: 1.5,
      scale: BAKE.scale,
    },
    occluders,
  )
  const files: Record<string, string> = {}
  const parts = b.parts
  for (let p = 0; p < b.pages; p++) {
    const bytes = baker.page(parts, p, log)
    files[`lm-${p}.webp`] = await toWebp(bytes, PAGE, PAGE, 'rgb')
    files[`sun-${p}.webp`] = await toWebp(bytes, PAGE, PAGE, 'a')
  }
  const vertex: Record<string, string> = {}
  for (const [key, geo] of meshes) {
    if (!key.endsWith('#v')) continue
    const rgba = baker.vertices(geo)
    // two bytes per vertex: sky light as luminance (its colour is nearly constant), sun visibility
    const n = rgba.length / 4
    const two = new Uint8Array(n * 2)
    for (let i = 0; i < n; i++) {
      two[i * 2] = Math.min(255, rgba[i * 4] * 0.3 + rgba[i * 4 + 1] * 0.55 + rgba[i * 4 + 2] * 0.15)
      two[i * 2 + 1] = rgba[i * 4 + 3]
    }
    const name = `v-${key.replace('#v', '')}.bin`
    files[name] = b64(two)
    vertex[key] = name
    log(`vertices ${key}: ${geo.attributes.position.count}`)
  }
  files['manifest.json'] = btoa(
    JSON.stringify({ version: Date.now(), pages: b.pages, scale: BAKE.scale, sun: { azimuth: BAKE.sunAzimuth, elevation: BAKE.sunElevation }, vertex, keys: [...meshes.keys()] }, null, 1),
  )
  baker.dispose()
  log(`done in ${((performance.now() - t0) / 1000).toFixed(0)} s`)
  Object.assign(window, { __bake: files })
}
