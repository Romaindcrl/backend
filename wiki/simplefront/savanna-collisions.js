import { groundHeight, lakeDistance } from './savanna-world.js'

const inactive = new Set(['caught', 'away', 'dragged', 'submerged', 'pounce'])

/** @param {object} animal @returns {boolean} */
export function hasBodyCollision(animal) {
  return animal.root.visible && animal.species !== 'crocodile' && !inactive.has(animal.state)
}

/** @param {object} animal @param {object} position @returns {boolean} Accept steps before moving; never push a standing animal. */
export function canOccupy(animal, position) {
  for (const other of animal.neighbors || []) {
    if (other === animal) continue
    const reservedLanding = other.state === 'pounce' && other.landing && other.attackTarget !== animal
    if (!hasBodyCollision(other) && !reservedLanding) continue
    const otherPosition = reservedLanding ? other.landing : other.root.position
    const distance = Math.hypot(position.x - otherPosition.x, position.z - otherPosition.z)
    const minimum = animal.radius + other.radius + .12
    if (distance >= minimum) continue
    const current = Math.hypot(animal.root.position.x - otherPosition.x, animal.root.position.z - otherPosition.z)
    // A fresh spawn or landing may already overlap: allow movement outwards only.
    if (current < minimum && distance > current + .00000001) continue
    return false
  }
  return true
}

/** @param {object} animal @param {number} x @param {number} z @returns {void} Initial placement only. */
function shiftSpawn(animal, x, z) {
  const position = animal.root.position
  position.x += x
  position.z += z
  const radius = lakeDistance(position.x, position.z)
  if (radius < 1.16) { position.x *= 1.16 / radius; position.z *= 1.16 / radius }
  position.y = groundHeight(position.x, position.z)
}

/** @param {object} a @param {object} b @returns {void} */
function separateSpawnPair(a, b) {
  const dx = b.root.position.x - a.root.position.x
  const dz = b.root.position.z - a.root.position.z
  const distance = Math.hypot(dx, dz)
  const overlap = a.radius + b.radius + .15 - distance
  if (overlap <= 0) return
  const nx = distance > .001 ? dx / distance : 1
  const nz = distance > .001 ? dz / distance : 0
  shiftSpawn(a, -nx * overlap * .5, -nz * overlap * .5)
  shiftSpawn(b, nx * overlap * .5, nz * overlap * .5)
}

/** @param {object[]} animals @returns {void} Run once at setup, never in the animation loop. */
export function separateAnimals(animals) {
  const active = animals.filter(hasBodyCollision)
  for (let pass = 0; pass < 5; pass++) {
    active.forEach((animal, index) => {
      for (const other of active.slice(index + 1)) separateSpawnPair(animal, other)
    })
  }
  for (const animal of active) {
    if (animal.state === 'drink') animal.target.copy(animal.root.position)
  }
}
