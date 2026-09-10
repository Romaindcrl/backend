import * as THREE from 'three'
import { WATER, ACACIAS, lakeDistance, lakePoint, groundHeight } from './savanna-world.js'
import { hasBodyCollision, canOccupy } from './savanna-collisions.js'

/** @param {number} target @param {number} current @returns {number} Shortest signed turn. */
export const angleDifference = (target, current) => Math.atan2(Math.sin(target - current), Math.cos(target - current))

/** @param {THREE.Vector3} position @param {THREE.Vector3} target @returns {number} */
export const headingTo = (position, target) => Math.atan2(target.x - position.x, target.z - position.z)

/** @param {object} animal @param {THREE.Vector3} target @param {number} delta @returns {void} */
export function faceTarget(animal, target, delta) {
  const turn = angleDifference(headingTo(animal.root.position, target), animal.heading)
  const limit = (animal.speed > 2 ? 2.6 : 1.35) * delta
  animal.heading += THREE.MathUtils.clamp(turn, -limit, limit)
  animal.root.rotation.y = animal.heading
}

/** @param {object} animal @returns {{position: THREE.Vector3, radius: number}[]} */
function obstaclesFor(animal) {
  const trees = ACACIAS.map(([x, z, scale]) => ({ position: new THREE.Vector3(x, 0, z), radius: .35 * scale + animal.radius + .15 }))
  const neighbors = (animal.neighbors || []).filter(other => other !== animal && hasBodyCollision(other))
  return [...trees, ...neighbors.map(other => ({ position: other.root.position, radius: animal.radius + other.radius + .28 }))]
}

/** @param {THREE.Vector3} position @param {THREE.Vector3} target @returns {THREE.Vector3 | null} */
function routeAroundWater(position, target) {
  const probe = new THREE.Vector3()
  for (let step = 1; step < 9; step++) {
    probe.lerpVectors(position, target, step / 9)
    if (lakeDistance(probe.x, probe.z) >= 1.13) continue
    const angle = Math.atan2(position.z / WATER.rz, position.x / WATER.rx)
    const goal = Math.atan2(target.z / WATER.rz, target.x / WATER.rx)
    return lakePoint(angle + Math.sign(angleDifference(goal, angle)) * .38, Math.max(1.4, lakeDistance(position.x, position.z)))
  }
  return null
}

/** @param {object} animal @param {THREE.Vector3} target @returns {THREE.Vector3 | null} */
function routeAroundBody(animal, target) {
  const position = animal.root.position
  const direction = target.clone().sub(position).setY(0).normalize()
  const distance = position.distanceTo(target)
  const obstacles = obstaclesFor(animal)
  obstacles.sort((a, b) => a.position.distanceToSquared(position) - b.position.distanceToSquared(position))
  for (const obstacle of obstacles) {
    const offset = obstacle.position.clone().sub(position).setY(0)
    const ahead = offset.dot(direction)
    if (ahead < 0 || ahead > Math.min(distance - .15, 5)) continue
    const across = offset.x * direction.z - offset.z * direction.x
    if (Math.abs(across) > obstacle.radius) continue
    const side = Math.abs(across) < .05 ? animal.detourSide : across > 0 ? 1 : -1
    const waypoint = obstacle.position.clone().add(new THREE.Vector3(direction.z, 0, -direction.x).multiplyScalar(side * (obstacle.radius + .6)))
    waypoint.addScaledVector(direction, obstacle.radius * .6)
    const radius = lakeDistance(waypoint.x, waypoint.z)
    if (radius < 1.18) { waypoint.x *= 1.18 / radius; waypoint.z *= 1.18 / radius }
    waypoint.y = groundHeight(waypoint.x, waypoint.z)
    return waypoint
  }
  return null
}

/** @param {object} animal @param {THREE.Vector3} target @param {number} delta @returns {THREE.Vector3} Commit to the chosen side until the obstacle is passed. */
function navigationTarget(animal, target, delta) {
  animal.detourAge += delta
  const arrived = animal.detour && animal.root.position.distanceTo(animal.detour) < .35
  const changedGoal = animal.detourGoal.distanceTo(target) > 1.5
  if (arrived || changedGoal || animal.detourAge > 7) animal.detour = null
  if (animal.detour) return animal.detour
  animal.detour = routeAroundWater(animal.root.position, target) || routeAroundBody(animal, target)
  animal.detourGoal.copy(target)
  animal.detourAge = 0
  return animal.detour || target
}

/** @param {object} animal @param {number} heading @param {number} step @returns {THREE.Vector3 | null} */
function stepInDirection(animal, heading, step) {
  const candidate = animal.root.position.clone().add(new THREE.Vector3(Math.sin(heading) * step, 0, Math.cos(heading) * step))
  if (lakeDistance(candidate.x, candidate.z) < 1.14 || !canOccupy(animal, candidate)) return null
  const blocked = ACACIAS.some(([x, z, scale]) => Math.hypot(candidate.x - x, candidate.z - z) < animal.radius + scale * .3)
  return blocked ? null : candidate
}

/** @param {object} animal @param {THREE.Vector3} waypoint @param {number} step @param {number} delta @returns {number | null} Hold a steering decision rather than changing sides every frame. */
function chooseHeading(animal, waypoint, step, delta) {
  animal.steerTime -= delta
  if (animal.steerTime > 0) return animal.steerHeading
  const desired = headingTo(animal.root.position, waypoint)
  const offsets = [0, .4, -.4, .8, -.8, 1.2, -1.2, 1.6, -1.6, 2.1, -2.1]
  for (const offset of offsets) {
    const heading = desired + offset * animal.detourSide
    if (!stepInDirection(animal, heading, Math.max(step, .35))) continue
    animal.steerHeading = heading
    animal.steerTime = .7
    return heading
  }
  return null
}

/** @param {object} animal @param {number} delta @returns {void} Waiting does not animate the feet or turn the body. */
function waitForSpace(animal, delta) {
  animal.speed = 0
  animal.blockedFor += delta
  if (animal.blockedFor < .45) return
  animal.detour = null
  animal.detourSide *= -1
  animal.waitTime = .35 + animal.radius * .1
  animal.blockedFor = 0
}

/** @param {object} animal @param {THREE.Vector3} target @param {number} speed @param {number} delta @returns {boolean} */
export function moveTo(animal, target, speed, delta) {
  const position = animal.root.position
  if (animal.waitTime > 0) { animal.waitTime -= delta; animal.speed = 0; return false }
  const distance = Math.hypot(target.x - position.x, target.z - position.z)
  if (distance < .18 && canOccupy(animal, target)) { animal.speed = 0; animal.detour = null; return true }
  const waypoint = navigationTarget(animal, target, delta)
  const step = Math.min(position.distanceTo(waypoint), speed * delta)
  const steering = chooseHeading(animal, waypoint, step, delta)
  if (steering === null) { waitForSpace(animal, delta); return false }
  const facing = position.clone().add(new THREE.Vector3(Math.sin(steering), 0, Math.cos(steering)))
  faceTarget(animal, facing, delta)
  if (Math.abs(angleDifference(steering, animal.heading)) > .3) { animal.speed = 0; return false }
  const candidate = stepInDirection(animal, animal.heading, step)
  if (!candidate) { waitForSpace(animal, delta); return false }
  animal.blockedFor = 0
  animal.speed = speed
  position.copy(candidate)
  position.y = groundHeight(position.x, position.z)
  return false
}
