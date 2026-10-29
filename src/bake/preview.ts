import * as THREE from 'three'
import { figureStatue, gajaSimhaStatue, horseStatue, lionStatue, POSES, reliefFigure, suryaStatue, warElephantStatue, warHorseStatue } from '../kit/statues'

// Dev-only: /?sculpt shows every statue in a row, lit simply, for review.
export function runPreview() {
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
  r.setSize(innerWidth, innerHeight)
  document.body.style.margin = '0'
  r.domElement.style.cssText = 'position:fixed;inset:0;z-index:9'
  document.body.appendChild(r.domElement)
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#cfd8de')
  scene.add(new THREE.HemisphereLight('#e9eef2', '#6b5a48', 1.4))
  const sun = new THREE.DirectionalLight('#ffe2b8', 2.6)
  sun.position.set(5, 6, 8)
  scene.add(sun)
  const mat = new THREE.MeshStandardMaterial({ color: '#b39a7c', roughness: 0.85 })
  const times: string[] = []
  const add = (name: string, make: () => THREE.BufferGeometry, x: number, y = 0, s = 1) => {
    const t0 = performance.now()
    const g = make()
    times.push(`${name}: ${(performance.now() - t0).toFixed(0)} ms, ${(g.attributes.position.count / 3) | 0} tris`)
    const m = new THREE.Mesh(g, mat)
    m.position.set(x, y, 0)
    m.rotation.y = -0.5
    m.scale.setScalar(s)
    scene.add(m)
  }
  const which = new URLSearchParams(location.search).get('sculpt') || 'animals'
  const cam = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 200)
  if (which === 'animals') {
    add('horse', () => horseStatue('whole'), -9)
    add('warhorse', () => warHorseStatue(), -4.5)
    add('elephant', () => warElephantStatue(), 1.5)
    add('lion', () => lionStatue(), 6.5)
    add('gajasimha', () => gajaSimhaStatue(), 10)
    cam.position.set(1, 4, 20)
    cam.lookAt(1, 1.8, 0)
  } else if (which === 'count') {
    add('horse whole', () => horseStatue('whole'), -9)
    add('horse broken', () => horseStatue('broken'), -6)
    add('horse nohead', () => horseStatue('nohead'), -3)
    add('warhorse', () => warHorseStatue(), 0)
    add('elephant', () => warElephantStatue(), 4)
    add('gajasimha', () => gajaSimhaStatue(), 8)
    add('lion', () => lionStatue(), 11)
    add('surya', () => suryaStatue(), 13)
    add('figure', () => figureStatue('drum'), 14)
    add('relief', () => reliefFigure('drum', 2.45), 15)
    cam.position.set(1, 4, 25)
    cam.lookAt(1, 1.8, 0)
  } else if (which === 'closeup') {
    add('horse', () => horseStatue('whole'), 0)
    add('fig', () => figureStatue('mirror'), 2.6, 0.9)
    add('surya', () => suryaStatue(), 5.2, -0.6)
    cam.position.set(3.2, 2.6, 4.2)
    cam.lookAt(2.6, 2.3, 0)
  } else {
    POSES.forEach((p, i) => add(p, () => figureStatue(p), -4 + i * 1.6))
    POSES.forEach((p, i) => add('relief ' + p, () => reliefFigure(p, 1.1), -4 + i * 1.6, 2.1))
    cam.position.set(0, 2, 8)
    cam.lookAt(0, 1.7, 0)
  }
  r.render(scene, cam)
  console.log('[sculpt] ' + times.join(' | '))
}
