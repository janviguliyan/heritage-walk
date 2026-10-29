import en from './ui.en.json'
import { ENABLED, languageOf } from './languages'
import { store, useStore } from '../engine/store'

// UI strings: English is the source; other languages are generated JSON files
// (tools/i18n/translate.py, Sarvam-Translate) and fall back to English per key.
type Dict = Record<string, string>
const dicts: Record<string, Dict> = { en }
const loaded = import.meta.glob<{ default: Dict }>('./ui.*.json', { eager: true })
for (const [path, mod] of Object.entries(loaded)) {
  const code = path.match(/ui\.([a-z]+)\.json$/)?.[1]
  if (code) dicts[code] = mod.default
}

export type UIKey = keyof typeof en

export function translate(lang: string, key: UIKey, vars?: Record<string, string | number>) {
  let s = dicts[lang]?.[key] ?? en[key] ?? key
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v))
  return s
}

export function useT() {
  const lang = useStore((s) => s.lang)
  return (key: UIKey, vars?: Record<string, string | number>) => translate(lang, key, vars)
}

export function setLanguage(code: string) {
  if (!ENABLED.some((l) => l.code === code)) return
  store.set({ lang: code })
  document.documentElement.lang = languageOf(code).speech.split('-')[0]
  try {
    localStorage.setItem('lang', code)
  } catch {
    /* storage may be unavailable */
  }
}
