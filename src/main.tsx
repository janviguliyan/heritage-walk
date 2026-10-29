import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { Journey } from './journey/Journey'
import { konark } from './sites/konark'
import { languageOf } from './i18n/languages'
import { store } from './engine/store'
import './styles.css'
import './journey/journey.css'

document.documentElement.lang = languageOf(store.get().lang).speech.split('-')[0]

// UI feedback toolbar (agentation) — development only, never shipped in a build
const Agentation = import.meta.env.DEV ? lazy(() => import('agentation').then((m) => ({ default: m.Agentation }))) : null

// dev-only light bake (see src/bake): /?bake
if (import.meta.env.DEV && new URLSearchParams(location.search).has('bake')) {
  void import('./bake/run').then((m) => m.runBake())
} else if (import.meta.env.DEV && new URLSearchParams(location.search).has('sculpt')) {
  void import('./bake/preview').then((m) => m.runPreview())
} else
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Journey site={konark} />
    {Agentation && (
      <Suspense fallback={null}>
        <Agentation />
      </Suspense>
    )}
  </StrictMode>,
)
