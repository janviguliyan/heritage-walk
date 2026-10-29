import { store, useStore } from '../engine/store'
import { useT } from '../i18n'

/** Carved bronze sound toggle, shared by the entry scenes. */
export function MuteButton() {
  const t = useT()
  const muted = useStore((s) => s.muted)
  return (
    <button className="entry-mute" aria-pressed={!muted} aria-label={muted ? t('hud.soundOff') : t('hud.soundOn')} onClick={() => store.set({ muted: !muted })}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" />
        {muted ? <path d="m16 9 6 6M22 9l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />}
      </svg>
    </button>
  )
}
