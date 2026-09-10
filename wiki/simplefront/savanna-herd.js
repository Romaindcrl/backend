import * as THREE from 'three'
import { ACACIAS, WATER, random, lakePoint, lakeDistance, groundHeight } from './savanna-world.js'
import { canOccupy } from './savanna-collisions.js'
import { SPECIES } from './savanna-animals.js'
import { moveTo, faceTarget, headingTo } from './savanna-movement.js'

/** @param {object} animal @returns {void} */
export function chooseTree(animal) {
  const tree = ACACIAS[animal.treeIndex]
  const center = new THREE.Vector3(tree[0], groundHeight(tree[0], tree[1]), tree[1])
  const towardWater = center.clone().setY(0).negate().normalize()
  animal.tree.copy(center)
  animal.target.copy(center).addScaledVector(towardWater, 3.1 * tree[2])
  animal.target.y = groundHeight(animal.target.x, animal.target.z)
  animal.state = 'to-tree'
}

/** @param {object} animal @returns {void} */
function chooseWanderTarget(animal) {
  if (animal.species === 'giraffe') { chooseTree(animal); return }
  const angle = Math.atan2(animal.root.position.z / WATER.rz, animal.root.position.x / WATER.rx)
  animal.target.copy(lakePoint(angle + random(-.5, .5), random(1.7, 2.65)))
  animal.state = 'wander'
  animal.timer = random(6, 14)
}

/** @param {object} animal @returns {void} Lock the feet before lowering the head. */
function settleAtWater(animal) {
  animal.root.position.copy(animal.target)
  animal.speed = 0
  animal.uniforms.gaitStride.value = 0
  animal.heading = headingTo(animal.root.position, new THREE.Vector3())
  animal.root.rotation.y = animal.heading
  animal.state = 'drink'
  animal.timer = random(12, 22)
}

/** @param {object} animal @param {number} delta @returns {boolean} */
function updateAbsence(animal, delta) {
  if (animal.state === 'dragged') return true
  if (!['caught', 'away', 'submerged'].includes(animal.state)) return false
  animal.timer -= delta
  animal.speed = 0
  if (animal.state === 'caught') animal.model.rotation.z = THREE.MathUtils.damp(animal.model.rotation.z, -Math.PI / 2, 3, delta)
  if (animal.timer > 0) return true
  if (animal.state === 'caught') {
    animal.root.visible = false
    animal.state = 'away'
    animal.timer = random(18, 30)
    return true
  }
  animal.root.visible = true
  animal.model.rotation.set(0, 0, 0)
  for (let offset = 0; offset < 16; offset++) {
    const spawn = lakePoint(animal.ringAngle + offset * .22, 3.5)
    if (!canOccupy(animal, spawn)) continue
    animal.root.position.copy(spawn)
    break
  }
  chooseWanderTarget(animal)
  return true
}

/** @param {object} animal @param {object} lion @param {object[]} crocs @returns {object | undefined} */
function findThreat(animal, lion, crocs) {
  const distance = animal.root.position.distanceTo(lion.root.position)
  if (['chase', 'pounce'].includes(lion.state) && distance < 10) return lion
  if (lion.state === 'stalk' && distance < 3.3) return lion
  return crocs.find(croc => croc.state === 'surge' && croc.root.position.distanceTo(animal.root.position) < 2.5)
}

/** @param {object} animal @param {object} lion @param {object[]} crocs @param {number} delta @returns {boolean} */
function updateFear(animal, lion, crocs, delta) {
  const threat = findThreat(animal, lion, crocs)
  if (threat && animal.species !== 'elephant') {
    const direction = animal.root.position.clone().sub(threat.root.position).setY(0).normalize()
    animal.target.copy(animal.root.position).addScaledVector(direction, 8)
    animal.state = 'flee'
    animal.timer = 4
  }
  if (animal.state !== 'flee') return false
  animal.timer -= delta
  if (lakeDistance(animal.root.position.x, animal.root.position.z) > 3.5) {
    const angle = Math.atan2(animal.root.position.z / WATER.rz, animal.root.position.x / WATER.rx)
    animal.target.copy(lakePoint(angle + .45, 3.3))
  }
  moveTo(animal, animal.target, SPECIES[animal.species].run, delta)
  if (animal.timer <= 0) chooseWanderTarget(animal)
  return true
}

/** @param {object} animal @param {number} delta @returns {boolean} */
function updateBrowsing(animal, delta) {
  if (animal.state === 'to-tree') {
    if (moveTo(animal, animal.target, SPECIES.giraffe.walk, delta)) {
      animal.state = 'browse'
      animal.timer = random(18, 30)
      animal.speed = 0
    }
    return true
  }
  if (animal.state !== 'browse') return false
  animal.speed = 0
  faceTarget(animal, animal.tree, delta)
  animal.timer -= delta
  if (animal.timer < 0) {
    animal.state = 'approach'
    animal.target.copy(lakePoint(animal.ringAngle, animal.ringRadius))
  }
  return true
}

/** @param {object} animal @param {object} lion @param {object[]} crocs @param {number} delta @returns {boolean} Whether a drink began. */
export function updateHerbivore(animal, lion, crocs, delta) {
  if (updateAbsence(animal, delta) || updateFear(animal, lion, crocs, delta)) return false
  if (updateBrowsing(animal, delta)) return false
  const speed = SPECIES[animal.species].walk
  if (animal.state === 'approach') {
    if (!moveTo(animal, animal.target, speed, delta)) return false
    settleAtWater(animal)
    return true
  }
  if (animal.state === 'drink') {
    animal.speed = 0
    animal.timer -= delta
    animal.drinkTime += delta
    if (animal.timer < 0) chooseWanderTarget(animal)
    return false
  }
  if (animal.state === 'wander') {
    if (moveTo(animal, animal.target, speed, delta)) animal.state = 'graze'
    return false
  }
  animal.speed = 0
  animal.timer -= delta
  if (animal.timer > 0) return false
  animal.state = 'approach'
  animal.target.copy(lakePoint(animal.ringAngle, animal.ringRadius))
  return false
}
