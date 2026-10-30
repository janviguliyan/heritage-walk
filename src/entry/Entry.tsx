import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader } from '../ui/Loader'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, BrightnessContrast, EffectComposer, HueSaturation, N8AO, Noise, ToneMapping, Vignette } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { buildHall, HALL } from './hall'
import { entryCamera } from './camera'
import { CHAMBER } from './chamber'
import { CarvedSlab, type Face } from './CarvedSlab'
import { OrbitControls } from '@react-three/drei'
import { mapState } from './mapState'
import { hallMaterials, type HallMat } from './stone'
import { follow, useScrollDrive, type ScrollState } from './scroll'
import { chime, footstep, startAudio } from '../engine/audio'
import { store, useStore } from '../engine/store'
import { useT } from '../i18n'
import './entry.css'
import { MuteButton } from './MuteButton'

// Scene 1 of the entry flow: a carved sandstone hallway walked by scrolling.
// The following scenes (chamber → map) continue from the doorway at its far end.

RectAreaLightUniformsLib.init()
const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const SHOT = new URLSearchParams(location.search).has('shot')
// inside the hall: no sea, a little moving air, footsteps with stone echo, and veena
const ENTRY_AUDIO = { sea: null, music: '/audio/dhaka-kevin-macleod.mp3', reverb: [{ x: 0, z: -20, r: 60 }] }

function Hall({ low, onReady }: { low: boolean; onReady: () => void }) {
  const meshes = useMemo(() => [...buildHall(low).build()], [low])
  const mats = hallMaterials(low)
  const ready = useRef(onReady)
  useEffect(() => {
    ready.current()
  }, [])
  useEffect(() => () => meshes.forEach(([, g]) => g.dispose()), [meshes])
  return (
    <>
      {meshes.map(([k, g]) => (
        <mesh key={k} geometry={g} material={mats[k as HallMat]} castShadow={k !== 'floor' && k !== 'void'} receiveShadow />
      ))}
    </>
  )
}

function Lights({ low, scroll }: { low: boolean; scroll: React.RefObject<ScrollState> }) {
  const hemi = useRef<THREE.HemisphereLight>(null)
  const scene = useThree((s) => s.scene)
  useFrame(() => {
    // the chamber is darker and more intimate than the hall
    const k = THREE.MathUtils.smoothstep(scroll.current!.current, 0.95, 1.3)
    if (hemi.current) hemi.current.intensity = 0.32 - 0.16 * k
    const fog = scene.fog as THREE.FogExp2 | null
    if (fog) fog.density = 0.021 + 0.01 * k
  })
  const area = useRef<THREE.RectAreaLight>(null)
  const bounce = useRef<THREE.RectAreaLight>(null)
  const sun = useRef<THREE.DirectionalLight>(null)
  const rake = useRef<THREE.DirectionalLight>(null)
  useEffect(() => {
    if (rake.current) {
      rake.current.target.position.set(0, 0, -20)
      rake.current.target.updateMatrixWorld()
    }
    area.current?.lookAt(-10, 1.6, -20)
    bounce.current?.lookAt(10, 1.4, -20)
    const s = sun.current
    if (s) {
      s.target.position.set(0, 0, -20)
      s.target.updateMatrixWorld()
    }
  }, [])
  return (
    <>
      {/* sun high over the hall's roof: the courtyard and the far colonnade blaze, the corridor
          sits in warm shade lit by that bright courtyard, as in the reference */}
      <directionalLight
        ref={sun}
        position={[-9, 22, -4]}
        color="#ffc88e"
        intensity={3.1}
        castShadow
        shadow-mapSize={low ? [1024, 1024] : [4096, 4096]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-near={1}
        shadow-camera-far={80}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
      {/* late sun slanting in under the eave from the courtyard: bright bars across the floor and
          the courtyard faces of the pillars, deep shade between them */}
      <directionalLight
        ref={rake}
        position={[16, 7.5, -6]}
        color="#ffbf73"
        intensity={2.6}
        castShadow
        shadow-mapSize={low ? [1024, 1024] : [4096, 4096]}
        shadow-camera-left={-28}
        shadow-camera-right={28}
        shadow-camera-top={28}
        shadow-camera-bottom={-28}
        shadow-camera-near={1}
        shadow-camera-far={70}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
      {/* the bright courtyard itself, as a soft wall of light along the open side */}
      <rectAreaLight ref={area} args={['#ffe0b6', 2.6, 44, 4]} position={[HALL.rowX + 1.2, 1.9, -19]} />
      {/* warm bounce off the sunlit floor and wall, so no face falls to pure black */}
      <rectAreaLight ref={bounce} args={['#d99a5c', 0.9, 44, 3]} position={[HALL.wallX + 0.4, 1.4, -19]} />
      <hemisphereLight ref={hemi} args={['#e4cfb0', '#5a3418', 0.32]} />
    </>
  )
}

/** The chamber: one thin shaft of daylight through the roof slit, a warm bounce, and the platform top. */
function ChamberLight({ low, scroll }: { low: boolean; scroll: React.RefObject<ScrollState> }) {
  const P = CHAMBER.platform
  const spot = useRef<THREE.SpotLight>(null)
  const spill = useRef<THREE.SpotLight>(null)
  const beam = useRef<THREE.MeshBasicMaterial>(null)
  const bounce = useRef<THREE.PointLight>(null)
  const shaft = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 4
    c.height = 128
    const g = c.getContext('2d')!
    const grd = g.createLinearGradient(0, 0, 0, 128)
    grd.addColorStop(0, 'rgba(255,236,205,0.9)')
    grd.addColorStop(0.7, 'rgba(255,220,170,0.35)')
    grd.addColorStop(1, 'rgba(255,210,150,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, 4, 128)
    return new THREE.CanvasTexture(c)
  }, [])
  useEffect(() => {
    if (!spot.current) return
    spot.current.target.position.set(P.x, 0, P.z)
    spot.current.target.updateMatrixWorld()
    if (spill.current) {
      spill.current.target.position.set(P.x, 0.4, P.z - 2)
      spill.current.target.updateMatrixWorld()
    }
  }, [P.x, P.z])
  useFrame(() => {
    const p = scroll.current!.current
    // as the camera settles over it, the platform's surface begins to glow
    // the beam gives way once we're looking straight down into it
    if (beam.current) beam.current.opacity = 0.16 * (1 - THREE.MathUtils.smoothstep(p, 1.72, 1.92))
    // once the map is up, the shaft softens so the raking lamp can show the carving
    const m = THREE.MathUtils.smoothstep(p, 1.9, 2.05)
    if (spot.current) spot.current.intensity = 70 - 58 * m
    if (bounce.current) bounce.current.intensity = 22 - 19 * m
  })
  const H = CHAMBER.h
  return (
    <group>
      <spotLight ref={spot} position={[P.x, H + 4, P.z]} angle={0.12} penumbra={0.7} intensity={70} distance={20} decay={2} color="#ffe7c6" castShadow shadow-mapSize={low ? [512, 512] : [1024, 1024]} shadow-bias={-0.0005} />
      {/* warm bounce off the sunlit platform, and hall light spilling in through the doorway */}
      <pointLight ref={bounce} position={[P.x, 0.9, P.z]} intensity={22} distance={11} decay={2} color="#c98e5e" />
      <spotLight ref={spill} position={[P.x, 2.3, HALL.end - 0.6]} angle={0.95} penumbra={1} intensity={34} distance={14} decay={2} color="#e9a866" />
      {/* the visible beam */}
      <mesh position={[P.x, H / 2 + 0.3, P.z]} renderOrder={2}>
        <cylinderGeometry args={[0.07, 0.62, H - 0.4, 24, 1, true]} />
        <meshBasicMaterial ref={beam} map={shaft} transparent opacity={0.16} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} fog={false} />
      </mesh>
    </group>
  )
}

function Dust({ count }: { count: number }) {
  const geo = useMemo(() => {
    const p = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      p[i * 3] = (Math.random() - 0.4) * 5
      p[i * 3 + 1] = Math.random() * 3.4
      const inShaft = i % 5 === 0
      p[i * 3] = inShaft ? CHAMBER.platform.x + (Math.random() - 0.5) * 0.9 : p[i * 3]
      p[i * 3 + 2] = inShaft ? CHAMBER.platform.z + (Math.random() - 0.5) * 0.9 : HALL.start - Math.random() * 48
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(p, 3))
    return g
  }, [count])
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 32
    const g = c.getContext('2d')!
    const r = g.createRadialGradient(16, 16, 0, 16, 16, 16)
    r.addColorStop(0, 'rgba(255,235,200,1)')
    r.addColorStop(1, 'rgba(255,200,140,0)')
    g.fillStyle = r
    g.fillRect(0, 0, 32, 32)
    return new THREE.CanvasTexture(c)
  }, [])
  useFrame((state, dt) => {
    if (reducedMotion) return
    const a = geo.attributes.position as THREE.BufferAttribute
    const t = state.clock.elapsedTime
    for (let i = 0; i < count; i++) {
      a.setY(i, a.getY(i) + Math.sin(t * 0.3 + i) * dt * 0.03 + dt * 0.01)
      a.setX(i, a.getX(i) - dt * 0.05)
      if (a.getY(i) > 3.5) a.setY(i, 0.1)
      if (i % 5 !== 0 && a.getX(i) < -3) a.setX(i, 2.6)
      if (i % 5 === 0) a.setX(i, a.getX(i) + dt * 0.05)
    }
    a.needsUpdate = true
  })
  return (
    <points geometry={geo} frustumCulled={false}>
      <pointsMaterial map={tex} color="#ffd9a0" size={0.022} transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  )
}

function Rig({ scroll, onEnd }: { scroll: React.RefObject<ScrollState>; onEnd: () => void }) {
  const camera = useThree((s) => s.camera)
  const stride = useRef({ z: 0, acc: 0, ended: false, chimed: false })
  const back = useRef(1)
  const lookNow = useRef(new THREE.Vector3())
  const wasOrbit = useRef(false)
  const size = useThree((s) => s.size)
  const shift = useRef(0)
  useFrame((_, dt) => {
    if (wasOrbit.current && !mapState.orbit) back.current = 0
    wasOrbit.current = mapState.orbit
    // over Konark the welcome scroll covers the left of the screen: ease the picture right of
    // it with a view offset (orbiting still turns around the temple), and back when leaving
    const cam = camera as THREE.PerspectiveCamera
    const want = mapState.orbit && size.width > 900 ? -Math.min(210, size.width * 0.13) : 0
    shift.current += (want - shift.current) * Math.min(1, dt * 2.5)
    if (Math.abs(shift.current) > 0.5) cam.setViewOffset(size.width, size.height, shift.current, 0, size.width, size.height)
    else if (cam.view?.enabled) cam.clearViewOffset()
  }, -1)
  useFrame((state, dt) => {
    const s = scroll.current!
    follow(s, Math.min(dt, 0.05), reducedMotion)
    const { pos, look } = entryCamera(s.current, state.clock.elapsedTime, reducedMotion)
    // over the platform: rise just enough for the slab to fill the view at this screen shape
    // (on tall phones, enough for India itself; the side panels of the slab may crop)
    const P = CHAMBER.platform
    const cam = camera as THREE.PerspectiveCamera
    const k = THREE.MathUtils.smoothstep(s.current, 1.7, 2.0)
    if (k > 0) {
      const f = 2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))
      const needW = cam.aspect < 0.9 ? 1.5 : P.w * 1.04
      const d = Math.max((P.d * 1.06) / f, needW / (f * cam.aspect))
      pos.y += (P.h + d - pos.y) * k
    }
    // over Konark's miniature the orbit controls hold the camera
    if (mapState.orbit) return
    // coming back from them, glide rather than jump
    const settle = back.current < 1
    if (settle) {
      back.current = Math.min(1, back.current + dt / 1.1)
      const e = back.current * back.current * (3 - 2 * back.current)
      camera.position.lerp(pos, e)
      lookNow.current.lerp(look, e)
      camera.lookAt(lookNow.current)
    } else {
      camera.position.copy(pos)
      lookNow.current.copy(look)
      camera.lookAt(look)
    }
    // footsteps in time with the walk
    const st = stride.current
    st.acc += s.current < 1.45 ? Math.abs(pos.z - st.z) : 0
    st.z = pos.z
    if (st.acc > 0.85) {
      st.acc = 0
      if (s.touched) footstep('stone', false)
    }
    if (s.touched && !store.get().muted) startAudio(ENTRY_AUDIO)
    // past the doorway: on to the next scene
    if (!st.chimed && s.current > 1.92) {
      st.chimed = true
      chime()
    }
    if (st.chimed && s.current < 1.8) st.chimed = false
    if (st.ended && s.current < 1.9) st.ended = false
    if (!st.ended && s.current > 2.02) {
      st.ended = true
      onEnd()
    }
  })
  return null
}

function Effects({ low }: { low: boolean }) {
  if (low)
    return (
      <EffectComposer multisampling={0}>
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Vignette offset={0.2} darkness={0.75} />
      </EffectComposer>
    )
  return (
    <EffectComposer multisampling={0}>
      <N8AO aoRadius={1.4} distanceFalloff={0.8} intensity={3.2} quality="medium" halfRes />
      <Bloom mipmapBlur luminanceThreshold={0.92} intensity={0.45} radius={0.75} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      {/* grade: a little less saturation, a little more contrast — old photograph warmth */}
      <HueSaturation saturation={-0.16} />
      <BrightnessContrast contrast={0.15} />
      <Vignette offset={0.18} darkness={0.78} />
      <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.35} />
    </EffectComposer>
  )
}

/** Over Konark's miniature: glide to a three-quarter view, then hand over to orbit and zoom. */
function KonarkCamera() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const P = CHAMBER.platform
  // frame the miniature itself (its bounds arrive from the worker; until then, the platform)
  const target = useMemo(() => new THREE.Vector3(P.x, P.h + 0.12, P.z + 0.05), [P.x, P.h, P.z])
  const from = useRef<{ pos: THREE.Vector3; look: THREE.Vector3 } | null>(null)
  const t = useRef(0)
  const [free, setFree] = useState(false)
  useEffect(
    () => () => {
      mapState.orbit = false
    },
    [],
  )
  // south-east and about 40° down, close enough that the temple fills the view
  const goal = () => {
    const m = mapState.model
    if (m) target.copy(m.center)
    // the temple and its stops fill the view; the outer wall may run off the edges
    const r = (m?.radius ?? 0.9) * 0.62
    const dist = Math.min(3.4, Math.max(0.7, r / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2) * 0.8)))
    return new THREE.Vector3(0.45, 0.62, 0.66).normalize().multiplyScalar(dist).add(target)
  }
  useFrame((_, dt) => {
    if (free) return
    // the rig places the camera overhead on this first frame (it runs first); start from there
    if (!from.current) {
      const dir = new THREE.Vector3()
      camera.getWorldDirection(dir)
      from.current = { pos: camera.position.clone(), look: camera.position.clone().add(dir.multiplyScalar(1.5)) }
      mapState.orbit = true
      return
    }
    t.current = Math.min(1, t.current + dt / 1.8)
    const e = t.current * t.current * (3 - 2 * t.current)
    camera.position.lerpVectors(from.current.pos, goal(), e)
    camera.lookAt(new THREE.Vector3().lerpVectors(from.current.look, target, e))
    if (t.current >= 1) setFree(true)
  })
  return free ? (
    <OrbitControls
      makeDefault
      target={target}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.55}
      zoomSpeed={0.7}
      zoomToCursor
      minDistance={0.35}
      maxDistance={3.6}
      minPolarAngle={0.15}
      maxPolarAngle={1.3}
      enablePan={false}
    />
  ) : null
}

/** Scenes 1–2, and the platform's carvings (India, then Konark) in the chamber. */
export function Entry({ face = 'none', paused = false }: { face?: Face; paused?: boolean }) {
  const mapOpen = face !== 'none'
  const t = useT()
  const quality = useStore((s) => s.quality)
  const low = quality === 'low'
  const [ready, setReady] = useState(false)
  const scroll = useScrollDrive(2.14, !mapOpen)
  // arriving at (or deep-linking to) the map: rest over the platform; leaving it: step back
  const was = useRef(mapOpen)
  if (mapOpen && scroll.current.current < 2) {
    scroll.current.current = scroll.current.target = 2.08
  }
  if (!mapOpen && was.current) {
    // stepping back from the map: into the chamber, or all the way to the start of the hall
    scroll.current.target = mapState.home ? 0 : 1.72
    mapState.home = false
  }
  was.current = mapOpen
  const [p, setP] = useState(0)
  // mirror progress into React a few times a second for the overlay fades
  useEffect(() => {
    const id = window.setInterval(() => setP(scroll.current.current), 120)
    return () => window.clearInterval(id)
  }, [scroll])
  // the platform glows; the map unrolls on it (MapScene)
  const onEnd = () => store.set({ screen: 'india' })
  return (
    <div className={`entry${paused ? ' paused' : ''}`}>
      <Canvas
        shadows="percentage"
        frameloop={paused ? 'never' : 'always'}
                dpr={low ? [1, 1.25] : [1, 2]}
        gl={{ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: SHOT, toneMapping: THREE.NoToneMapping }}
        camera={{ fov: 62, near: 0.05, far: 300, position: [0.15, 1.62, 4.5] }}
        onCreated={({ scene, camera }) => {
          if (SHOT) Object.assign(window, { __cam: camera })
          scene.background = new THREE.Color('#dcbd8f')
          scene.fog = new THREE.FogExp2('#4a2f18', 0.021)
          if (SHOT) Object.assign(window, { __entry: scroll.current, __map: mapState })
        }}
      >
        <Hall low={low} onReady={() => setReady(true)} />
        <Lights low={low} scroll={scroll} />
        <ChamberLight low={low} scroll={scroll} />
        <CarvedSlab low={low} face={face} />
        {face === 'konark' && <KonarkCamera />}
        <Dust count={low ? 250 : 700} />
        <Rig scroll={scroll} onEnd={onEnd} />
        <Effects low={low} />
      </Canvas>

      <div className={`entry-shade${p > 0.07 || mapOpen ? ' gone' : ''}${ready ? ' in' : ''}`} aria-hidden="true" />
      <div className={`entry-title${p > 0.07 || mapOpen ? ' gone' : ''}${ready ? ' in' : ''}`}>
        <h1>{t('entry.title')}</h1>
        <p>{t('entry.line')}</p>
      </div>
      <div className={`entry-hint${p > 0.02 || !ready || mapOpen ? ' gone' : ''}`} aria-hidden="true">
        <span>{t('entry.hint')}</span>
      </div>
      {!mapOpen && <MuteButton />}
      {!paused && <Loader done={ready} label={t('entry.title')} status={t('entry.loading')} />}
    </div>
  )
}
