import { useSyncExternalStore } from 'react'
import { detectLanguage } from '../i18n/detect'

export type Quality = 'high' | 'low'

export type Screen = 'entry' | 'india' | 'site' | 'story' | 'overview' | 'tour' | 'assets'

export interface State {
  /** where the visitor is in the journey: India map → site welcome → story → 3D tour */
  screen: Screen
  /** UI and narration language (see i18n/languages) */
  lang: string
  phase: 'loading' | 'intro' | 'walk'
  mode: 'free' | 'guided'
  quality: Quality
  muted: boolean
  music: boolean
  narration: boolean
  /** hotspot whose story panel is open (walking stays possible) */
  activeId: string | null
  /** story panel expanded or minimised to a pill */
  panelMin: boolean
  /** aerial map view */
  overview: boolean
  /** camera is flying (to or from the map) */
  flying: boolean
  /** narration progress: sentence index into the active story, and playback state */
  sentence: number
  speech: 'idle' | 'speaking' | 'paused' | 'done' | 'unavailable'
  /** hotspot within reach */
  nearId: string | null
  visited: string[]
  /** index of the last stop opened, -1 before the first */
  current: number
  gliding: boolean
  locked: boolean
  showEnd: boolean
  /** 0..1 strength of the reconstructed tower overlay */
  reconstruction: boolean
  touch: boolean
  /** set when the scene's light is baked: the sun is fixed where it was baked */
  bakedSun: { azimuth: number; elevation: number } | null
  /** the overview is showing the stone plan (the 3D site can sleep) */
  stoneView: boolean
  /** Konark's plan is carved and its miniature has risen on the platform */
  konarkReady: boolean
  /** the walk's scene is built and lit */
  sceneReady: boolean
  /** the walk's loading: 0 building the temple, 1 lighting it (sceneReady when done) */
  loadStage: number
  /** a stop marker being hovered on the overview: its index and screen point */
  hoverStop: { i: number; x: number; y: number } | null
}

const touch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
const weak = typeof navigator !== 'undefined' && (navigator.hardwareConcurrency ?? 8) <= 4

function hasReviewParam() {
  if (typeof location === 'undefined') return false
  const q = new URLSearchParams(location.search)
  return q.has('stop') || q.has('end')
}

function qualityParam(): Quality | null {
  if (typeof location === 'undefined') return null
  const q = new URLSearchParams(location.search).get('quality')
  return q === 'low' || q === 'high' ? q : null
}

function screenParam(): Screen {
  if (typeof location === 'undefined') return 'entry'
  const q = new URLSearchParams(location.search)
  if (hasReviewParam()) return 'tour'
  const s = q.get('screen')
  return s === 'india' || s === 'site' || s === 'story' || s === 'overview' || s === 'tour' || s === 'assets' ? s : 'entry'
}

let state: State = {
  screen: screenParam(),
  lang: detectLanguage(),
  phase: 'loading',
  mode: 'free',
  quality: qualityParam() ?? (touch || weak ? 'low' : 'high'),
  muted: false,
  music: true,
  narration: true,
  activeId: null,
  panelMin: false,
  overview: !hasReviewParam(),
  flying: false,
  sentence: -1,
  speech: 'idle',
  nearId: null,
  visited: [],
  current: -1,
  gliding: false,
  locked: false,
  showEnd: false,
  reconstruction: false,
  touch,
  hoverStop: null,
  bakedSun: null,
  stoneView: false,
  konarkReady: false,
  sceneReady: false,
  loadStage: 0,
}

const listeners = new Set<() => void>()

export const store = {
  get: () => state,
  set(patch: Partial<State>) {
    let changed = false
    for (const k in patch) {
      if (state[k as keyof State] !== patch[k as keyof State]) changed = true
    }
    if (!changed) return
    state = { ...state, ...patch }
    listeners.forEach((l) => l())
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
}

export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(store.subscribe, () => sel(state))
}

/** Per-frame values written by the player and read by HUD/audio without re-rendering React. */
export const live = {
  x: 0,
  y: 0,
  z: 0,
  yaw: 0,
  pitch: 0,
  moving: 0,
  sunAzimuth: 100,
  sunElevation: 2,
}

/** One-shot commands from the UI to the player. */
export type Flight = { to: 'map' } | { to: 'stop'; index: number } | { to: 'player' } | { to: 'start' }

export const commands = {
  glideTo: null as null | { index: number },
  /** camera flights between the map and the ground */
  fly: null as null | Flight,
  zoom: 0,
  lookDX: 0,
  lookDY: 0,
  moveX: 0,
  moveY: 0,
}
