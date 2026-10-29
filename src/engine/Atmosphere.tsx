import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment, Sky } from '@react-three/drei'
import * as THREE from 'three'
import { live, store } from './store'

const deg = Math.PI / 180

// Dawn → morning palettes, indexed by progress 0..1
const FOG = [new THREE.Color('#c9a99a'), new THREE.Color('#dcc6b2'), new THREE.Color('#d9d2c4')]
const SUN = [new THREE.Color('#ff8a3d'), new THREE.Color('#ffc07a'), new THREE.Color('#fff0d8')]
const SKYLIGHT = [new THREE.Color('#c8bfd6'), new THREE.Color('#e6d6c6'), new THREE.Color('#d2e2ee')]

function ramp(stops: THREE.Color[], t: number, out: THREE.Color) {
  const x = THREE.MathUtils.clamp(t, 0, 1) * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(x))
  return out.copy(stops[i]).lerp(stops[i + 1], x - i)
}

export function sunDirection(azimuthDeg: number, elevationDeg: number, out = new THREE.Vector3()) {
  const az = azimuthDeg * deg
  const el = elevationDeg * deg
  // north = -Z, east = +X
  return out.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el))
}

function glowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grd.addColorStop(0, 'rgba(255,240,210,1)')
  grd.addColorStop(0.12, 'rgba(255,214,150,0.9)')
  grd.addColorStop(0.4, 'rgba(255,170,90,0.25)')
  grd.addColorStop(1, 'rgba(255,150,80,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const SKY_VS = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * p;
    gl_Position.z = gl_Position.w; // always at the far plane
  }`

// A painted morning sky: deep blue overhead, warm haze at the horizon (the fog's own colour, so
// land and sky meet without a seam), a glow around the sun, and a few slow, soft clouds.
const SKY_FS = /* glsl */ `
  uniform vec3 uSun;
  uniform vec3 uZenith;
  uniform vec3 uMid;
  uniform vec3 uHorizon;
  uniform vec3 uSunCol;
  uniform float uTime;
  varying vec3 vDir;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + 7.1; a *= 0.5; }
    return s;
  }
  void main() {
    vec3 d = normalize(vDir);
    float h = max(d.y, 0.0);
    vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.18, h));
    col = mix(col, uZenith, smoothstep(0.12, 0.75, h));
    // below the horizon: the haze continues (the land covers most of it)
    col = mix(col, uHorizon, smoothstep(0.0, -0.08, d.y));
    float sd = max(dot(d, uSun), 0.0);
    col += uSunCol * (pow(sd, 8.0) * 0.35 + pow(sd, 64.0) * 0.6) * (1.0 - h * 0.6);
    // clouds on a plane above: soft cumulus drifting with the sea breeze, thinning to the horizon
    if (d.y > 0.02) {
      vec2 uv = d.xz / (d.y + 0.08) * 1.1 + vec2(uTime * 0.004, uTime * 0.0015);
      // a broad shape broken by finer billows: firm edges, as fair-weather cumulus
      float base = fbm(uv * 1.2);
      float detail = fbm(uv * 5.0 + 3.7);
      float c = smoothstep(0.56, 0.66, base + (detail - 0.5) * 0.18) * smoothstep(0.02, 0.2, d.y);
      // lit tops, greyer undersides (where the billows are thin)
      float body = smoothstep(0.56, 0.8, base + detail * 0.12);
      float lit = 0.72 + 0.3 * pow(sd, 3.0) + 0.18 * body;
      vec3 cloud = mix(uHorizon * 0.92, vec3(1.0, 0.98, 0.94), 0.35 + 0.55 * body) * lit;
      col = mix(col, cloud, c * 0.9);
    }
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`

function makeSkyDome() {
  const mat = new THREE.ShaderMaterial({
    vertexShader: SKY_VS,
    fragmentShader: SKY_FS,
    uniforms: {
      uSun: { value: new THREE.Vector3(1, 0.3, 0) },
      uZenith: { value: new THREE.Color('#3f6fa8') },
      uMid: { value: new THREE.Color('#86aacb') },
      uHorizon: { value: new THREE.Color('#e3cfb6') },
      uSunCol: { value: new THREE.Color('#ffd9a0') },
      uTime: { value: 0 },
    },
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  })
  const m = new THREE.Mesh(new THREE.SphereGeometry(4000, 48, 24), mat)
  m.frustumCulled = false
  m.renderOrder = -1
  return m
}

// the sky dome's colours from dawn to morning; its horizon is the fog colour
const ZENITH = [new THREE.Color('#2c3f6e'), new THREE.Color('#3a6299'), new THREE.Color('#3f6fa8')]
const MID = [new THREE.Color('#9a8fae'), new THREE.Color('#9db4cc'), new THREE.Color('#86aacb')]

/** Sunrise that brightens over the walk: sky, sun light, fog, sun glow, birds and drifting sand. */
export function Atmosphere({ azimuth, stops, low }: { azimuth: number; stops: number; low: boolean }) {
  const dome = useMemo(makeSkyDome, [])
  const sun = useRef<THREE.DirectionalLight>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const glow = useRef<THREE.Sprite>(null)
  const scene = useThree((s) => s.scene)
  const progress = useRef(0)
  const walkTime = useRef(0)
  const glowTex = useMemo(glowTexture, [])
  const fog = useMemo(() => new THREE.FogExp2('#d9a27a', 0.009), [])
  scene.fog = fog
  const dir = useMemo(() => new THREE.Vector3(), [])
  const col = useMemo(() => new THREE.Color(), [])

  useFrame((state, dt) => {
    const s = store.get()
    if (s.phase === 'walk') walkTime.current += dt
    // the sun climbs with time spent and with stops visited; the end screen shows full morning
    const target = s.showEnd ? 1 : Math.max(walkTime.current / 900, (s.visited.length / stops) * 0.9)
    progress.current += (Math.min(1, target) - progress.current) * Math.min(1, dt * 0.4)
    // with baked light the sun stays where it was baked, so shadows and light agree
    if (s.bakedSun) progress.current = (s.bakedSun.elevation - 1.5) / 30.5
    const p = progress.current
    const elevation = THREE.MathUtils.lerp(1.5, 32, p)
    live.sunElevation = elevation
    live.sunAzimuth = azimuth
    sunDirection(azimuth, elevation, dir)

    const cam = state.camera.position
    {
      const u = (dome.material as THREE.ShaderMaterial).uniforms
      u.uSun.value.copy(dir)
      u.uTime.value = state.clock.elapsedTime
      ramp(ZENITH, p, u.uZenith.value)
      ramp(MID, p, u.uMid.value)
      ramp(SUN, p, u.uSunCol.value)
      dome.position.copy(cam)
    }
    if (sun.current) {
      sun.current.castShadow = !low && !s.bakedSun
      // shadows follow the walker, or cover the whole complex from the sky
      const aerial = state.camera.position.y > 40
      const cx = aerial ? 5 : live.x
      const cy = aerial ? 0 : live.y
      const cz = aerial ? 0 : live.z
      const cam = sun.current.shadow.camera
      const extent = aerial ? 130 : 70
      if (cam.right !== extent) {
        cam.left = cam.bottom = -extent
        cam.right = cam.top = extent
        cam.updateProjectionMatrix()
      }
      sun.current.position.set(cx + dir.x * 220, cy + dir.y * 220, cz + dir.z * 220)
      sun.current.target.position.set(cx, cy, cz)
      sun.current.target.updateMatrixWorld()
      sun.current.intensity = THREE.MathUtils.lerp(2.2, 3.4, p) * (0.35 + 0.65 * THREE.MathUtils.smoothstep(elevation, 0, 6))
      ramp(SUN, p, sun.current.color)
    }
    if (hemi.current) {
      ramp(SKYLIGHT, p, hemi.current.color)
      hemi.current.intensity = THREE.MathUtils.lerp(1.1, 1.4, p)
    }
    ramp(FOG, p, col)
    fog.color.copy(col)
    ;(dome.material as THREE.ShaderMaterial).uniforms.uHorizon.value.copy(col)
    // thin the haze when the camera is up in the sky (the map), so the whole complex reads
    const high = THREE.MathUtils.smoothstep(state.camera.position.y, 12, 120)
    // a morning haze, clear enough to see the tree lines and villages a kilometre or two off
    fog.density = THREE.MathUtils.lerp(0.0055, 0.0019, p) * (1 - 0.8 * high) * (s.bakedSun ? 0.6 : 1)
    if (glow.current) {
      glow.current.position.set(cam.x + dir.x * 900, cam.y + dir.y * 900, cam.z + dir.z * 900)
      const m = glow.current.material as THREE.SpriteMaterial
      m.opacity = THREE.MathUtils.lerp(1, 0.75, p) * (s.bakedSun ? 0.45 : 1)
    }
  })

  return (
    <>
      <primitive object={dome} />
      {/* image-based ambient light rendered once from a dawn sky: soft fill so stone and chlorite read */}
      <Environment frames={1} resolution={64} near={1} far={10000} environmentIntensity={0.55}>
        <Sky distance={4500} sunPosition={sunDirection(azimuth, 8)} mieCoefficient={0.006} mieDirectionalG={0.86} rayleigh={1.6} />
      </Environment>
      <hemisphereLight ref={hemi} args={['#c8bfd6', '#a08466', 1.1]} />
      <directionalLight
        ref={sun}
        castShadow={!low}
        shadow-mapSize={[4096, 4096]}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
        shadow-camera-near={10}
        shadow-camera-far={500}
        shadow-bias={-0.0008}
        shadow-normalBias={0.12}
      />
      <sprite ref={glow} scale={[260, 260, 1]}>
        <spriteMaterial map={glowTex} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} fog={false} />
      </sprite>
      <Birds />
      <Sand count={low ? 140 : 380} />
    </>
  )
}

function Birds() {
  const group = useRef<THREE.Group>(null)
  const birds = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        r: 60 + ((i * 37) % 90),
        h: 28 + ((i * 13) % 22),
        speed: 0.05 + ((i * 7) % 5) * 0.012,
        phase: i * 0.7,
        cx: -20 + ((i * 29) % 60),
        cz: -30 + ((i * 17) % 60),
      })),
    [],
  )
  const wing = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.15, 0, 0, 0.25, 1.1, 0, 0], 3))
    g.computeVertexNormals()
    return g
  }, [])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    group.current?.children.forEach((b, i) => {
      const d = birds[i]
      const a = t * d.speed + d.phase
      b.position.set(d.cx + Math.cos(a) * d.r, d.h + Math.sin(t * 0.3 + i) * 2, d.cz + Math.sin(a) * d.r)
      b.rotation.y = -a
      const flap = Math.sin(t * 9 + i * 2) * 0.6
      b.children[0].rotation.z = flap
      b.children[1].rotation.z = -flap
    })
  })
  return (
    <group ref={group}>
      {birds.map((_, i) => (
        <group key={i}>
          <mesh geometry={wing}>
            <meshBasicMaterial color="#2b2420" side={THREE.DoubleSide} />
          </mesh>
          <mesh geometry={wing} scale={[-1, 1, 1]}>
            <meshBasicMaterial color="#2b2420" side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Sand({ count }: { count: number }) {
  const ref = useRef<THREE.Points>(null)
  const { geo, vel } = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const vel = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 50
      pos[i * 3 + 1] = Math.random() * 3
      pos[i * 3 + 2] = (Math.random() - 0.5) * 50
      vel[i] = 0.6 + Math.random() * 1.6
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return { geo, vel }
  }, [count])
  useFrame((state, dt) => {
    const p = geo.attributes.position as THREE.BufferAttribute
    const a = p.array as Float32Array
    const t = state.clock.elapsedTime
    for (let i = 0; i < count; i++) {
      // sea breeze from the east blows the sand west
      a[i * 3] -= vel[i] * dt
      a[i * 3 + 1] += Math.sin(t * 2 + i) * dt * 0.15
      a[i * 3 + 2] += Math.sin(t * 0.7 + i * 0.3) * dt * 0.3
      const dx = a[i * 3] - live.x
      const dz = a[i * 3 + 2] - live.z
      if (dx < -25) a[i * 3] = live.x + 25
      if (dx > 25) a[i * 3] = live.x - 25
      if (dz < -25) a[i * 3 + 2] = live.z + 25
      if (dz > 25) a[i * 3 + 2] = live.z - 25
      if (a[i * 3 + 1] < 0 || a[i * 3 + 1] > 3.5) a[i * 3 + 1] = Math.random() * 2 + live.y
    }
    p.needsUpdate = true
  })
  const dot = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 32
    const g = c.getContext('2d')!
    const r = g.createRadialGradient(16, 16, 0, 16, 16, 16)
    r.addColorStop(0, 'rgba(255,255,255,1)')
    r.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = r
    g.fillRect(0, 0, 32, 32)
    return new THREE.CanvasTexture(c)
  }, [])
  return (
    <points ref={ref} geometry={geo} frustumCulled={false}>
      <pointsMaterial color="#e9cf9f" map={dot} size={0.035} transparent opacity={0.6} depthWrite={false} />
    </points>
  )
}
