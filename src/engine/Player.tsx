import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'
import { CapsuleCollider, RigidBody, useBeforePhysicsStep, useRapier, type RapierCollider, type RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import type { SiteDefinition } from './site'
import { commands, live, store, type Flight as FlightCommand } from './store'
import { openHotspot } from './actions'
import { footstep, updateAudio } from './audio'

const HALF = 0.5
const RADIUS = 0.35
const CENTER = HALF + RADIUS // body centre above the feet
const EYE = 1.6
const WALK = 3.0
const RUN = 6.5
const GRAVITY = 20
const REACH = 6

type V3 = [number, number, number]

export const yawPitchTo = (from: THREE.Vector3, to: THREE.Vector3) => {
  const d = to.clone().sub(from)
  return { yaw: Math.atan2(-d.x, -d.z), pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)) }
}

const angleLerp = (a: number, b: number, t: number) => {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}

const ease = (t: number) => 0.5 - Math.cos(Math.PI * t) / 2

const UP = new THREE.Vector3(0, 1, 0)
const DEG = Math.PI / 180

interface Flight {
  curve: THREE.CatmullRomCurve3
  q0: THREE.Quaternion
  q1: THREE.Quaternion
  t: number
  dur: number
  done: () => void
}

interface Glide {
  curve: THREE.CatmullRomCurve3
  t: number
  dur: number
  endYaw: number
  endPitch: number
  startYaw: number
  startPitch: number
  index: number
}

export function Player({ site }: { site: SiteDefinition }) {
  const body = useRef<RapierRigidBody>(null)
  const collider = useRef<RapierCollider>(null)
  const { world, rapier } = useRapier()
  if (new URLSearchParams(location.search).has('shot')) Object.assign(window, { __world: world, __rapier: rapier })
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const [, getKeys] = useKeyboardControls()
  const { content } = site

  const start = useMemo(() => {
    // ?stop=N (1-based) or ?end starts at that view: handy for reviewing a stop
    const q = new URLSearchParams(location.search)
    const n = Number(q.get('stop'))
    // with ?stop=1&view=x,z,lookX,lookY,lookZ (any spot, for reviewing scenery)
    const at = q.get('view')?.split(',').map(Number)
    const v =
      at?.length === 5 && at.every(Number.isFinite)
        ? { position: [at[0], 0, at[1]] as [number, number, number], lookAt: [at[2], at[3], at[4]] as [number, number, number] }
        : q.has('end') ? content.end.view : n >= 1 && n <= content.hotspots.length ? content.hotspots[n - 1].view : content.start
    const p = new THREE.Vector3(...v.position)
    const look = yawPitchTo(p.clone().setY(p.y + EYE), new THREE.Vector3(...v.lookAt))
    return { p, ...look }
  }, [content])
  // remounted mid-walk (e.g. quality change): resume where the visitor was
  const resume = useMemo(
    () => (store.get().phase === 'walk' ? { p: new THREE.Vector3(live.x, live.y, live.z), yaw: live.yaw, pitch: live.pitch } : start),
    [start],
  )

  // created in an effect (not a memo) so StrictMode's mount/unmount/mount gets a live controller
  const ctrl = useRef<ReturnType<typeof world.createCharacterController> | null>(null)
  useEffect(() => {
    const c = world.createCharacterController(0.02)
    c.enableAutostep(0.3, 0.15, false)
    c.enableSnapToGround(0.5)
    c.setMaxSlopeClimbAngle((50 * Math.PI) / 180)
    c.setMinSlopeSlideAngle((60 * Math.PI) / 180)
    c.setSlideEnabled(true)
    ctrl.current = c
    return () => {
      ctrl.current = null
      world.removeCharacterController(c)
    }
  }, [world])

  const view = useRef({ yaw: resume.yaw, pitch: resume.pitch, vy: 0, stride: 0, bob: 0 })
  const glide = useRef<Glide | null>(null)
  const flight = useRef<Flight | null>(null)
  const placed = useRef(false)

  // --- aerial map camera: orbits the overview target; drag to turn, wheel to zoom
  const aerial = useRef({ bearing: content.overview.bearing, elevation: content.overview.elevation, distance: content.overview.distance })
  const ovTarget = useMemo(() => new THREE.Vector3(...content.overview.target), [content])
  const aerialPose = () => {
    const a = aerial.current
    const b = a.bearing * DEG
    const e = a.elevation * DEG
    const pos = new THREE.Vector3(Math.sin(b) * Math.cos(e), Math.sin(e), -Math.cos(b) * Math.cos(e)).multiplyScalar(a.distance).add(ovTarget)
    const quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(pos, ovTarget, UP))
    return { pos, quat }
  }
  useEffect(() => {
    const el = gl.domElement
    let drag: { x: number; y: number; id: number } | null = null
    const active = () => store.get().overview && !store.get().flying
    const down = (e: PointerEvent) => {
      if (!active()) return
      drag = { x: e.clientX, y: e.clientY, id: e.pointerId }
    }
    const move = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id || !active()) return
      const a = aerial.current
      a.bearing -= (e.clientX - drag.x) * 0.25
      a.elevation = THREE.MathUtils.clamp(a.elevation + (e.clientY - drag.y) * 0.15, 18, 85)
      drag.x = e.clientX
      drag.y = e.clientY
    }
    const up = () => (drag = null)
    const wheel = (e: WheelEvent) => {
      if (!active()) return
      e.preventDefault()
      commands.zoom += e.deltaY
    }
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    el.addEventListener('wheel', wheel, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      el.removeEventListener('wheel', wheel)
    }
  }, [gl])

  const eyePose = (feet: THREE.Vector3, yaw: number, pitch: number) => ({
    pos: feet.clone().add(new THREE.Vector3(0, EYE, 0)),
    quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ')),
  })

  const startFlight = (to: { pos: THREE.Vector3; quat: THREE.Quaternion }, mids: THREE.Vector3[], dur: number, done: () => void) => {
    const pts = [camera.position.clone(), ...mids, to.pos].filter((p, i, a) => i === 0 || p.distanceTo(a[i - 1]) > 0.5)
    if (pts.length < 2) pts.push(to.pos.clone().add(new THREE.Vector3(0, 0.01, 0)))
    flight.current = { curve: new THREE.CatmullRomCurve3(pts, false, 'centripetal'), q0: camera.quaternion.clone(), q1: to.quat, t: 0, dur, done }
    store.set({ flying: true })
  }

  /** Descend from the sky to a standing spot, arriving level and facing the subject. */
  const descend = (feet: THREE.Vector3, yaw: number, pitch: number, done: () => void) => {
    const to = eyePose(feet, yaw, pitch)
    const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw))
    const approach = to.pos.clone().addScaledVector(fwd, -22).add(new THREE.Vector3(0, 14, 0))
    const high = camera.position.clone().lerp(approach, 0.5)
    high.y = Math.max(approach.y + 25, camera.position.y * 0.7)
    startFlight(to, [high, approach], 4.5, done)
  }

  const placeBody = (b: RapierRigidBody, feet: THREE.Vector3, yaw: number, pitch: number) => {
    b.setTranslation({ x: feet.x, y: feet.y + CENTER + 0.02, z: feet.z }, true)
    pos.current = { x: feet.x, y: feet.y + CENTER + 0.02, z: feet.z, speed: 0 }
    view.current.yaw = yaw
    view.current.pitch = pitch
    view.current.vy = 0
  }

  const beginFlight = (cmd: FlightCommand, b: RapierRigidBody) => {
    if (cmd.to === 'map') {
      glide.current = null
      store.set({ gliding: false })
      const to = aerialPose()
      const mid = camera.position.clone().lerp(to.pos, 0.35)
      mid.y = camera.position.y + (to.pos.y - camera.position.y) * 0.6
      startFlight(to, [mid], 3.2, () => {})
      return
    }
    if (cmd.to === 'player') {
      const v = view.current
      const feet = new THREE.Vector3(pos.current.x, pos.current.y - CENTER, pos.current.z)
      descend(feet, v.yaw, Math.max(-0.2, Math.min(0.2, v.pitch)), () => store.set({ overview: false }))
      return
    }
    const target = cmd.to === 'start' ? content.start : content.hotspots[cmd.index].view
    const feet = new THREE.Vector3(...target.position)
    const look = yawPitchTo(feet.clone().setY(feet.y + EYE), new THREE.Vector3(...target.lookAt))
    descend(feet, look.yaw, look.pitch, () => {
      placeBody(b, feet, look.yaw, look.pitch)
      store.set({ overview: false })
      if (cmd.to === 'stop') openHotspot(content.hotspots[cmd.index].id)
    })
  }

  // mouse look under pointer lock
  useEffect(() => {
    const el = gl.domElement
    const onClick = () => {
      const s = store.get()
      if (s.phase === 'walk' && !s.overview && !s.flying && !s.showEnd && !s.touch && !document.pointerLockElement) {
        // refused in some embeds and right after Esc; the click simply does nothing then
        Promise.resolve(el.requestPointerLock?.()).catch(() => {})
      }
    }
    const onLock = () => store.set({ locked: document.pointerLockElement === el })
    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== el) return
      view.current.yaw -= e.movementX * 0.0022
      view.current.pitch = THREE.MathUtils.clamp(view.current.pitch - e.movementY * 0.0022, -1.4, 1.4)
    }
    el.addEventListener('click', onClick)
    document.addEventListener('pointerlockchange', onLock)
    document.addEventListener('mousemove', onMove)
    return () => {
      el.removeEventListener('click', onClick)
      document.removeEventListener('pointerlockchange', onLock)
      document.removeEventListener('mousemove', onMove)
    }
  }, [gl])

  const beginGlide = (index: number, b: RapierRigidBody) => {
    const t = b.translation()
    const feet = new THREE.Vector3(t.x, t.y - CENTER, t.z)
    const target = index < 0 ? content.end.view : content.hotspots[index].view
    const end = new THREE.Vector3(...target.position)
    const prev = index > 0 ? new THREE.Vector3(...content.hotspots[index - 1].view.position) : null
    let pts: THREE.Vector3[]
    if (index >= 0 && prev && feet.distanceTo(prev) < 6) {
      pts = [feet, ...content.hotspots[index].via.map((v: V3) => new THREE.Vector3(...v)), end]
    } else if (feet.distanceTo(end) < 12) {
      pts = [feet, end]
    } else {
      // off-route: rise over the walls and come down at the stop
      const d = feet.distanceTo(end)
      const lift = Math.max(18, d * 0.35)
      pts = [feet, feet.clone().lerp(end, 0.25).setY(Math.max(feet.y, end.y) + lift), feet.clone().lerp(end, 0.75).setY(Math.max(feet.y, end.y) + lift * 0.8), end]
    }
    // drop duplicate points so the spline stays well formed
    pts = pts.filter((p, i) => i === 0 || p.distanceTo(pts[i - 1]) > 0.2)
    if (pts.length < 2) pts.push(end.clone().add(new THREE.Vector3(0.01, 0, 0)))
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal')
    const look = yawPitchTo(end.clone().setY(end.y + EYE), new THREE.Vector3(...target.lookAt))
    glide.current = {
      curve,
      t: 0,
      dur: Math.max(1.6, Math.min(14, curve.getLength() / 4)),
      endYaw: look.yaw,
      endPitch: look.pitch,
      startYaw: view.current.yaw,
      startPitch: view.current.pitch,
      index,
    }
    store.set({ gliding: true })
  }

  const tmp = useMemo(() => new THREE.Vector3(), [])
  const tan = useMemo(() => new THREE.Vector3(), [])

  // Walking runs once per physics step, against up-to-date collider positions.
  const pos = useRef({ x: resume.p.x, y: resume.p.y + CENTER, z: resume.p.z, speed: 0 })
  useBeforePhysicsStep((w) => {
    const b = body.current
    const col = collider.current
    const controller = ctrl.current
    const s = store.get()
    if (!b || !col || !controller || glide.current || flight.current) return
    const t = b.translation()
    const v = view.current
    const dt = w.timestep
    pos.current.speed = 0
    if (s.phase !== 'walk' || s.overview || s.showEnd) {
      pos.current.x = t.x
      pos.current.y = t.y
      pos.current.z = t.z
      return
    }
    const keys = getKeys() as Record<string, boolean>
    let mx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0) + commands.moveX
    let mz = (keys.forward ? 1 : 0) - (keys.backward ? 1 : 0) + commands.moveY
    const len = Math.hypot(mx, mz)
    if (len > 1) {
      mx /= len
      mz /= len
    }
    const run = keys.run || Math.hypot(commands.moveX, commands.moveY) > 0.95
    const sp = run ? RUN : WALK
    const fx = -Math.sin(v.yaw)
    const fz = -Math.cos(v.yaw)
    const rx = Math.cos(v.yaw)
    const rz = -Math.sin(v.yaw)
    v.vy = Math.max(-30, v.vy - GRAVITY * dt)
    controller.computeColliderMovement(col, {
      x: (fx * mz + rx * mx) * sp * dt,
      y: v.vy * dt,
      z: (fz * mz + rz * mx) * sp * dt,
    })
    const m = controller.computedMovement()
    if (controller.computedGrounded()) v.vy = -1
    let nx = t.x + m.x
    let ny = t.y + m.y
    let nz = t.z + m.z
    if (ny < -20) {
      nx = start.p.x
      ny = start.p.y + CENTER + 0.2
      nz = start.p.z
      v.vy = 0
    }
    b.setNextKinematicTranslation({ x: nx, y: ny, z: nz })
    const moved = Math.hypot(m.x, m.z)
    pos.current = { x: nx, y: ny, z: nz, speed: moved / dt }
    v.stride += moved
    if (v.stride > (run ? 1.1 : 0.8)) {
      v.stride = 0
      footstep(ny - CENTER > 0.6, run)
    }
  })

  useFrame((state, rawDt) => {
    const b = body.current
    const col = collider.current
    if (!b || !col) return
    const dt = Math.min(rawDt, 0.05)
    const s = store.get()
    const v = view.current

    if (commands.glideTo) {
      beginGlide(commands.glideTo.index, b)
      commands.glideTo = null
    }

    if (commands.fly) {
      // the canvas may have been paused until now: start every flight from the sky view
      if (s.overview && !placed.current) {
        const p = aerialPose()
        camera.position.copy(p.pos)
        camera.quaternion.copy(p.quat)
      }
      placed.current = true
      beginFlight(commands.fly, b)
      commands.fly = null
    }
    const f = flight.current
    const pc = camera as THREE.PerspectiveCamera
    if (!s.overview && pc.view?.enabled) pc.clearViewOffset()
    if (f) {
      f.t = Math.min(1, f.t + Math.min(rawDt, 0.1) / f.dur)
      f.curve.getPointAt(ease(f.t), camera.position)
      // keep the sky view's angle for the first part, then turn to the arrival view
      camera.quaternion.slerpQuaternions(f.q0, f.q1, THREE.MathUtils.smoothstep(f.t, 0.2, 0.95))
      if (f.t >= 1) {
        flight.current = null
        store.set({ flying: false })
        f.done()
      }
      updateAudio(state.clock.elapsedTime)
      return
    }
    if (s.overview) {
      const a = aerial.current
      if (s.phase !== 'walk' && !s.hoverStop) a.bearing += dt * 1.2 // slow orbit behind the intro
      if (commands.zoom) {
        a.distance = THREE.MathUtils.clamp(a.distance * Math.exp(commands.zoom * 0.001), 60, 380)
        commands.zoom = 0
      }
      const p = aerialPose()
      camera.position.copy(p.pos)
      camera.quaternion.copy(p.quat)
      placed.current = true
      // keep the temple clear of the side panel: shift the picture right on wide screens
      const cam = camera as THREE.PerspectiveCamera
      const w = state.size.width
      const shift = s.phase !== 'walk' && w > 900 ? -Math.min(240, w * 0.18) : s.phase === 'walk' && w > 900 ? -90 : 0
      if ((cam.view?.offsetX ?? 0) !== shift) {
        if (shift) cam.setViewOffset(w, state.size.height, shift, 0, w, state.size.height)
        else cam.clearViewOffset()
      }
      updateAudio(state.clock.elapsedTime)
      return
    }

    // touch look
    v.yaw -= commands.lookDX * 0.005
    v.pitch = THREE.MathUtils.clamp(v.pitch - commands.lookDY * 0.005, -1.4, 1.4)
    commands.lookDX = commands.lookDY = 0

    let nx = pos.current.x
    let ny = pos.current.y
    let nz = pos.current.z
    let speed = 0

    const g = glide.current
    if (g) {
      g.t = Math.min(1, g.t + Math.min(rawDt, 0.1) / g.dur)
      const k = ease(g.t)
      g.curve.getPointAt(k, tmp)
      g.curve.getTangentAt(Math.min(0.999, k), tan)
      const travelYaw = Math.atan2(-tan.x, -tan.z)
      const w = THREE.MathUtils.smoothstep(g.t, 0.55, 1)
      const early = THREE.MathUtils.smoothstep(g.t, 0, 0.15)
      v.yaw = angleLerp(angleLerp(g.startYaw, travelYaw, early), g.endYaw, w)
      v.pitch = THREE.MathUtils.lerp(THREE.MathUtils.lerp(g.startPitch, Math.max(-0.3, Math.min(0.2, tan.y)), early), g.endPitch, w)
      nx = tmp.x
      ny = tmp.y + CENTER
      nz = tmp.z
      b.setTranslation({ x: nx, y: ny, z: nz }, true)
      pos.current = { x: nx, y: ny, z: nz, speed: 0 }
      v.vy = 0
      speed = 1
      if (g.t >= 1) {
        glide.current = null
        store.set({ gliding: false })
        if (g.index >= 0) openHotspot(content.hotspots[g.index].id)
      }
    } else {
      nx = pos.current.x
      ny = pos.current.y
      nz = pos.current.z
      speed = pos.current.speed
    }

    // head bob while walking
    v.bob += dt * speed * 2.2
    const bob = g ? 0 : Math.sin(v.bob) * 0.04 * Math.min(1, speed / WALK)
    camera.position.set(nx, ny - CENTER + EYE + bob, nz)
    camera.rotation.set(v.pitch, v.yaw, 0, 'YXZ')

    live.x = nx
    live.y = ny - CENTER
    live.z = nz
    live.yaw = v.yaw
    live.pitch = v.pitch
    live.moving = speed

    // nearest hotspot within reach
    let near: string | null = null
    let best = REACH
    for (const h of content.hotspots) {
      const d = Math.hypot(h.position[0] - nx, h.position[1] - (ny - CENTER + EYE * 0.8), h.position[2] - nz)
      if (d < best) {
        best = d
        near = h.id
      }
    }
    if (near !== s.nearId) store.set({ nearId: near })
    updateAudio(state.clock.elapsedTime)
  })

  return (
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[resume.p.x, resume.p.y + CENTER + 0.05, resume.p.z]} enabledRotations={[false, false, false]}>
      <CapsuleCollider ref={collider} args={[HALF, RADIUS]} />
    </RigidBody>
  )
}
