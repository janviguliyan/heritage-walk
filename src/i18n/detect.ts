import { ENABLED } from './languages'

/** Language from ?lang=, then the last choice, else English. */
export function detectLanguage() {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('lang') : null
  let saved: string | null = null
  try {
    saved = localStorage.getItem('lang')
  } catch {
    /* storage may be unavailable */
  }
  return [q, saved].find((c) => c && ENABLED.some((l) => l.code === c)) ?? 'en'
}
