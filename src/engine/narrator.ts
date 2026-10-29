import { Howl } from 'howler'
import { store } from './store'
import { languageOf } from '../i18n/languages'

// Narration, one sentence at a time, so it can be paused, resumed and replayed
// ("what was just said") while the visitor keeps walking. Sentence 0 is the title.
//
// Voices are generated offline (tools/voice/sarvam_tts.py, Sarvam's Bulbul) into
// <site>/vo/<lang>/<key>-<n>.mp3 and listed in <site>/vo/manifest.json together with
// the exact sentences they speak. A clip is used only if its text still matches, so
// edited text never plays stale audio. Otherwise the device's own voice for that
// language reads it, and the on-screen text is always there.

type Manifest = Record<string, Record<string, string[]>>
let manifest: Manifest = {}
let base = ''
let manifestReady: Promise<void> = Promise.resolve()

export function loadVoiceManifest(assetBase: string) {
  base = assetBase
  manifestReady = fetch(assetBase + 'vo/manifest.json')
    .then((r) => (r.ok ? r.json() : {}))
    .then((m) => void (manifest = m))
    .catch(() => {
      /* no recorded voices yet */
    })
  return manifestReady
}

let sentences: string[] = []
let key = ''
let lang = 'en'
let token = 0
let startedAt = 0
/** only the recorded voice (the story of Konark): never the device's own voice */
let recordedOnly = false
let clip: Howl | null = null
let nextClip: { i: number; key: string; howl: Howl } | null = null

export function splitSentences(text: string) {
  return text
    .split(/(?<=[.!?…।॥])\s+(?=\S)/)
    .map((x) => x.trim())
    .filter(Boolean)
}

/** The sentences as narrated: the title first, then the story. */
export function storySentences(title: string, body: string) {
  return [title, ...splitSentences(body)]
}

const recorded = () => {
  const m = manifest[lang]?.[key]
  return !!m && m.length === sentences.length && m.every((s, i) => s === sentences[i])
}

function deviceVoice() {
  if (!('speechSynthesis' in window)) return undefined
  // on-device voices only: some browsers' default voices send text to a cloud service
  const voices = speechSynthesis.getVoices().filter((v) => v.localService)
  const tag = languageOf(lang).speech
  const prefix = tag.split('-')[0]
  const local = voices.filter((v) => v.lang.replace('_', '-') === tag)
  // the warmest Indian English voices first (Apple's Tara and Aman), then any for the locale
  const preferred = ['Tara', 'Aman', 'Isha', 'Veena', 'Neerja', 'Prabhat', 'Rishi']
  for (const name of preferred) {
    const v = local.find((x) => x.name.startsWith(name))
    if (v) return v
  }
  return local[0] ?? voices.find((v) => v.lang.startsWith(prefix))
}

function stopAudio() {
  clip?.unload()
  clip = null
  if ('speechSynthesis' in window) speechSynthesis.cancel()
}

function speakFrom(i: number, retried = false) {
  const my = ++token
  stopAudio()
  if (i >= sentences.length) return store.set({ speech: 'done', sentence: sentences.length - 1 })
  const s = store.get()
  if (s.muted || !s.narration) return store.set({ speech: 'paused', sentence: i })
  startedAt = performance.now()

  if (recorded()) {
    store.set({ speech: 'speaking', sentence: i })
    clip = nextClip?.i === i && nextClip.key === key ? nextClip.howl : new Howl({ src: [`${base}vo/${lang}/${key}-${i}.mp3`], html5: false })
    clip.once('end', () => my === token && speakFrom(i + 1))
    clip.once('loaderror', () => my === token && speakFrom(i + 1))
    clip.play()
    // load the following sentence while this one plays
    nextClip = i + 1 < sentences.length ? { i: i + 1, key, howl: new Howl({ src: [`${base}vo/${lang}/${key}-${i + 1}.mp3`], html5: false, preload: true }) } : null
    return
  }

  if (recordedOnly || !('speechSynthesis' in window)) return store.set({ speech: 'unavailable', sentence: -1 })
  const voice = deviceVoice()
  if (!voice) {
    if (retried) return store.set({ speech: 'unavailable', sentence: -1 })
    // voices load asynchronously in some browsers
    const retry = () => my === token && speakFrom(i, true)
    speechSynthesis.addEventListener('voiceschanged', retry, { once: true })
    setTimeout(retry, 1200)
    return
  }
  store.set({ speech: 'speaking', sentence: i })
  // queue every remaining sentence at once: the engine flows from one to the next without
  // the stop-start of speaking them one by one; each one marks itself as it begins
  setTimeout(() => {
    if (my !== token) return
    for (let k = i; k < sentences.length; k++) {
      const u = new SpeechSynthesisUtterance(sentences[k])
      u.voice = voice
      u.lang = voice.lang
      u.rate = 0.96
      u.pitch = 1
      u.onstart = () => {
        if (my !== token) return
        startedAt = performance.now()
        store.set({ speech: 'speaking', sentence: k })
      }
      if (k === sentences.length - 1) u.onend = () => my === token && store.set({ speech: 'done', sentence: sentences.length - 1 })
      u.onerror = (e) => {
        if (my === token && e.error !== 'interrupted' && e.error !== 'canceled' && k === sentences.length - 1) store.set({ speech: 'done' })
      }
      speechSynthesis.speak(u)
    }
  }, 40)
}

/** Start narrating a story. `storyKey` names its audio clips (e.g. a hotspot id). */
export function startNarration(storyKey: string, title: string, body: string, language: string) {
  stopNarration()
  recordedOnly = false
  key = storyKey
  lang = language
  sentences = storySentences(title, body)
  speakFrom(0)
}

/** Narrate plain text (no title), e.g. a scene of the story; `recorded` = the recorded voice only. */
export function narrateText(storyKey: string, text: string, language: string, recorded = false) {
  stopNarration()
  recordedOnly = recorded
  key = storyKey
  lang = language
  sentences = splitSentences(text)
  const my = token
  // wait for the list of recordings, so the recorded voice is never pre-empted by another
  void manifestReady.then(() => my === token && speakFrom(0))
}

export function pauseNarration() {
  token++
  stopAudio()
  if (store.get().speech === 'speaking') store.set({ speech: 'paused' })
}

export function resumeNarration() {
  const s = store.get()
  speakFrom(s.speech === 'done' ? 0 : Math.max(0, s.sentence))
}

/** Say the current sentence again; if it has only just begun, go back one. */
export function replayNarration() {
  const s = store.get()
  let i = s.sentence
  if (s.speech === 'done') i = sentences.length - 1
  else if (s.speech === 'speaking' && performance.now() - startedAt < 1500) i -= 1
  speakFrom(Math.max(0, i))
}

/** Jump to sentence i (0 = the title) and speak on from there. */
export function seekNarration(i: number) {
  speakFrom(Math.min(Math.max(0, i), Math.max(0, sentences.length - 1)))
}

export function restartNarration() {
  speakFrom(0)
}

export function stopNarration() {
  token++
  stopAudio()
  store.set({ speech: 'idle', sentence: -1 })
}

// muting pauses the voice; it resumes only when asked
store.subscribe(() => {
  const s = store.get()
  if ((s.muted || !s.narration) && s.speech === 'speaking') pauseNarration()
})
