import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { Bloom, BrightnessContrast, EffectComposer, HueSaturation, N8AO, Noise, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { useStore } from './store'

/** High quality: ambient occlusion so carvings read, bloom on the sun and markers, filmic tone mapping.
 *  Low quality: no composer at all; the renderer tone-maps directly. */
export function Effects({ low }: { low: boolean }) {
  const gl = useThree((s) => s.gl)
  // with baked light, ambient occlusion is already in the lightmaps
  const baked = useStore((s) => !!s.bakedSun)
  useEffect(() => {
    gl.toneMapping = low ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping
    gl.toneMappingExposure = 1.15
  }, [gl, low])
  if (low) return null
  return (
    <EffectComposer multisampling={0}>
      {!baked ? <N8AO aoRadius={2.6} distanceFalloff={1.2} intensity={3} quality="medium" halfRes /> : <></>}
      <Bloom mipmapBlur luminanceThreshold={1} intensity={0.8} radius={0.7} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      {/* the same grade as the entry hall: a touch more contrast, old-photograph warmth */}
      <HueSaturation saturation={-0.05} />
      <BrightnessContrast contrast={0.12} />
      <Vignette offset={0.25} darkness={0.55} />
      <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.1} />
      <SMAA />
    </EffectComposer>
  )
}
