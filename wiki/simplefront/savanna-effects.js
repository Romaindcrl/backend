import * as THREE from 'three'
import { WATER } from './savanna-world.js'

/** @param {THREE.Scene} scene @param {object[]} animals @returns {{update: (time: number) => void}} */
export function createRipples(scene, animals) {
  const geometry = new THREE.RingGeometry(.88, 1, 40)
  geometry.rotateX(-Math.PI / 2)
  const ripples = animals.filter(animal => animal.species === 'crocodile').flatMap(animal => {
    return [0, 1, 2].map(index => {
      const material = new THREE.MeshBasicMaterial({ color: '#cad5b0', transparent: true, opacity: .15, depthWrite: false })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.y = WATER.y + .015
      scene.add(mesh)
      return { mesh, animal, phase: index / 3 }
    })
  })
  return {
    /** @param {number} time @returns {void} */
    update(time) {
      for (const { mesh, animal, phase } of ripples) {
        const age = (time * .28 + phase) % 1
        mesh.position.x = animal.root.position.x
        mesh.position.z = animal.root.position.z
        mesh.scale.setScalar(.35 + age * 1.2)
        mesh.material.opacity = (1 - age) * .18
      }
    },
  }
}

/** @param {THREE.Scene} scene @returns {{update: (delta: number) => void, dispose: () => void}} */
export function createSplashes(scene) {
  const count = 72
  const positions = new Float32Array(count * 3)
  const velocities = new Float32Array(count * 3)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const material = new THREE.PointsMaterial({ color: '#edf7d8', size: .11, transparent: true, opacity: 0, depthWrite: false })
  const particles = new THREE.Points(geometry, material)
  particles.frustumCulled = false
  scene.add(particles)
  const ringMaterial = new THREE.MeshBasicMaterial({ color: '#ecf2cc', transparent: true, opacity: 0, depthWrite: false })
  const ring = new THREE.Mesh(new THREE.RingGeometry(.9, 1, 48).rotateX(-Math.PI / 2), ringMaterial)
  scene.add(ring)
  let age = 10

  /** @param {CustomEvent<{x: number, z: number}>} event @returns {void} */
  function launch(event) {
    age = 0
    ring.position.set(event.detail.x, WATER.y + .025, event.detail.z)
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = .6 + Math.random() * 2
      positions.set([event.detail.x, WATER.y + .15, event.detail.z], i * 3)
      velocities.set([Math.cos(angle) * speed, 1 + Math.random() * 3, Math.sin(angle) * speed], i * 3)
    }
  }
  window.addEventListener('savanna-splash', launch)
  return {
    /** @param {number} delta @returns {void} */
    update(delta) {
      age += delta
      material.opacity = Math.max(0, 1 - age / 1.3)
      ringMaterial.opacity = Math.max(0, .65 * (1 - age / 2))
      ring.scale.setScalar(.3 + age * 1.5)
      if (age > 1.5) return
      for (let i = 0; i < count; i++) {
        velocities[i * 3 + 1] -= delta * 6
        for (let axis = 0; axis < 3; axis++) positions[i * 3 + axis] += velocities[i * 3 + axis] * delta
      }
      geometry.attributes.position.needsUpdate = true
    },
    dispose() { window.removeEventListener('savanna-splash', launch) },
  }
}
