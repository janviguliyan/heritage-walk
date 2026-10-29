import { tx, type Loc } from '../engine/content'
import { useStore } from '../engine/store'
import { useT } from '../i18n'
import { Loader } from '../ui/Loader'

/** While the walk is put together: the wheel is carved as the temple is built and lit, then the veil opens. */
export function EnterVeil({ name }: { name: Loc }) {
  const lang = useStore((s) => s.lang)
  const ready = useStore((s) => s.sceneReady)
  const stage = useStore((s) => s.loadStage)
  const t = useT()
  return (
    <Loader done={ready} stage={Math.min(1, stage)} stages={2} label={tx(name, lang)} status={ready ? t('load.ready') : stage ? t('load.light') : t('load.build')} />
  )
}
