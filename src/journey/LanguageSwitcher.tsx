import { useEffect, useRef, useState } from 'react'
import { ENABLED } from '../i18n/languages'
import { setLanguage, useT } from '../i18n'
import { useStore } from '../engine/store'

/** Language dropdown: the current language in its own script; the list opens below. */
export function LanguageMenu({ tone = 'bronze' }: { tone?: 'bronze' | 'paper' | 'panel' }) {
  const lang = useStore((s) => s.lang)
  const t = useT()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const cur = ENABLED.find((l) => l.code === lang) ?? ENABLED[0]
  useEffect(() => {
    if (!open) return
    const off = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('pointerdown', off)
    return () => window.removeEventListener('pointerdown', off)
  }, [open])
  return (
    <div ref={root} className={`lang-menu ${tone}`} onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), setOpen(false))}>
      <button className="lang-menu-btn" aria-haspopup="listbox" aria-expanded={open} aria-label={`${t('lang.label')}: ${cur.native}`} onClick={() => setOpen(!open)}>
        <span lang={cur.speech.split('-')[0]}>{cur.native}</span> <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <ul role="listbox" className="lang-menu-list" aria-label={t('lang.label')}>
          {ENABLED.map((l) => (
            <li key={l.code} role="option" aria-selected={l.code === lang}>
              <button
                lang={l.speech.split('-')[0]}
                onClick={() => {
                  setLanguage(l.code)
                  setOpen(false)
                }}
              >
                {l.native}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Kept for existing call sites: every language choice is the dropdown now. */
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  return <LanguageMenu tone={compact ? 'panel' : 'paper'} />
}
