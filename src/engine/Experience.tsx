import { Suspense, useEffect } from 'react'
import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { KeyboardControls } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import type { SiteDefinition } from './site'
import { commands, live, store, useStore } from './store'
import { setSite } from './actions'
import { Player } from './Player'
import { Hotspots } from './Hotspots'
import { MapPins, MapPinsProjector } from './MapPins'
import { Atmosphere } from './Atmosphere'
import { Effects } from './Effects'
import { Overlay } from './ui/Overlay'

// ?shot keeps the drawing buffer so headless screenshots capture the canvas
const SHOT = new URLSearchParams(location.search).has('shot')

const KEYS = [
  { name: 'forward', keys: ['KeyW', 'ArrowUp'] },
  { name: 'backward', keys: ['KeyS', 'ArrowDown'] },
  { name: 'left', keys: ['KeyA', 'ArrowLeft'] },
  { name: 'right', keys: ['KeyD', 'ArrowRight'] },
  { name: 'run', keys: ['ShiftLeft', 'ShiftRight'] },
]

function Ready() {
  useEffect(() => {
    if (store.get().phase !== 'loading') return
    const q = new URLSearchParams(location.search)
    if (q.has('stop') || q.has('end')) {
      store.set({ phase: 'walk', ...(q.has('end') ? { showEnd: true, reconstruction: true } : {}) })
    } else store.set({ phase: 'intro' })
  }, [])
  return null
}

/** The reusable engine: give it a site definition and it runs the walk. */
export function Experience({ site, active = true }: { site: SiteDefinition; active?: boolean }) {
  setSite(site)
  const quality = useStore((s) => s.quality)
  const recon = useStore((s) => s.reconstruction)
  const low = quality === 'low'
  const { Scene, Reconstruction } = site
  return (
    <KeyboardControls map={KEYS}>
      <div className={`tour-layer${active ? '' : ' hidden'}`} aria-hidden={!active}>
      <Canvas
        key={quality}
        frameloop={active ? 'always' : 'never'}
        shadows={low ? false : 'percentage'}
        dpr={low ? [1, 1.25] : [1, 2]}
        gl={{ antialias: low, powerPreference: 'high-performance', preserveDrawingBuffer: SHOT }}
        camera={{ fov: 70, near: 0.1, far: 6000 }}
        aria-label={site.content.name.en}
        onCreated={({ gl, scene, camera }) => {
          if (SHOT) Object.assign(window, { __gl: gl, __live: live, __store: store, __commands: commands, __scene: scene, __camera: camera, __THREE: THREE })
        }}
      >
        <Suspense fallback={null}>
          <Physics gravity={[0, -9.81, 0]}>
            <Scene low={low} />
            <Player site={site} />
            <Ready />
          </Physics>
          <Hotspots list={site.content.hotspots} />
          <MapPinsProjector content={site.content} />
          {Reconstruction && <Reconstruction visible={recon} />}
          <Atmosphere azimuth={site.sunAzimuth} stops={site.content.hotspots.length} low={low} />
          <Effects low={low} />
        </Suspense>
      </Canvas>
      {active && <MapPins content={site.content} />}
      </div>
      {active && <Overlay site={site} />}
    </KeyboardControls>
  )
}

if (SHOT) {
  // headless review: report the player and renderer state to the console
  setInterval(() => {
    const c = document.querySelector('canvas')
    console.log('[shot]', JSON.stringify({ live, phase: store.get().phase, canvas: c ? [c.width, c.height] : null, lost: (window as unknown as { __gl?: { getContext(): WebGL2RenderingContext } }).__gl?.getContext().isContextLost() }))
  }, 2000)
}
