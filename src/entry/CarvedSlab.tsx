import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { CHAMBER } from './chamber'
import { hallMaterials } from './stone'
import { bakeCarving, carveCanvases, carvedMaterial, type CarvedUniforms, type Surface } from './carve'
import { CARVE_FONTS, drawIndia, loadCarvingFonts, SLAB } from './indiaCarving'
import { drawPlan, planHeight, siteToTablet } from './planCarving'
import { mapState } from './mapState'
import { chisel } from '../engine/audio'
import { store, useStore } from '../engine/store'
import { translate } from '../i18n'
import { tx } from '../engine/content'
import { konark } from '../sites/konark'

// The chamber platform's top. It carries one carving at a time — India, or Konark's site plan
// — and moves between them in place: the old carving is smoothed away, the new one is cut,
// and for Konark the temple itself rises out of the stone as a miniature. A raking warm lamp
// makes every groove read.

export type Face = 'none' | 'india' | 'konark'

const SECONDS = { india: 2.4, konark: 1.3 }
const ERASE = 0.6
const RISE = 0.9
const flat = (rgba: number[]) => {
  const t = new THREE.DataTexture(new Uint8Array(rgba), 1, 1, THREE.RGBAFormat)
  t.needsUpdate = true
  return t
}
// the sculpted stone's colour is already weathered: only a little darker under the lamp
const SLAB_TINT = '#d9c9b6'
const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
type Baked = { normal: THREE.Texture; carve: THREE.Texture }

// The tablet's own stone, sculpted offline at the carving canvas's size (tools/blender/entry_stone.py)
type Slab = { map: THREE.Texture; surface: Surface }
let slabStone: Promise<Slab | null> | null = null
function loadSlab(): Promise<Slab | null> {
  slabStone ??= (async () => {
    const loader = new THREE.ImageLoader()
    const [alb, hgt, range] = await Promise.all([
      loader.loadAsync('/entry/slab-albedo.webp'),
      loader.loadAsync('/entry/slab-height.webp'),
      fetch('/entry/slab.json').then((r) => r.json() as Promise<{ min: number; max: number; px: number }>),
    ])
    const map = new THREE.Texture(alb)
    map.colorSpace = THREE.SRGBColorSpace
    map.anisotropy = 8
    map.needsUpdate = true
    const cv = document.createElement('canvas')
    cv.width = SLAB.w
    cv.height = SLAB.h
    const g = cv.getContext('2d', { willReadFrequently: true })!
    g.drawImage(hgt, 0, 0, SLAB.w, SLAB.h)
    const d = g.getImageData(0, 0, SLAB.w, SLAB.h).data
    const height = new Float32Array(SLAB.w * SLAB.h)
    for (let i = 0; i < height.length; i++) height[i] = range.min + (d[i * 4] / 255) * (range.max - range.min)
    return { map, surface: { height, px: range.px } }
  })().catch(() => null)
  return slabStone
}

export function CarvedSlab({ low, face }: { low: boolean; face: Face }) {
  const P = CHAMBER.platform
  const lang = useStore((s) => s.lang)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const rake = useRef<THREE.SpotLight>(null)
  const fill = useRef<THREE.HemisphereLight>(null)
  const uniforms = useMemo<CarvedUniforms>(() => ({ uCarve: { value: null }, uProgress: { value: 0 }, uInlayGlow: { value: 0 }, uFront: { value: 1.6 }, uFade: { value: 1 } }), [])
  const [india, setIndia] = useState<Baked | null>(null)
  const [plan, setPlan] = useState<Baked | null>(null)
  const icon = useRef<[number, number, number] | null>(null)
  const spots = useRef<[number, number, number][]>([])
  const shown = useRef<Face>('none')
  const relief = useRef<THREE.Mesh>(null)
  const [reliefGeo, setReliefGeo] = useState<THREE.BufferGeometry | null>(null)
  const unit = P.w / SLAB.w
  const toPlatform = (x: number, y: number): [number, number] => [P.x + (x / SLAB.w - 0.5) * P.w, P.z + (y / SLAB.h - 0.5) * P.d]

  // the temple in miniature, built in a background thread, placed on the platform
  useEffect(() => {
    let alive = true
    import('../sites/konark/buildClient').then((m) =>
      m.miniatureData().then((src) => {
        if (!alive) return
        const g = src.clone()
        g.applyMatrix4(siteToTablet(toPlatform, unit))
        g.computeBoundingSphere()
        g.computeBoundingBox()
        // what the camera frames: the model's footprint, lifted onto the platform top
        const b = g.boundingBox!
        const c = b.getCenter(new THREE.Vector3())
        mapState.model = { center: new THREE.Vector3(c.x, P.h + 0.06, c.z), radius: Math.hypot(b.max.x - b.min.x, b.max.z - b.min.z) / 2 }
        setReliefGeo(g)
      }),
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const material = useMemo(() => {
    const stone = hallMaterials(low).stone as THREE.MeshStandardMaterial
    const base = new THREE.MeshStandardMaterial({
      map: stone.map,
      // weathered, darker slab so the cut reads pale against it, as on old stone tablets
      color: new THREE.Color('#b29d86'),
      roughness: 0.88,
      normalScale: new THREE.Vector2(1.5, 1.5),
      emissive: new THREE.Color('#000000'),
      // flat placeholders until a carving is baked (the shader needs both from the start)
      normalMap: flat([128, 128, 255, 255]),
    })
    uniforms.uCarve.value = flat([255, 0, 0, 255])
    return carvedMaterial(base, uniforms)
  }, [low, uniforms])
  const reliefMat = useMemo(() => {
    const stone = hallMaterials(low).stone as THREE.MeshStandardMaterial
    return new THREE.MeshStandardMaterial({ map: stone.map, normalMap: stone.normalMap, color: '#b39c80', roughness: 0.88 })
  }, [low])

  // bake both carvings (again when the language changes: names are cut in the visitor's language)
  useEffect(() => {
    let alive = true
    // on a slow connection the carving doesn't wait long for the sculpted stone
    const stone = low ? null : Promise.race([loadSlab(), new Promise<null>((r) => setTimeout(() => r(null), 4000))])
    Promise.all([loadCarvingFonts(lang), stone]).then(([, slab]) => {
      if (!alive) return
      if (slab && material.map !== slab.map) {
        material.map = slab.map
        material.color.set(SLAB_TINT)
        material.needsUpdate = true
      }
      const scale = low ? 0.5 : 1
      const mk = () => {
        const c = carveCanvases(Math.round(SLAB.w * scale), Math.round(SLAB.h * scale))
        for (const g of [c.groove, c.arrival, c.inlay]) g.scale(scale, scale)
        return c
      }
      const ci = mk()
      const r = drawIndia(ci, lang, { title: translate(lang, 'map.title2'), hint: translate(lang, 'india.hint'), soon: translate(lang, 'india.soon') })
      icon.current = r.konarkIcon
      const cp = mk()
      const hs = konark.content.hotspots
      const pr = drawPlan(cp, hs, lang, tx(konark.content.name, lang), CARVE_FONTS[lang] ?? CARVE_FONTS.en)
      spots.current = pr.spots.map(([x, y], i) => [x, y, planHeight(hs[i].position[1], unit)])
      setIndia(bakeCarving(ci, low ? 4 : 7, slab?.surface))
      setPlan(bakeCarving(cp, low ? 4 : 7, slab?.surface))
    })
    return () => {
      alive = false
    }
  }, [lang, low, unit, material])

  const use = (f: Face) => {
    const t = f === 'india' ? india : f === 'konark' ? plan : null
    if (!t) return false
    material.normalMap = t.normal
    uniforms.uCarve.value = t.carve
    material.needsUpdate = true
    shown.current = f
    return true
  }
  // a fresh bake (language change) replaces what is shown, at its current progress
  useEffect(() => {
    if (shown.current !== 'none') use(shown.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [india, plan])

  useEffect(() => {
    if (!rake.current) return
    rake.current.target.position.set(P.x, P.h, P.z)
    rake.current.target.updateMatrixWorld()
  }, [P.x, P.h, P.z])

  const tap = useRef(0)
  const rise = useRef(0)
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame((state, dt) => {
    const u = uniforms
    const step = reduced ? 1 : dt
    let carving = false
    const fade = u.uFade!
    if (face !== shown.current) {
      // sink the miniature, then smooth the whole old carving away at once, then cut the new one
      rise.current = Math.max(0, rise.current - step / (RISE * 0.6))
      if (rise.current <= 0 && shown.current !== 'none' && fade.value > 0) fade.value = Math.max(0, fade.value - step / ERASE)
      else if (rise.current <= 0 && (shown.current === 'none' || fade.value <= 0)) {
        // (a carving still being baked is cut as soon as it is ready)
        if (face === 'none' || use(face)) {
          if (face === 'none') shown.current = 'none'
          u.uProgress.value = 0
          fade.value = 1
        }
      }
    } else if (face !== 'none') {
      if (u.uProgress.value < 1) {
        u.uProgress.value = Math.min(1, u.uProgress.value + step / SECONDS[face])
        carving = true
      } else if (face === 'konark' && reliefGeo) rise.current = Math.min(1, rise.current + step / RISE)
    }
    if (carving) {
      tap.current -= dt
      if (tap.current <= 0) {
        chisel(0.6 + Math.random() * 0.5)
        tap.current = 0.03 + Math.random() * 0.03
      }
    }
    if (relief.current) {
      const k = rise.current * rise.current * (3 - 2 * rise.current)
      relief.current.scale.y = Math.max(0.001, k)
      relief.current.visible = rise.current > 0
    }
    const ready = face === 'konark' && shown.current === 'konark' && rise.current >= 1
    if (ready !== store.get().konarkReady) store.set({ konarkReady: ready })
    mapState.progress = shown.current === 'india' ? u.uProgress.value : 0
    // the live site's inlay breathes once it's cut (India only)
    u.uInlayGlow.value = shown.current === 'india' ? THREE.MathUtils.smoothstep(u.uProgress.value, 0.95, 1) * (0.9 + Math.sin(state.clock.elapsedTime * 2.6) * 0.35) : 0
    const open = face !== 'none'
    const k = Math.min(1, dt * 1.5)
    if (rake.current) rake.current.intensity = THREE.MathUtils.lerp(rake.current.intensity, open ? 70 : 0, k)
    if (fill.current) fill.current.intensity = THREE.MathUtils.lerp(fill.current.intensity, open ? 0.55 : 0, k)
    // where things are on screen: the Konark emblem (India) and the stops (Konark)
    if (icon.current && shown.current === 'india') {
      const [ix, iy, ir] = icon.current
      const [wx, wz] = toPlatform(ix, iy)
      v.set(wx, P.h + 0.03, wz)
      const pr = v.clone().project(camera)
      const edge = v.clone().add(new THREE.Vector3(ir * unit, 0, 0)).project(camera)
      mapState.konark = { x: (pr.x * 0.5 + 0.5) * size.width, y: (-pr.y * 0.5 + 0.5) * size.height, r: Math.abs(edge.x - pr.x) * 0.5 * size.width }
    }
    if (ready) {
      mapState.pins = spots.current.map(([x, y, h]) => {
        const [wx, wz] = toPlatform(x, y)
        v.set(wx, P.h + 0.03 + h, wz).project(camera)
        return { x: (v.x * 0.5 + 0.5) * size.width, y: (-v.y * 0.5 + 0.5) * size.height }
      })
    } else mapState.pins = []
  })

  return (
    <group>
      {/* a low, warm light raking across the slab from the far right, like a lamp at its side */}
      <hemisphereLight ref={fill} args={['#f0c890', '#3a2010', 0]} />
      <spotLight ref={rake} position={[P.x + 2.6, P.h + 1.15, P.z - 1.6]} angle={1.0} penumbra={0.9} intensity={0} distance={9} decay={2} color="#ffbe78" />
      <mesh position={[P.x, P.h + 0.015, P.z]} receiveShadow material={material}>
        <boxGeometry args={[P.w, 0.03, P.d]} />
      </mesh>
      {reliefGeo && <mesh ref={relief} geometry={reliefGeo} material={reliefMat} position={[0, P.h + 0.03, 0]} visible={false} castShadow />}
    </group>
  )
}
