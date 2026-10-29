import type { SiteDefinition } from '../engine/site'
import { tx } from '../engine/content'
import { store, useStore } from '../engine/store'
import { enterTour } from '../engine/actions'
import { useT } from '../i18n'
import { KolamCorner, Lotus, VineBorder } from './motifs'
import { LanguageSwitcher } from './LanguageSwitcher'

/** Arrival at a site: a welcome, one call to action, and the hand-drawn plan to jump to any spot. */
export function SiteWelcome({ site }: { site: SiteDefinition }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const c = site.content
  const { Plan } = site
  return (
    <div className="paper-page site-page">
      <header className="paper-head">
        <button className="link-back" onClick={() => store.set({ screen: 'india' })}>
          ← {t('site.back')}
        </button>
        <LanguageSwitcher />
      </header>
      <div className="site-grid">
        <section className="welcome">
          <Lotus size={46} className="welcome-lotus" />
          <p className="kicker" lang={lang}>
            {t('site.welcome')}
          </p>
          <h1 lang={lang}>{tx(c.name, lang)}</h1>
          {lang !== 'or' && (
            <p className="welcome-local" lang="or">
              {c.name.or}
            </p>
          )}
          <p className="welcome-line" lang={lang}>
            {tx(c.tagline, lang)}
          </p>
          <button className="cta" onClick={() => store.set({ screen: c.story.length ? 'story' : 'tour' })}>
            {t('site.cta')} →
          </button>
        </section>
        <section className="plan-panel">
          <KolamCorner className="corner tl" />
          <KolamCorner className="corner br" />
          <Plan hotspots={c.hotspots} lang={lang} onSpot={(i) => enterTour(i)} />
          <p className="plan-hint" lang={lang}>
            {t('site.mapHint')}
          </p>
        </section>
      </div>
      <VineBorder className="paper-vine" width={1200} />
    </div>
  )
}
