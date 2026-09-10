import * as THREE from 'three'
import { ACACIAS, WATER, random, lakePoint, lakeDistance, groundHeight } from './savanna-world.js'
import { hasBodyCollision } from './savanna-collisions.js'
import { SPECIES } from './savanna-animals.js'
import { moveTo, faceTarget, headingTo } from './savanna-movement.js'

const unavailable = new Set(['caught', 'away', 'dragged', 'submerged'])

export class LionHunter {
  /** @param {object} lion @param {object[]} herd */
  constructor(lion, herd) {
    this.lion = lion
    this.herd = herd
    this.target = null
    this.time = 0
    this.phaseTime = 0
    this.nextHunt = random(12, 19)
    this.hunts = 0
    this.catches = 0
    this.pounces = 0
    this.cover = new THREE.Vector3()
    this.jumpStart = new THREE.Vector3()
    this.jumpEnd = new THREE.Vector3()
    this.jumpDuration = .8
  }

  /** @returns {boolean} */
  targetAvailable() {
    return Boolean(this.target?.root.visible && !unavailable.has(this.target.state))
  }

  /** @param {string} state @returns {void} */
  changeState(state) {
    this.lion.state = state
    this.phaseTime = 0
  }

  /** @returns {void} Put the trunk between the lion and the chosen prey. */
  planAmbush() {
    const candidates = this.herd.filter(animal => ['impala', 'zebra'].includes(animal.species) && animal.root.visible && !unavailable.has(animal.state))
    candidates.sort((a, b) => a.root.position.distanceToSquared(this.lion.root.position) - b.root.position.distanceToSquared(this.lion.root.position))
    this.target = candidates[0]
    if (!this.target) { this.nextHunt = this.time + 5; return }
    const trees = ACACIAS.slice(0, 5).map(([x, z]) => new THREE.Vector3(x, groundHeight(x, z), z))
    trees.sort((a, b) => a.distanceToSquared(this.target.root.position) - b.distanceToSquared(this.target.root.position))
    const tree = trees[0]
    const behind = tree.clone().sub(this.target.root.position).setY(0).normalize()
    this.cover.copy(tree).addScaledVector(behind, this.lion.radius + 1)
    this.cover.y = groundHeight(this.cover.x, this.cover.z)
    this.hunts++
    this.changeState('cover')
  }

  /** @returns {void} */
  beginChase() {
    this.changeState('chase')
    window.dispatchEvent(new Event('savanna-hunt'))
  }

  /** @returns {void} Aim ahead, then commit to a jump the prey can dodge. */
  beginPounce() {
    this.jumpStart.copy(this.lion.root.position)
    const escape = this.target.root.position.clone().sub(this.jumpStart).setY(0).normalize()
    if (this.target.speed > 1) escape.set(Math.sin(this.target.heading), 0, Math.cos(this.target.heading))
    this.jumpEnd.copy(this.target.root.position).addScaledVector(escape, SPECIES[this.target.species].run * this.jumpDuration * random(.7, .95))
    const reach = this.jumpEnd.clone().sub(this.jumpStart).setY(0).clampLength(0, 5.8)
    this.jumpEnd.copy(this.jumpStart).add(reach)
    this.avoidOccupiedLanding()
    const radius = lakeDistance(this.jumpEnd.x, this.jumpEnd.z)
    if (radius < 1.16) { this.jumpEnd.x *= 1.16 / radius; this.jumpEnd.z *= 1.16 / radius }
    this.jumpEnd.y = groundHeight(this.jumpEnd.x, this.jumpEnd.z)
    this.lion.heading = headingTo(this.jumpStart, this.jumpEnd)
    this.lion.root.rotation.y = this.lion.heading
    this.lion.speed = 0
    this.pounces++
    this.changeState('pounce')
    window.dispatchEvent(new Event('savanna-hunt'))
  }

  /** @returns {void} Keep the landing clear of animals other than the intended prey. */
  avoidOccupiedLanding() {
    for (const animal of this.herd) {
      if (animal === this.target || !hasBodyCollision(animal)) continue
      const away = this.jumpEnd.clone().sub(animal.root.position).setY(0)
      const clearance = this.lion.radius + animal.radius + .3
      if (away.length() >= clearance) continue
      this.jumpEnd.copy(animal.root.position).add(away.normalize().multiplyScalar(clearance))
    }
    this.lion.landing = this.jumpEnd
    this.lion.attackTarget = this.target
  }

  /** @returns {void} Only actual contact on landing counts as a capture. */
  landPounce() {
    const distance = this.lion.root.position.clone().setY(0).distanceTo(this.target?.root.position.clone().setY(0) || this.jumpStart)
    if (!this.targetAvailable() || distance > this.lion.radius + this.target.radius + .12) { this.changeState('recover'); return }
    this.target.state = 'caught'
    this.target.timer = 7
    this.target.speed = 0
    this.catches++
    this.changeState('eat')
  }

  /** @returns {void} */
  finishHunt() {
    this.target = null
    this.lion.target.copy(this.cover)
    this.nextHunt = this.time + random(30, 48)
    this.changeState('return')
  }

  /** @param {number} delta @returns {void} */
  updateAmbush(delta) {
    if (!this.targetAvailable()) { this.finishHunt(); return }
    const lion = this.lion
    const distance = lion.root.position.distanceTo(this.target.root.position)
    if (lion.state === 'cover') {
      if (moveTo(lion, this.cover, SPECIES.lion.walk, delta) || this.phaseTime > 25) this.changeState('hide')
      return
    }
    if (lion.state === 'hide') {
      lion.speed = 0
      faceTarget(lion, this.target.root.position, delta)
      if (this.phaseTime > 3 && (distance < 8 || this.phaseTime > 7)) this.changeState('stalk')
      return
    }
    if (distance < 3.4) { this.beginPounce(); return }
    moveTo(lion, this.target.root.position, .65, delta)
    if (this.phaseTime > 12) this.beginChase()
  }

  /** @param {number} delta @returns {void} */
  updateAttack(delta) {
    if (this.lion.state === 'pounce') {
      const progress = Math.min(1, this.phaseTime / this.jumpDuration)
      this.lion.root.position.lerpVectors(this.jumpStart, this.jumpEnd, progress)
      this.lion.root.position.y += Math.sin(progress * Math.PI) * 1.25
      this.lion.model.rotation.x = -.35 * Math.cos(progress * Math.PI)
      if (progress === 1) this.landPounce()
      return
    }
    if (!this.targetAvailable()) { this.finishHunt(); return }
    const distance = this.lion.root.position.distanceTo(this.target.root.position)
    if (distance < 3.4) { this.beginPounce(); return }
    moveTo(this.lion, this.target.root.position, SPECIES.lion.run, delta)
    if (this.phaseTime > 10) this.finishHunt()
  }

  /** @param {number} time @param {number} delta @returns {void} */
  update(time, delta) {
    this.time = time
    this.phaseTime += delta
    const lion = this.lion
    if (lion.state === 'rest') {
      lion.speed = 0
      if (time > this.nextHunt) this.planAmbush()
      return
    }
    if (lion.state === 'return') {
      if (moveTo(lion, lion.target, SPECIES.lion.walk, delta) || this.phaseTime > 22) this.changeState('rest')
      return
    }
    if (['cover', 'hide', 'stalk'].includes(lion.state)) { this.updateAmbush(delta); return }
    if (['chase', 'pounce'].includes(lion.state)) { this.updateAttack(delta); return }
    lion.speed = 0
    if (this.phaseTime > (lion.state === 'eat' ? 6 : 1.3)) this.finishHunt()
  }
}
