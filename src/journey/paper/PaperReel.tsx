import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, DepthOfField, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import { BlendFunction, type DepthOfFieldEffect } from 'postprocessing'
import * as THREE from 'three'
import type { SiteDefinition } from '../../engine/site'
import { store, useStore } from '../../engine/store'
import { narrateText, splitSentences, stopNarration } from '../../engine/narrator'
import { chisel, duckMusic, startAudio } from '../../engine/audio'
import { MuteButton } from '../../entry/MuteButton'
import { useT } from '../../i18n'
import { buildShots } from './shots'
import { clamp01, easeIn, easeInOut, easeOutBack, paperTexture } from './kit'
import './paper.css'

// The story of Konark in about a minute, told in six paper-cut scenes (shots.ts) with
// Sarvam narration (reel-0..5 in vo/). Each scene pops up layer by layer, plays while its
// lines are spoken, and folds away as the next arrives. Skip at any time (Esc).

const SHOTS = 6
const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Seconds a line takes: the recorded clips when they exist, else a reading estimate. */
function useDurations(base: string, lang: string, lines: string[]) {
  const [d, setD] = useState<number[]>(() => lines.map((l) => l.split(/\s+/).length / 2.3 + 1))
  useEffect(() => {
    let live = true
    Promise.all(
      lines.map((line, i) =>
        Promise.all(
          splitSentences(line).map(
            (_, j) =>
              new Promise<number>((res) => {
                const a = new Audio()
                a.preload = 'metadata'
                a.onloadedmetadata = () => res(a.duration)
                a.onerror = () => res(NaN)
                a.src = `${base}vo/${lang}/reel-${i}-${j}.mp3`
              }),
          ),
        ).then((ds) => (ds.every((x) => x > 0) ? ds.reduce((a, b) => a + b, 0) + ds.length * 0.12 : line.split(/\s+/).length / 2.3 + 1)),
      ),
    ).then((ds) => live && setD(ds))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, lang, lines.join('|')])
  return d
}

/** Whether the rendered film (tools/blender/story.py) is present: null while checking. */
function useFilm(base: string) {
  const [ok, setOk] = useState<boolean | null>(null)
  useEffect(() => {
    Promise.all([0, SHOTS - 1].map((i) => fetch(`${base}story/scene-${i}.mp4`, { method: 'HEAD' }).then((r) => r.ok && (r.headers.get('content-type') ?? '').startsWith('video/'))))
      .then((v) => setOk(v.every(Boolean)))
      .catch(() => setOk(false))
  }, [base])
  return ok
}

/** The film: one clip per scene, the next one loading while this plays, crossfading as they change. */
function Film({ base, beat, onEnded }: { base: string; beat: number; onEnded: () => void }) {
  const refs = useRef<(HTMLVideoElement | null)[]>([])
  useEffect(() => {
    const v = refs.current[beat]
    if (!v) return
    v.currentTime = 0
    void v.play().catch(() => {})
  }, [beat])
  const shown = [beat - 1, beat, beat + 1].filter((i) => i >= 0 && i < SHOTS)
  return (
    <div className="film" aria-hidden="true">
      {shown.map((i) => (
        <video
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          className={i === beat ? 'on' : ''}
          src={`${base}story/scene-${i}.mp4`}
          poster={`${base}story/scene-${i}.jpg`}
          muted
          playsInline
          preload="auto"
          onEnded={() => i === beat && onEnded()}
        />
      ))}
    </div>
  )
}

export function PaperReel({ site }: { site: SiteDefinition }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const muted = useStore((s) => s.muted)
  const speech = useStore((s) => s.speech)
  const sentence = useStore((s) => s.sentence)
  // ?beat=N opens a scene directly (review)
  const [beat, setBeat] = useState(() => Math.min(SHOTS - 1, Math.max(0, Number(new URLSearchParams(location.search).get('beat')) || 0)))
  const [ending, setEnding] = useState(false)
  const started = useRef(performance.now())
  const lines = useMemo(() => Array.from({ length: SHOTS }, (_, i) => t(`reel.${i + 1}` as 'reel.1')), [t])
  const durations = useDurations(site.assetBase, lang, lines)
  const film = useFilm(site.assetBase)
  // the film's clip for this scene has played to its end (it then holds its last frame)
  const [filmDone, setFilmDone] = useState(false)
  const clock = useRef({ beat: 0, start: performance.now() / 1000, durations })
  // when this scene's narration finished (seconds into the scene; 0 = not yet)
  const doneAt = useRef(0)
  // this scene's narration has been heard (a 'done' left over from the last scene must not count)
  const spoke = useRef(false)
  clock.current.durations = durations

  const finish = () => {
    if (ending) return
    setEnding(true)
    stopNarration()
    window.setTimeout(() => store.set({ screen: 'overview' }), 1100)
  }

  useEffect(() => {
    startAudio(site.audio)
    duckMusic(true)
    const tap = () => chisel(0.7)
    window.addEventListener('reel-chisel', tap)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && finish()
    window.addEventListener('keydown', onKey)
    return () => {
      stopNarration()
      duckMusic(false)
      window.removeEventListener('reel-chisel', tap)
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // each scene: speak its lines, and give the picture its moment
  useEffect(() => {
    started.current = performance.now()
    clock.current.beat = beat
    clock.current.start = performance.now() / 1000
    setFilmDone(false)
    doneAt.current = 0
    spoke.current = false
    narrateText(`reel-${beat}`, lines[beat], lang, true)
    // fetch the next scene's voice now, so it starts the moment its picture does
    if (beat + 1 < SHOTS)
      splitSentences(lines[beat + 1]).forEach((_, j) => void fetch(`${site.assetBase}vo/${lang}/reel-${beat + 1}-${j}.mp3`).catch(() => {}))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beat, lang])

  useEffect(() => {
    const id = window.setInterval(() => {
      const s = (performance.now() - started.current) / 1000
      const d = durations[beat]
      const next = () => (beat < SHOTS - 1 ? setBeat(beat + 1) : finish())
      if (film) {
        // the voice leads: a short beat after its last line, the next scene crossfades in (each
        // clip is cut to the longest language, so in the others it is simply still playing).
        // Without a voice, the clip's own length sets the pace.
        if (speech === 'speaking') spoke.current = true
        if (speech === 'done' && spoke.current) {
          if (doneAt.current === 0) doneAt.current = s
          if (s - doneAt.current > 0.7) next()
        } else if ((muted || speech === 'unavailable') && (filmDone || s > d)) next()
        else if (s > d + 6) next()
        return
      }
      const spoken = speech === 'done' && s >= d * 0.85
      const silent = (muted || speech === 'unavailable' || speech === 'idle') && s >= d + 0.6
      const hold = beat === SHOTS - 1 ? 2.2 : 0.5
      if ((spoken || silent) && s >= Math.min(d, 6) + hold) {
        if (beat < SHOTS - 1) setBeat(beat + 1)
        else finish()
      } else if (s > d + 8) {
        if (beat < SHOTS - 1) setBeat(beat + 1)
        else finish()
      }
    }, 150)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beat, speech, muted, durations, film, filmDone])

  // the caption is the sentence being spoken; without a voice it follows the clock
  const parts = splitSentences(lines[beat])
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setTick((x) => x + 1), 250)
    return () => window.clearInterval(id)
  }, [])
  const elapsed = (performance.now() - started.current) / 1000 + tick * 0
  const byClock = Math.min(parts.length - 1, Math.floor((elapsed / durations[beat]) * parts.length))
  const line = speech === 'speaking' || speech === 'paused' ? Math.max(0, Math.min(parts.length - 1, sentence)) : speech === 'done' ? parts.length - 1 : byClock
  const titleOn = beat === SHOTS - 1 && line >= Math.min(2, parts.length - 1)

  return (
    <div className={`reel paper-reel${ending ? ' ending' : ''}`}>
      {film && <Film base={site.assetBase} beat={beat} onEnded={() => setFilmDone(true)} />}
      {film === false && (
      <Canvas
        shadows="percentage"
        dpr={[1, 2]}
        gl={{ antialias: false, powerPreference: 'high-performance', toneMapping: THREE.NeutralToneMapping, preserveDrawingBuffer: new URLSearchParams(location.search).has('shot') }}
        camera={{ fov: 30, near: 0.1, far: 80, position: [0, 0, 15] }}
        onCreated={({ gl }) => {
          gl.shadowMap.type = THREE.PCFShadowMap
        }}
      >
        <Stage beat={beat} clock={clock} />
        <EffectComposer multisampling={4}>
          {/* a miniature's shallow focus: sharp on the scene's subject, soft before and behind */}
          <DepthOfField ref={dofRef} worldFocusDistance={12.5} worldFocusRange={5} bokehScale={reduced ? 0 : 2.4} />
          <Bloom mipmapBlur luminanceThreshold={0.82} intensity={0.45} radius={0.75} />
          <Vignette offset={0.28} darkness={0.5} />
          <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.12} />
        </EffectComposer>
      </Canvas>
      )}
      <TheatreFrame />
      <div className="reel-shade" aria-hidden="true" />
      <h1 className={`paper-title${titleOn ? ' on' : ''}`} aria-hidden={!titleOn}>
        {t('reel.title')}
      </h1>
      <p key={`${beat}-${line}-${lang}`} className="reel-caption" aria-live="polite" lang={lang}>
        {parts[line]}
      </p>
      <div className="reel-progress" aria-hidden="true">
        {lines.map((_, i) => (
          <span key={i} className={i < beat ? 'done' : i === beat ? 'on' : ''}>
            {i === beat && <i style={{ animationDuration: `${durations[i] + 0.5}s` }} />}
          </span>
        ))}
      </div>
      <MuteButton />
      <button className="reel-skip" onClick={finish}>
        {beat === SHOTS - 1 ? t('reel.continue') : t('story.skip')} →
      </button>
    </div>
  )
}

/** The paper-theatre frame: a dark card with a scalloped opening, a gold inlay, and cut dots. */
function TheatreFrame() {
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  const { w, h } = vp
  const band = Math.round(Math.min(w, h) * 0.04)
  // the opening: a rounded rectangle whose edge is a row of small scallops
  const scallop = (inset: number, bump: number) => {
    const x0 = inset
    const y0 = inset
    const x1 = w - inset
    const y1 = h - inset
    const r = band * 1.4
    const pts: [number, number][] = []
    const edge = (ax: number, ay: number, bx: number, by: number, nx: number, ny: number) => {
      const len = Math.hypot(bx - ax, by - ay)
      const n = Math.max(1, Math.round(len / (bump * 3.2)))
      for (let i = 0; i < n * 8; i++) {
        const t = i / (n * 8)
        const k = Math.sin((i % 8) / 8 * Math.PI) * bump
        pts.push([ax + (bx - ax) * t + nx * k, ay + (by - ay) * t + ny * k])
      }
    }
    const corner = (cx: number, cy: number, a0: number) => {
      for (let i = 0; i < 12; i++) {
        const a = a0 + (i / 12) * (Math.PI / 2)
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
      }
    }
    edge(x0 + r, y0, x1 - r, y0, 0, 1)
    corner(x1 - r, y0 + r, -Math.PI / 2)
    edge(x1, y0 + r, x1, y1 - r, -1, 0)
    corner(x1 - r, y1 - r, 0)
    edge(x1 - r, y1, x0 + r, y1, 0, -1)
    corner(x0 + r, y1 - r, Math.PI / 2)
    edge(x0, y1 - r, x0, y0 + r, 1, 0)
    corner(x0 + r, y0 + r, Math.PI)
    return 'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L') + 'Z'
  }
  const bump = band * 0.22
  const dots: string[] = []
  const dot = (x: number, y: number) => dots.push(`M${(x + band * 0.09).toFixed(1)} ${y.toFixed(1)}a${(band * 0.09).toFixed(1)} ${(band * 0.09).toFixed(1)} 0 1 0 0.01 0Z`)
  const mid = band * 0.42
  const gap = band * 0.75
  for (let x = band; x < w - band; x += gap) dot(x, mid), dot(x, h - mid)
  for (let y = band; y < h - band; y += gap) dot(mid, y), dot(w - mid, y)
  return (
    <svg className="theatre" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <defs>
        <linearGradient id="th-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f3d27c" />
          <stop offset="0.5" stopColor="#c48a2c" />
          <stop offset="1" stopColor="#e9b95a" />
        </linearGradient>
      </defs>
      {/* gold under-card, seen through the dots and as the inlay */}
      <path d={`M0 0H${w}V${h}H0Z ${scallop(band * 0.9, bump)}`} fillRule="evenodd" fill="url(#th-gold)" />
      <path className="th-card" d={`M0 0H${w}V${h}H0Z ${scallop(band, bump)} ${dots.join(' ')}`} fillRule="evenodd" />
    </svg>
  )
}

type Clock = { beat: number; start: number; durations: number[] }

/** where the camera looks, shared with the depth of field */
const focus = new THREE.Vector3()
const dofRef = { current: null as DepthOfFieldEffect | null }

/** The paper stage: a lit backdrop, the six dioramas, and the camera that moves through them. */
function Stage({ beat, clock }: { beat: number; clock: React.RefObject<Clock> }) {
  const { scene, camera, size } = useThree()
  const shots = useMemo(() => buildShots(), [])
  const light = useMemo(() => {
    const l = new THREE.DirectionalLight('#fff', 2.5)
    l.castShadow = true
    l.shadow.mapSize.set(2048, 2048)
    const c = l.shadow.camera
    c.left = -15
    c.right = 15
    c.top = 10
    c.bottom = -10
    c.near = 0.5
    c.far = 60
    l.shadow.radius = 6
    l.shadow.intensity = 0.62
    l.shadow.bias = -0.0004
    l.shadow.normalBias = 0.02
    return l
  }, [])
  const ambient = useMemo(() => new THREE.HemisphereLight('#fff6e8', '#6b4a2a', 0.8), [])
  const sky = useMemo(() => {
    const top = { value: new THREE.Color(shots[0].sky[0]) }
    const bottom = { value: new THREE.Color(shots[0].sky[1]) }
    const tex = paperTexture().clone()
    tex.needsUpdate = true
    tex.repeat.set(3, 2)
    const m = new THREE.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: 1.2, roughness: 1 })
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTop = top
      sh.uniforms.uBottom = bottom
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vH;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvH = position.y;')
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vH;\nuniform vec3 uTop;\nuniform vec3 uBottom;')
        .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= mix(uBottom, uTop, smoothstep(-2.5, 4.5, vH));')
        // the sky is partly its own light: its colours stay clear, and it still takes shadows
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * 0.55;')
    }
    // its own shader: without this three reuses the plain paper program and the gradient is lost
    m.customProgramCacheKey = () => 'paper-sky'
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(64, 36), m)
    mesh.position.z = -1.6
    mesh.receiveShadow = true
    return { mesh, top, bottom }
  }, [shots])

  // scene state: when each shot arrived and left
  const state = useRef({ shown: -1, enterAt: [] as number[], leaveAt: [] as number[], lastS: 0 })
  useEffect(() => {
    if (new URLSearchParams(location.search).has('shot')) Object.assign(window, { __paper: { scene, sky } })
    scene.add(sky.mesh, ambient, light, light.target)
    shots.forEach((s) => {
      s.group.visible = false
      scene.add(s.group)
      s.layers.forEach((l) => (l.userData.home = l.position.clone()))
    })
    return () => {
      scene.remove(sky.mesh, ambient, light, light.target)
      shots.forEach((s) => scene.remove(s.group))
    }
  }, [scene, shots, sky, ambient, light])

  const camPos = useRef(new THREE.Vector3(...shots[0].cam.from))
  const camLook = useRef(new THREE.Vector3(...shots[0].cam.lookFrom))
  const tmp = new THREE.Vector3()
  const skyFrom = useRef({ top: new THREE.Color(), bottom: new THREE.Color(), at: -10 })

  useFrame((_, dt) => {
    const now = performance.now() / 1000
    const st = state.current
    const c = clock.current
    if (st.shown !== beat) {
      if (st.shown >= 0) st.leaveAt[st.shown] = now
      st.enterAt[beat] = now
      st.shown = beat
      skyFrom.current = { top: sky.top.value.clone(), bottom: sky.bottom.value.clone(), at: now }
    }
    shots.forEach((shot, i) => {
      const enter = st.enterAt[i]
      const leave = st.leaveAt[i]
      const leaving = leave !== undefined && (enter === undefined || leave >= enter) && i !== beat
      const n = shot.layers.length
      if (i !== beat && !leaving) return (shot.group.visible = false)
      if (leaving && now - leave > 1.4) return (shot.group.visible = false)
      shot.group.visible = true
      shot.layers.forEach((l, j) => {
        const home = l.userData.home as THREE.Vector3
        let off = 0
        let fold = 0
        if (leaving) {
          const p = clamp01((now - leave - (n - 1 - j) * 0.05) / 0.75)
          off = -easeIn(p) * 11
          fold = -easeIn(p) * 0.9
        } else {
          const p = reduced ? 1 : clamp01((now - enter - 0.35 - j * 0.13) / 0.95)
          off = -(1 - easeOutBack(p)) * 10
          fold = -(1 - Math.min(1, easeOutBack(p))) * 1.1
          l.visible = p > 0
        }
        l.position.set(home.x, home.y + off, home.z)
        l.rotation.x = fold
      })
      if (i === beat) {
        const s = now - c.start
        const k = clamp01(s / Math.max(2, c.durations[i]))
        shot.update(s, k)
        shot.cue?.(s, st.lastS)
        st.lastS = s
      }
    })

    // the current shot sets the light, the sky and the camera; all ease toward it
    const shot = shots[beat]
    const e = 1 - Math.exp(-dt * 2.2)
    light.position.lerp(tmp.set(...shot.light.pos).multiplyScalar(2), e)
    light.color.lerp(new THREE.Color(shot.light.color), e)
    light.intensity += (shot.light.intensity - light.intensity) * e
    ambient.intensity += (shot.light.ambient - ambient.intensity) * e
    const sp = clamp01((now - skyFrom.current.at) / 1.2)
    sky.top.value.copy(skyFrom.current.top).lerp(new THREE.Color(shot.sky[0]), easeInOut(sp))
    sky.bottom.value.copy(skyFrom.current.bottom).lerp(new THREE.Color(shot.sky[1]), easeInOut(sp))

    const s = now - c.start
    const k = reduced ? 0.5 : easeInOut(clamp01(s / Math.max(2, c.durations[beat] + 1)))
    const cam = shot.cam
    tmp.set(...cam.from).lerp(new THREE.Vector3(...cam.to), k)
    camPos.current.lerp(tmp, 1 - Math.exp(-dt * 3))
    tmp.set(...cam.lookFrom).lerp(new THREE.Vector3(...cam.lookTo), k)
    camLook.current.lerp(tmp, 1 - Math.exp(-dt * 3))
    // narrower windows step back so each scene keeps its width
    const fit = Math.pow(Math.max(1, 1.78 / (size.width / size.height)), 0.9)
    camera.position.copy(camPos.current).sub(camLook.current).multiplyScalar(fit).add(camLook.current)
    camera.lookAt(camLook.current)
    // focus a little in front of the look point: on the subject layers, not the backdrop
    focus.copy(camLook.current).setZ(camLook.current.z + 1.1)
    if (dofRef.current) dofRef.current.cocMaterial.worldFocusDistance = camera.position.distanceTo(focus)
  })
  return null
}
