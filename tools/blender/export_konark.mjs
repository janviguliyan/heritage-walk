// Export the walk's Konark scene, exactly as the site builds it, for Blender.
// Runs the TypeScript builder in Node through Vite (no browser), then writes one binary file per
// merged mesh (positions, normals, uvs, lightmap uvs, indices) and a manifest, into
// tools/blender/out/konark/. tools/blender/temple.py reads them.
//
//   node tools/blender/export_konark.mjs
import { createServer } from 'vite'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const out = join(root, 'tools', 'blender', 'out', 'konark')
mkdirSync(out, { recursive: true })

const vite = await createServer({ root, logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' })
try {
  const { buildKonark } = await vite.ssrLoadModule('/src/sites/konark/build.ts')
  const t0 = performance.now()
  const b = buildKonark()
  const meshes = [...b.build()]
  console.log(`built ${meshes.length} meshes in ${((performance.now() - t0) / 1000).toFixed(1)} s`)
  const manifest = []
  meshes.forEach(([key, g], i) => {
    const file = `m${i}.bin`
    const parts = []
    const layout = {}
    let offset = 0
    const add = (name, arr) => {
      if (!arr) return
      const buf = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength)
      layout[name] = { offset, count: arr.length, type: arr.constructor.name }
      parts.push(buf)
      offset += buf.length
      const pad = (4 - (offset % 4)) % 4
      if (pad) {
        parts.push(Buffer.alloc(pad))
        offset += pad
      }
    }
    const a = g.attributes
    add('position', a.position?.array)
    add('normal', a.normal?.array)
    add('uv', a.uv?.array)
    add('uv1', a.uv1?.array)
    add('index', g.index?.array)
    writeFileSync(join(out, file), Buffer.concat(parts))
    manifest.push({ key, file, layout, vertices: a.position.count })
  })
  // the trees, as the light bake sees them (src/bake/run.ts): occluders only, never baked
  const THREE = await vite.ssrLoadModule('three')
  const { mergeGeometries } = await vite.ssrLoadModule('three/examples/jsm/utils/BufferGeometryUtils.js')
  const scene = await vite.ssrLoadModule('/src/sites/konark/scene.tsx')
  const T = await vite.ssrLoadModule('/src/kit/Trees.tsx')
  const low = false
  const bl = T.broadleafMeshes(scene.broadleafPlacements(low), low)
  const ca = T.casuarinaMeshes(scene.treePlacements(low))
  const pa = T.palmMeshes(scene.palmPlacements())
  const bn = T.banyanMeshes(scene.banyanPlacement())
  const sh = T.shrubMeshes(scene.shrubPlacements(low))
  // crowns and their leaf cards (cards bake as solid: a canopy's shadow is close to solid anyway)
  const occ = { trunk: [bl.trunk, ca.trunk, pa.trunk, bn.wood], crown: [bl.crown, bl.leaves, ca.foliage, pa.fronds, bn.crown, bn.leaves, sh.body, sh.leaves] }
  for (const [name, objs] of Object.entries(occ)) {
    const parts = []
    for (const o of objs) {
      o.updateMatrixWorld(true)
      const base = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()
      for (const k of Object.keys(base.attributes)) if (k !== 'position' && k !== 'normal') base.deleteAttribute(k)
      if (o.isInstancedMesh) {
        const m = new THREE.Matrix4()
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, m)
          parts.push(base.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(o.matrixWorld, m)))
        }
      } else parts.push(base.clone().applyMatrix4(o.matrixWorld))
    }
    const g = mergeGeometries(parts)
    const file = `occ-${name}.bin`
    const pos = g.attributes.position.array
    writeFileSync(join(out, file), Buffer.from(pos.buffer, pos.byteOffset, pos.byteLength))
    manifest.push({ key: `occ:${name}`, file, layout: { position: { offset: 0, count: pos.length, type: 'Float32Array' } }, vertices: g.attributes.position.count })
    console.log(`occluder ${name}: ${g.attributes.position.count / 3} triangles`)
  }
  writeFileSync(join(out, 'manifest.json'), JSON.stringify({ meshes: manifest, colliders: b.colliders.length }, null, 1))
  const verts = manifest.reduce((s, m) => s + m.vertices, 0)
  console.log(`wrote ${manifest.length} meshes, ${verts.toLocaleString()} vertices to ${out}`)
} finally {
  await vite.close()
}
