import type { SiteDefinition } from './site'
import { tx } from './content'
import { commands, store } from './store'
import { startNarration, stopNarration } from './narrator'
import { startAudio } from './audio'

let site: SiteDefinition | null = null

export function setSite(s: SiteDefinition) {
  site = s
}

export const hotspots = () => site?.content.hotspots ?? []

/** Open a stop's story panel and start narrating. Walking stays possible. */
export function openHotspot(id: string) {
  if (!site) return
  const i = site.content.hotspots.findIndex((h) => h.id === id)
  if (i < 0) return
  const h = site.content.hotspots[i]
  const s = store.get()
  store.set({
    activeId: id,
    panelMin: false,
    current: i,
    visited: s.visited.includes(id) ? s.visited : [...s.visited, id],
  })
  narrate(h.id)
}

function narrate(id: string) {
  const h = hotspots().find((x) => x.id === id)
  if (!h) return
  const lang = store.get().lang
  startNarration(h.id, tx(h.title, lang), tx(h.body, lang), lang)
}

// switching language mid-story restarts the narration in the new language
let lastLang = store.get().lang
store.subscribe(() => {
  const s = store.get()
  if (s.lang === lastLang) return
  lastLang = s.lang
  if (s.activeId) narrate(s.activeId)
})

export function closeCard() {
  stopNarration()
  store.set({ activeId: null })
}

/** Glide (walking) to the next stop on the route, or a given one. */
export function goToStop(index?: number) {
  const list = hotspots()
  const s = store.get()
  const target = index ?? s.current + 1
  if (target >= list.length) {
    closeCard()
    showEnd()
    return
  }
  closeCard()
  if (s.overview) {
    flyToStop(Math.max(0, target))
    return
  }
  commands.glideTo = { index: Math.max(0, target) }
}

// --- the aerial map ---------------------------------------------------------

export function openMap() {
  const s = store.get()
  if (s.overview || s.flying) return
  if (document.pointerLockElement) document.exitPointerLock()
  store.set({ overview: true, showEnd: false, reconstruction: false })
  commands.fly = { to: 'map' }
}

/** From the map, fly down to the walker's current spot. */
export function closeMap() {
  const s = store.get()
  if (!s.overview || s.flying) return
  commands.fly = { to: 'player' }
}

/** From the map, fly down to a stop and open its story. */
export function flyToStop(index: number) {
  const s = store.get()
  if (s.flying) return
  closeCard()
  if (site) startAudio(site.audio) // a click on the map counts as the first interaction
  if (s.phase !== 'walk') store.set({ phase: 'walk' })
  commands.fly = { to: 'stop', index }
}

/** From the journey pages into the 3D walk: fly down from the sky to a stop. */
export function enterTour(index = 0) {
  if (!site) return
  startAudio(site.audio)
  store.set({ screen: 'tour', mode: 'guided' })
  // the canvas starts rendering on this frame; give it one before the flight begins
  requestAnimationFrame(() => flyToStop(index))
}

/** Back to the site's welcome page (the walk stays loaded, paused, and resumes where you were). */
export function leaveTour() {
  if (document.pointerLockElement) document.exitPointerLock()
  closeCard()
  store.set({ screen: 'overview', showEnd: false, reconstruction: false, phase: 'intro' })
}

/** From the intro, fly down to the east gate and walk freely. */
export function flyToStart() {
  if (store.get().flying) return
  if (site) startAudio(site.audio)
  store.set({ phase: 'walk', mode: 'free' })
  commands.fly = { to: 'start' }
}

export function showEnd() {
  if (document.pointerLockElement) document.exitPointerLock()
  store.set({ showEnd: true, reconstruction: true, activeId: null })
  commands.glideTo = { index: -1 }
}

export function hideEnd() {
  store.set({ showEnd: false, reconstruction: false })
}
