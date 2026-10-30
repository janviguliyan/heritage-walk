import { Howl, Howler } from 'howler'
import { live, store } from './store'

// All ambience and music is synthesised with Web Audio on Howler's context, so there are no
// audio files to license yet and Howler's global mute covers everything. Recorded narration
// (e.g. Piper TTS output) plays through Howler when a hotspot lists an `audio` file.

let ctx: AudioContext | null = null
// Howler's own unlock closes its context and opens a new one on the first tap when the device
// doesn't run at 44.1 kHz (most Macs run at 48), which would strand every node built here on a
// dead context; startAudio resumes the context from the user's gesture instead
Howler.autoUnlock = false
let master: GainNode
let ambience: GainNode
let musicBus: GainNode
let reverbSend: GainNode
let seaGain: GainNode | null = null
let synthBus: GainNode
let track: Howl | null = null
let trackSrc: string | null | undefined = undefined
let windGain: GainNode
let windFilter: BiquadFilterNode
let started = false
// music sinks under a voice (the story), and comes back after
let duck = 1

export interface AudioZones {
  /** world x,z of the sea direction; sea is louder near here. Omit for no sea. */
  sea?: [number, number] | null
  /** a recorded music track (looped) instead of the generated music */
  music?: string
  /** places with stone reverb */
  reverb: { x: number; z: number; r: number }[]
}

let zones: AudioZones = { sea: [200, 0], reverb: [] }

function noiseBuffer(c: AudioContext, seconds: number, brown: boolean) {
  const buf = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate)
  const d = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1
    if (brown) {
      last = (last + 0.02 * w) / 1.02
      d[i] = last * 3.5
    } else d[i] = w
  }
  return buf
}

function impulse(c: AudioContext, seconds: number) {
  const buf = c.createBuffer(2, c.sampleRate * seconds, c.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3
  }
  return buf
}

function loop(c: AudioContext, buf: AudioBuffer) {
  const s = c.createBufferSource()
  s.buffer = buf
  s.loop = true
  s.start()
  return s
}

export function startAudio(z: AudioZones) {
  zones = z
  if (started) {
    setMusicTrack(z.music ?? null)
    return
  }
  started = true
  Howler.autoSuspend = false
  Howler.volume(1)
  ctx = Howler.ctx
  if (!ctx) return
  void ctx.resume()
  master = ctx.createGain()
  master.connect(Howler.masterGain)
  ambience = ctx.createGain()
  ambience.gain.value = 0.9
  ambience.connect(master)
  musicBus = ctx.createGain()
  musicBus.gain.value = store.get().music ? 0.32 : 0
  musicBus.connect(master)
  const verb = ctx.createConvolver()
  verb.buffer = impulse(ctx, 2.8)
  reverbSend = ctx.createGain()
  reverbSend.gain.value = 0
  reverbSend.connect(verb)
  verb.connect(master)

  // sea: brown noise, low-passed, swelling like surf — only where the site is by the sea
  if (zones.sea) {
    const sea = loop(ctx, noiseBuffer(ctx, 6, true))
    const seaLP = ctx.createBiquadFilter()
    seaLP.type = 'lowpass'
    seaLP.frequency.value = 420
    seaGain = ctx.createGain()
    seaGain.gain.value = 0
    const swell = ctx.createOscillator()
    swell.frequency.value = 0.09
    const swellDepth = ctx.createGain()
    swellDepth.gain.value = 0.25
    swell.connect(swellDepth).connect(seaGain.gain)
    swell.start()
    sea.connect(seaLP).connect(seaGain).connect(ambience)
  }

  // wind: white noise through a wandering band-pass
  const wind = loop(ctx, noiseBuffer(ctx, 4, false))
  windFilter = ctx.createBiquadFilter()
  windFilter.type = 'bandpass'
  windFilter.frequency.value = 380
  windFilter.Q.value = 0.6
  windGain = ctx.createGain()
  windGain.gain.value = 0.014
  wind.connect(windFilter).connect(windGain).connect(ambience)

  synthBus = ctx.createGain()
  synthBus.gain.value = 0
  synthBus.connect(musicBus)
  scheduleBirds()
  startMusic()
  setMusicTrack(zones.music ?? null)
  store.subscribe(() => {
    const s = store.get()
    Howler.mute(s.muted)
    if (ctx) musicBus.gain.setTargetAtTime(s.music ? 0.32 * duck : 0, ctx.currentTime, 0.8)
    if (track) track.fade(track.volume(), s.music ? TRACK_VOL * duck : 0, 800)
  })
  Howler.mute(store.get().muted)
}

const TRACK_VOL = 0.5

/** Play a recorded track (looped, crossfaded), or null for the generated music. */
export function setMusicTrack(src: string | null) {
  if (!ctx || src === trackSrc) return
  trackSrc = src
  const old = track
  if (old) {
    old.fade(old.volume(), 0, 1500)
    setTimeout(() => old.unload(), 1600)
  }
  track = null
  synthBus.gain.setTargetAtTime(src ? 0 : 1, ctx.currentTime, 1)
  if (!src) return
  track = new Howl({ src: [src], loop: true, volume: 0, html5: false })
  track.play()
  track.fade(0, store.get().music ? TRACK_VOL * duck : 0, 5000)
}

/** Lower the music (and the sea) while a voice tells a story; restore it after. */
export function duckMusic(on: boolean) {
  duck = on ? 0.18 : 1
  if (!ctx) return
  const m = store.get().music
  musicBus.gain.setTargetAtTime(m ? 0.32 * duck : 0, ctx.currentTime, 0.6)
  ambience.gain.setTargetAtTime(on ? 0.35 : 0.9, ctx.currentTime, 0.6)
  if (track) track.fade(track.volume(), m ? TRACK_VOL * duck : 0, 900)
}

/** Called each frame: sea fades with distance from the coast side, reverb rises near stone halls. */
export function updateAudio(t: number) {
  if (!ctx) return
  if (seaGain && zones.sea) {
    const d = Math.hypot(live.x - zones.sea[0], live.z - zones.sea[1])
    seaGain.gain.setTargetAtTime(0.25 + Math.max(0, 0.7 - d / 300), ctx.currentTime, 0.5)
  }
  windFilter.frequency.setTargetAtTime(380 + Math.sin(t * 0.13) * 120 + Math.sin(t * 0.41) * 60, ctx.currentTime, 0.3)
  windGain.gain.setTargetAtTime(0.012 + 0.01 * (Math.sin(t * 0.21) * 0.5 + 0.5) + Math.max(0, live.y - 3) * 0.002, ctx.currentTime, 0.4)
  let wet = 0
  for (const r of zones.reverb) {
    const k = 1 - Math.hypot(live.x - r.x, live.z - r.z) / r.r
    wet = Math.max(wet, k)
  }
  reverbSend.gain.setTargetAtTime(Math.max(0, wet) * 0.6, ctx.currentTime, 0.3)
}

/** What is underfoot, for the sound of a step. */
export type FootSurface = 'stone' | 'paving' | 'grass'

/**
 * One footstep, synthesised for the surface: a heel strike and a scuff, each a short burst of
 * filtered noise. Broad, low-Q filters and a little randomness in every step keep it from ringing
 * (a single sharp filter on white noise, with the halls' reverb, made steps sound like metal).
 * Only the temple's platforms send to the reverb: out on the court and the lawns it is open air.
 */
export function footstep(surface: FootSurface, running: boolean) {
  if (!ctx) return
  const c = ctx
  const now = c.currentTime
  const out = c.createGain()
  out.gain.value = running ? 1.15 : 1
  out.connect(ambience)
  if (surface === 'stone') {
    const send = c.createGain()
    send.gain.value = 0.35
    out.connect(send).connect(reverbSend)
  }
  const jitter = (v: number, k = 0.15) => v * (1 + (Math.random() * 2 - 1) * k)
  /** a burst: `len` s long, rising over `attack` (fraction), falling with `fall`; `grit` adds
   *  sparse crackles (grass blades, grains); filtered `type` at `freq`, gentle Q */
  const burst = (len: number, attack: number, fall: number, grit: number, type: BiquadFilterType, freq: number, gain: number, delay = 0) => {
    const n = Math.floor(c.sampleRate * len)
    const buf = c.createBuffer(1, n, c.sampleRate)
    const d = buf.getChannelData(0)
    let brown = 0
    for (let i = 0; i < n; i++) {
      const t = i / n
      const env = t < attack ? t / attack : Math.pow(1 - (t - attack) / (1 - attack), fall)
      brown = brown * 0.9 + (Math.random() * 2 - 1) * 0.1
      const w = Math.random() * 2 - 1
      const crackle = grit > 0 && Math.random() < grit ? (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.4) : 0
      d[i] = (w * 0.5 + brown * 2.5 + crackle * 1.6) * env
    }
    const src = c.createBufferSource()
    src.buffer = buf
    const f = c.createBiquadFilter()
    f.type = type
    f.frequency.value = jitter(freq)
    f.Q.value = 0.5
    const g = c.createGain()
    g.gain.value = jitter(gain, 0.2)
    src.connect(f).connect(g).connect(out)
    src.start(now + delay)
  }
  /** grass underfoot: no smooth hiss (a swelling puff of noise at walking pace sounded like a
   *  steam engine), but a scatter of tiny separate snaps and rustles, most of them early as the
   *  foot lands, thinning out as it settles */
  const blades = (gain: number) => {
    const len = 0.2
    const n = Math.floor(c.sampleRate * len)
    const buf = c.createBuffer(1, n, c.sampleRate)
    const d = buf.getChannelData(0)
    const grains = 30 + Math.floor(Math.random() * 20)
    for (let k = 0; k < grains; k++) {
      // when: crowded at the start of the step
      const at = Math.floor(Math.pow(Math.random(), 2.2) * (n - 400))
      const dur = Math.floor(c.sampleRate * (0.004 + Math.random() * 0.01))
      const amp = (0.2 + Math.random() * 0.4) * (1 - at / n)
      // each grain eases in and out (no hard click edges)
      for (let i = 0; i < dur && at + i < n; i++) d[at + i] += (Math.random() * 2 - 1) * amp * Math.sin((Math.PI * i) / dur)
    }
    const src = c.createBufferSource()
    src.buffer = buf
    const hp = c.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = jitter(500)
    hp.Q.value = 0.5
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = jitter(2800)
    lp.Q.value = 0.5
    const g = c.createGain()
    g.gain.value = jitter(gain, 0.2)
    src.connect(hp).connect(lp).connect(g).connect(out)
    src.start(now)
  }
  switch (surface) {
    case 'grass':
      // the blades, and a soft heel on the earth beneath
      blades(0.16)
      burst(0.08, 0.15, 3, 0, 'lowpass', 200, 0.07)
      break
    case 'paving':
      // a dull heel on the flags, then the gritty scuff of the sole
      burst(0.08, 0.04, 3.5, 0, 'lowpass', 480, 0.42)
      burst(0.12, 0.2, 2.2, 0.004, 'bandpass', 1900, 0.09, 0.012)
      break
    case 'stone':
      // the carved platforms: a firmer, drier tap, a little grit
      burst(0.07, 0.03, 4.5, 0, 'lowpass', 380, 0.5)
      burst(0.07, 0.15, 3, 0.003, 'bandpass', 2600, 0.06, 0.008)
      break
  }
}

function chirp(at: number) {
  if (!ctx) return
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  const p = ctx.createStereoPanner()
  p.pan.value = Math.random() * 2 - 1
  const base = 2600 + Math.random() * 1800
  const notes = 2 + Math.floor(Math.random() * 4)
  g.gain.value = 0
  for (let i = 0; i < notes; i++) {
    const t = at + i * (0.09 + Math.random() * 0.05)
    o.frequency.setValueAtTime(base, t)
    o.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random() * 0.4), t + 0.06)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.025, t + 0.01)
    g.gain.linearRampToValueAtTime(0, t + 0.07)
  }
  o.connect(g).connect(p).connect(ambience)
  o.start(at)
  o.stop(at + notes * 0.15 + 0.1)
}

function scheduleBirds() {
  if (!ctx) return
  chirp(ctx.currentTime + 0.1)
  setTimeout(scheduleBirds, 2500 + Math.random() * 6000)
}

// Generated music in an Odissi idiom: a tanpura-like drone on Sa and Pa, a bamboo-flute line
// wandering through raga Bhupali (S R G P D), and a soft mardala-style drum.
const SA = 146.83 // D3
const BHUPALI = [0, 2, 4, 7, 9, 12, 14, 16]

function startMusic() {
  if (!ctx) return
  const c = ctx
  const drone = c.createGain()
  drone.gain.value = 0.12
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 900
  drone.connect(lp).connect(synthBus)
  for (const [f, det] of [[SA / 2, 0], [SA * 0.75, 3], [SA, -2], [SA, 4]] as const) {
    const o = c.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = f
    o.detune.value = det
    const g = c.createGain()
    g.gain.value = 0.25
    const lfo = c.createOscillator()
    lfo.frequency.value = 0.15 + Math.random() * 0.2
    const lg = c.createGain()
    lg.gain.value = 0.12
    lfo.connect(lg).connect(g.gain)
    lfo.start()
    o.connect(g).connect(drone)
    o.start()
  }

  const fluteVerb = c.createConvolver()
  fluteVerb.buffer = impulse(c, 3.5)
  const fluteOut = c.createGain()
  fluteOut.gain.value = 0.5
  fluteOut.connect(synthBus)
  fluteOut.connect(fluteVerb).connect(synthBus)

  let step = 3
  let next = c.currentTime + 2
  const phrase = () => {
    if (!ctx) return
    while (next < c.currentTime + 4) {
      const notes = 3 + Math.floor(Math.random() * 4)
      for (let i = 0; i < notes; i++) {
        step = Math.max(0, Math.min(BHUPALI.length - 1, step + Math.floor(Math.random() * 3) - 1))
        const dur = [0.5, 0.75, 1, 1.5][Math.floor(Math.random() * 4)]
        flute(c, fluteOut, SA * 2 ** (BHUPALI[step] / 12), next, dur)
        next += dur
      }
      next += 1.5 + Math.random() * 3
    }
    setTimeout(phrase, 1000)
  }
  phrase()

  let beat = c.currentTime + 1
  const pattern = [1, 0, 0, 0.5, 0, 0.6, 0, 0]
  let k = 0
  const drum = () => {
    if (!ctx) return
    while (beat < c.currentTime + 1) {
      const v = pattern[k % pattern.length]
      if (v) mardala(c, synthBus, beat, v, k % 4 === 0)
      beat += 0.42
      k++
    }
    setTimeout(drum, 250)
  }
  drum()
}

function flute(c: AudioContext, out: AudioNode, f: number, t: number, dur: number) {
  const o = c.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(f * 0.985, t)
  o.frequency.linearRampToValueAtTime(f, t + 0.08)
  const vib = c.createOscillator()
  vib.frequency.value = 5
  const vg = c.createGain()
  vg.gain.setValueAtTime(0, t)
  vg.gain.linearRampToValueAtTime(f * 0.008, t + dur * 0.6)
  vib.connect(vg).connect(o.frequency)
  const g = c.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(0.09, t + 0.07)
  g.gain.setTargetAtTime(0, t + dur * 0.85, 0.12)
  o.connect(g).connect(out)
  o.start(t)
  vib.start(t)
  o.stop(t + dur + 0.6)
  vib.stop(t + dur + 0.6)
}

function mardala(c: AudioContext, out: AudioNode, t: number, v: number, low: boolean) {
  const o = c.createOscillator()
  const g = c.createGain()
  o.frequency.setValueAtTime(low ? 110 : 190, t)
  o.frequency.exponentialRampToValueAtTime(low ? 55 : 140, t + 0.25)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.22 * v, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
  o.connect(g).connect(out)
  o.start(t)
  o.stop(t + 0.4)
}

/** A low temple bell with a soft swell: marks arriving at a place. */
export function chime() {
  if (!ctx || store.get().muted) return
  const t = ctx.currentTime
  const out = ctx.createGain()
  out.gain.value = 0.22
  out.connect(master)
  out.connect(reverbSend)
  // inharmonic partials of a bronze bell, each with its own decay
  for (const [f, a, d] of [[110, 1, 7], [220.5, 0.55, 5], [298, 0.4, 4], [440, 0.25, 3], [587, 0.15, 2.4], [831, 0.08, 1.6]] as const) {
    const o = ctx.createOscillator()
    o.frequency.value = f
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(a, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + d)
    o.connect(g).connect(out)
    o.start(t)
    o.stop(t + d + 0.1)
  }
}

/** One chisel strike: a bright tap with a short stone ring. */
export function chisel(level = 1) {
  if (!ctx || store.get().muted) return
  const t = ctx.currentTime
  const len = 0.05
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3
  const src = ctx.createBufferSource()
  src.buffer = buf
  const hp = ctx.createBiquadFilter()
  hp.type = 'bandpass'
  hp.frequency.value = 2400 + Math.random() * 1600
  hp.Q.value = 1.4
  const g = ctx.createGain()
  g.gain.value = 0.12 * level
  src.connect(hp).connect(g)
  g.connect(ambience)
  g.connect(reverbSend)
  src.start(t)
  const o = ctx.createOscillator()
  o.frequency.value = 1900 + Math.random() * 700
  const og = ctx.createGain()
  og.gain.setValueAtTime(0.025 * level, t)
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
  o.connect(og).connect(ambience)
  o.start(t)
  o.stop(t + 0.13)
}
