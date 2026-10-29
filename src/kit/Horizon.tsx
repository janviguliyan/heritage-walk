import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// The land beyond the site: a panorama band round the horizon, modelled and rendered in Blender
// (tools/blender/distant.py), hung on a ring that travels with the eye (it is kilometres away, so
// it never comes nearer). Each pixel carries its true distance, and the ring hazes it with the
// walk's own live fog, so it joins the 3D trees nearer in without a seam.

/** the band's elevation range (degrees) and the distance its encoding spans (m): distant.py */
const EL_LO = -4
const EL_HI = 9
const FAR = 8000
/** the ring's radius: beyond the site's own ground and trees */
const R = 1500

function ringGeometry() {
  const seg = 256
  const rows = 26
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  for (let j = 0; j <= rows; j++) {
    const el = THREE.MathUtils.degToRad(EL_LO + ((EL_HI - EL_LO) * j) / rows)
    for (let i = 0; i <= seg; i++) {
      // azimuth clockwise from north; the panorama has north at its centre, east to the right
      const az = (i / seg) * Math.PI * 2 - Math.PI
      pos.push(R * Math.sin(az), R * Math.tan(el), -R * Math.cos(az))
      uv.push(0.5 + az / (Math.PI * 2), j / rows)
    }
  }
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < seg; i++) {
      const a = j * (seg + 1) + i
      idx.push(a, a + seg + 1, a + 1, a + 1, a + seg + 1, a + seg + 2)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}

export function Horizon({ base, low }: { base: string; low: boolean }) {
  const scene = useThree((s) => s.scene)
  const { mesh, mat } = useMemo(() => {
    const loader = new THREE.TextureLoader()
    const color = loader.load(base + 'color.webp')
    color.colorSpace = THREE.SRGBColorSpace
    color.anisotropy = 8
    const dist = loader.load(base + 'dist.webp')
    dist.colorSpace = THREE.NoColorSpace
    for (const t of [color, dist]) {
      t.wrapS = THREE.RepeatWrapping
      t.generateMipmaps = !low
    }
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: color },
        uDist: { value: dist },
        uFog: { value: new THREE.Color() },
        uDensity: { value: 0.003 },
        uExposure: { value: 1.0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uColor;
        uniform sampler2D uDist;
        uniform vec3 uFog;
        uniform float uDensity;
        uniform float uExposure;
        varying vec2 vUv;
        void main() {
          vec4 c = texture2D(uColor, vUv);
          if (c.a < 0.02) discard;
          float s = texture2D(uDist, vUv).r;
          float d = s * s * ${FAR.toFixed(1)};
          // the same haze as the walk's FogExp2, at this pixel's true distance
          float f = 1.0 - exp(-pow(uDensity * d, 2.0));
          vec3 col = mix(c.rgb * uExposure, uFog, f);
          gl_FragColor = vec4(col, c.a);
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      fog: false,
    })
    const mesh = new THREE.Mesh(ringGeometry(), mat)
    mesh.frustumCulled = false
    // after the sky dome, before the site's own transparent things
    mesh.renderOrder = -1
    return { mesh, mat }
  }, [base, low])
  useEffect(
    () => () => {
      mesh.geometry.dispose()
      mat.uniforms.uColor.value.dispose()
      mat.uniforms.uDist.value.dispose()
      mat.dispose()
    },
    [mesh, mat],
  )
  useFrame((state) => {
    mesh.position.copy(state.camera.position)
    const fog = scene.fog as THREE.FogExp2 | null
    if (fog) {
      mat.uniforms.uFog.value.copy(fog.color)
      mat.uniforms.uDensity.value = fog.density
    }
  })
  return <primitive object={mesh} />
}
