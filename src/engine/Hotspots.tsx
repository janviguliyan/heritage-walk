import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import * as THREE from 'three'
import type { Hotspot } from './content'
import { chakraTexture } from './textures'
import { live, store, useStore } from './store'
import { openHotspot } from './actions'

const GOLD = new THREE.Color('#ffc861')

/** Glowing, slowly turning chakra markers. Brighter as you approach; dimmer once visited. */
export function Hotspots({ list }: { list: Hotspot[] }) {
  const tex = useMemo(() => chakraTexture(), [])
  const meshes = useRef<(THREE.Mesh | null)[]>([])
  const camera = useThree((s) => s.camera)
  const visited = useStore((s) => s.visited)

  // under pointer lock, a click opens whichever marker sits under the crosshair
  useEffect(() => {
    const ray = new THREE.Raycaster()
    ray.far = 30
    const onDown = () => {
      if (!document.pointerLockElement) return
      const s = store.get()
      ray.setFromCamera(new THREE.Vector2(0, 0), camera)
      const hit = ray.intersectObjects(meshes.current.filter(Boolean) as THREE.Mesh[], false)[0]
      const id = (hit?.object.userData.id as string | undefined) ?? s.nearId
      if (id && id !== s.activeId && !s.overview) openHotspot(id)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [camera])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    meshes.current.forEach((m, i) => {
      if (!m) return
      const h = list[i]
      const d = Math.hypot(h.position[0] - live.x, h.position[2] - live.z)
      const near = THREE.MathUtils.clamp(1 - (d - 3) / 40, 0.25, 1)
      const seen = visited.includes(h.id)
      const mat = m.material as THREE.MeshBasicMaterial
      const pulse = 0.85 + Math.sin(t * 2.4 + i) * 0.15
      mat.color.copy(GOLD).multiplyScalar((seen ? 1.1 : 2.6) * near * pulse)
      m.rotation.z = -t * 0.5
      const s = 0.8 + near * 0.35
      m.scale.setScalar(s)
      m.parent!.position.y = Math.sin(t * 1.3 + i) * 0.08
    })
  })

  return (
    <>
      {list.map((h, i) => (
        <group key={h.id} position={h.position}>
          <Billboard>
            <mesh
              ref={(m) => {
                meshes.current[i] = m
              }}
              userData={{ id: h.id }}
              onClick={(e) => {
                e.stopPropagation()
                const s = store.get()
                if (!document.pointerLockElement && !s.overview && !s.flying && s.activeId !== h.id) openHotspot(h.id)
              }}
              onPointerOver={() => (document.body.style.cursor = 'pointer')}
              onPointerOut={() => (document.body.style.cursor = '')}
            >
              <planeGeometry args={[1.1, 1.1]} />
              <meshBasicMaterial map={tex} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} fog={false} />
            </mesh>
          </Billboard>
          {/* faint beam so stops can be spotted from afar */}
          <mesh position={[0, -h.position[1] / 2 + 0.2, 0]}>
            <cylinderGeometry args={[0.015, 0.04, Math.max(0.5, h.position[1] - 0.2), 6, 1, true]} />
            <meshBasicMaterial color="#ffb347" transparent opacity={0.22} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </>
  )
}
