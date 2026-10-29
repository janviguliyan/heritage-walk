import type * as THREE from 'three'

/** Shared between the 3D chamber and the DOM overlay while the stone map is up. */
export const mapState = {
  /** carving progress 0..1 */
  progress: 0,
  carvedOnce: false,
  /** Konark emblem on screen (px), for the hover hotspot */
  konark: null as null | { x: number; y: number; r: number },
  /** the Konark miniature's bounds on the platform, for framing the camera */
  model: null as null | { center: THREE.Vector3; radius: number },
  /** Konark's stops on screen (px), while its plan is on the platform */
  pins: [] as { x: number; y: number }[],
  /** the camera is held by orbit controls (Konark miniature) */
  orbit: false,
  /** leaving the map for the very start of the hall */
  home: false,
}
