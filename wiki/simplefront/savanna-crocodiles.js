import * as THREE from 'three'
import { WATER, random, lakePoint, lakeDistance, groundHeight } from './savanna-world.js'
import { faceTarget, headingTo } from './savanna-movement.js'

/** @param {object} croc @param {THREE.Vector3} target @param {number} speed @param {number} delta @returns {boolean} */
function swimTo(croc, target, speed, delta) {
  const difference = target.clone().sub(croc.root.position).setY(0)
  const distance = difference.length()
  faceTarget(croc, target, delta)
  croc.root.position.addScaledVector(difference.normalize(), Math.min(distance, speed * delta))
  croc.speed = speed
  return distance < .25
}

/** @param {THREE.Vector3} position @returns {void} Visuals and audio share the same event. */
function splash(position) {
  window.dispatchEvent(new CustomEvent('savanna-splash', { detail: { x: position.x, z: position.z } }))
}

export class CrocodileHunter {
  /** @param {object} croc @param {object[]} herd @param {number} index */
  constructor(croc, herd, index) {
    this.croc = croc
    this.herd = herd
    this.target = null
    this.time = 0
    this.phaseTime = 0
    this.nextAttack = 25 + index * 25
    this.shore = new THREE.Vector3()
    this.retreat = new THREE.Vector3()
    this.catches = 0
    this.attacks = 0
    this.submergeTime = 0
  }

  /** @param {string} state @returns {void} */
  changeState(state) {
    this.croc.state = state
    this.phaseTime = 0
  }

  /** @returns {void} Only small, unclaimed animals currently drinking are targets. */
  chooseTarget() {
    const candidates = this.herd.filter(animal => ['impala', 'zebra'].includes(animal.species) && animal.state === 'drink' && animal.timer > 5 && !animal.crocClaim)
    candidates.sort((a, b) => a.root.position.distanceToSquared(this.croc.root.position) - b.root.position.distanceToSquared(this.croc.root.position))
    this.target = candidates[0]
    if (!this.target) { this.nextAttack = this.time + 3; return }
    this.target.crocClaim = this
    const angle = Math.atan2(this.target.root.position.z / WATER.rz, this.target.root.position.x / WATER.rx)
    this.shore.copy(lakePoint(angle, .92))
    this.retreat.copy(lakePoint(angle + .25, .38))
    this.changeState('lurk')
  }

  /** @returns {void} */
  finishAttack() {
    if (this.target) this.target.crocClaim = null
    this.target = null
    this.nextAttack = this.time + random(38, 62)
    this.croc.ringAngle = Math.atan2(this.croc.root.position.z / WATER.rz, this.croc.root.position.x / WATER.rx)
    this.changeState('swim')
  }

  /** @returns {void} */
  grabPrey() {
    this.target.state = 'dragged'
    this.target.speed = 0
    this.target.uniforms.gaitStride.value = 0
    this.submergeTime = 0
    this.catches++
    this.changeState('drag')
    splash(this.target.root.position)
  }

  /** @param {number} delta @returns {void} */
  updateApproach(delta) {
    if (!this.target?.root.visible || !['drink', 'flee'].includes(this.target.state)) { this.finishAttack(); return }
    const croc = this.croc
    if (croc.state === 'lurk') {
      if (this.target.state !== 'drink') { this.finishAttack(); return }
      const reached = swimTo(croc, this.shore, .85, delta)
      croc.root.position.y = WATER.y - croc.height * .76
      if (reached) { this.attacks++; this.changeState('surge'); splash(croc.root.position) }
      return
    }
    swimTo(croc, this.target.root.position, 5.5, delta)
    croc.root.position.y = THREE.MathUtils.damp(croc.root.position.y, groundHeight(croc.root.position.x, croc.root.position.z), 5, delta)
    if (croc.root.position.distanceTo(this.target.root.position) < 1.25) { this.grabPrey(); return }
    if (this.phaseTime > .85) this.finishAttack()
  }

  /** @param {number} delta @returns {void} */
  updateDrag(delta) {
    const croc = this.croc
    swimTo(croc, this.retreat, 1.8, delta)
    if (lakeDistance(croc.root.position.x, croc.root.position.z) < .85) this.submergeTime += delta
    const depth = Math.min(1, this.submergeTime / 2.1)
    croc.root.position.y = Math.max(groundHeight(croc.root.position.x, croc.root.position.z), WATER.y - croc.height * .5) - depth * .55
    const mouth = new THREE.Vector3(Math.sin(croc.heading), 0, Math.cos(croc.heading))
    this.target.root.position.copy(croc.root.position).addScaledVector(mouth, croc.length * .32)
    const bank = groundHeight(this.target.root.position.x, this.target.root.position.z)
    this.target.root.position.y = Math.max(WATER.y, bank) - depth * (this.target.height + .3)
    this.target.heading = croc.heading + Math.PI / 2
    this.target.root.rotation.y = this.target.heading
    this.target.model.rotation.z = -.45 - depth * .5
    if (depth < 1) return
    this.target.root.visible = false
    this.target.state = 'submerged'
    this.target.timer = random(25, 38)
    this.changeState('dive')
  }

  /** @param {number} delta @returns {void} Cruise without teleporting after an attack. */
  cruise(delta) {
    const croc = this.croc
    croc.ringAngle += delta * .035
    const destination = lakePoint(croc.ringAngle + .25, .55)
    swimTo(croc, destination, .4, delta)
    const surface = WATER.y - croc.height * .57 + Math.sin(this.time * .6) * .012
    croc.root.position.y = THREE.MathUtils.damp(croc.root.position.y, surface, .8, delta)
  }

  /** @param {number} time @param {number} delta @returns {void} */
  update(time, delta) {
    this.time = time
    this.phaseTime += delta
    if (this.croc.state === 'swim') {
      this.cruise(delta)
      if (time > this.nextAttack) this.chooseTarget()
      return
    }
    if (['lurk', 'surge'].includes(this.croc.state)) { this.updateApproach(delta); return }
    if (this.croc.state === 'drag') { this.updateDrag(delta); return }
    this.croc.speed = .1
    if (this.phaseTime > 3) this.finishAttack()
  }
}
