import * as THREE from 'three'
import { WATER, random, lakePoint, groundHeight } from './savanna-world.js'
import { createAnimal, animateAnimal } from './savanna-animals.js'
import { chooseTree, updateHerbivore } from './savanna-herd.js'
import { LionHunter } from './savanna-hunter.js'
import { CrocodileHunter } from './savanna-crocodiles.js'
import { separateAnimals } from './savanna-collisions.js'

/** @param {object} animal @param {number} index @returns {void} */
function placeHerbivore(animal, index) {
  animal.ringAngle = index * Math.PI * 2 / 13 + .14
  const shoreRadius = Math.hypot(Math.cos(animal.ringAngle) * WATER.rx, Math.sin(animal.ringAngle) * WATER.rz)
  animal.ringRadius = Math.max(1.16, 1 + animal.length * .4 / shoreRadius)
  const startAtWater = index % 3 === 0
  animal.root.position.copy(lakePoint(animal.ringAngle, startAtWater ? animal.ringRadius : random(1.8, 2.6)))
  animal.target.copy(lakePoint(animal.ringAngle, animal.ringRadius))
  animal.state = startAtWater ? 'drink' : 'approach'
  animal.timer = random(12, 22)
  animal.heading = Math.atan2(-animal.root.position.x, -animal.root.position.z)
  animal.root.rotation.y = animal.heading
}

/** @param {Map<string, THREE.Group>} models @returns {object[]} */
function createHerd(models) {
  const herd = []
  const plan = [['zebra', 4], ['impala', 5], ['elephant', 2], ['giraffe', 2]]
  for (const [species, count] of plan) {
    for (let i = 0; i < count; i++) {
      const scale = species === 'elephant' && i === 1 ? .64 : random(.88, 1.06)
      const animal = createAnimal(species, models.get(species), scale)
      placeHerbivore(animal, herd.length)
      if (species === 'giraffe') {
        animal.treeIndex = i ? 3 : 1
        chooseTree(animal)
        if (i === 0) { animal.root.position.copy(animal.target); animal.state = 'browse'; animal.timer = 22 }
      }
      herd.push(animal)
    }
  }
  return herd
}

/** @param {Map<string, THREE.Group>} models @returns {object[]} */
function createCrocodiles(models) {
  return [0, 1].map(index => {
    const croc = createAnimal('crocodile', models.get('crocodile'), index ? .78 : 1)
    croc.ringAngle = index * Math.PI + .3
    croc.root.position.copy(lakePoint(croc.ringAngle, .55))
    croc.root.position.y = WATER.y - croc.height * .57
    croc.state = 'swim'
    return croc
  })
}

/** @param {THREE.Scene} scene @param {Map<string, THREE.Group>} models @returns {SavannaSimulation} */
export function createSimulation(scene, models) {
  const herd = createHerd(models)
  const crocs = createCrocodiles(models)
  const lion = createAnimal('lion', models.get('lion'))
  lion.root.position.set(16.5, groundHeight(16.5, -9.5), -9.5)
  lion.state = 'rest'
  const animals = [...herd, lion, ...crocs]
  for (const animal of animals) { animal.neighbors = animals; scene.add(animal.root) }
  separateAnimals(animals)
  return new SavannaSimulation(animals, herd, lion, crocs)
}

class SavannaSimulation {
  /** @param {object[]} animals @param {object[]} herd @param {object} lion @param {object[]} crocs */
  constructor(animals, herd, lion, crocs) {
    this.animals = animals
    this.herd = herd
    this.lion = lion
    this.crocs = crocs
    this.time = 0
    this.drinks = 0
    this.hunter = new LionHunter(lion, herd)
    this.crocodiles = crocs.map((croc, index) => new CrocodileHunter(croc, herd, index))
  }

  /** @param {number} delta @returns {void} Behavior, contacts and poses have separate owners. */
  update(delta) {
    this.time += delta
    this.hunter.update(this.time, delta)
    for (const hunter of this.crocodiles) hunter.update(this.time, delta)
    for (const animal of this.herd) {
      if (updateHerbivore(animal, this.lion, this.crocs, delta)) this.drinks++
    }
    for (const animal of this.animals) animateAnimal(animal, delta)
  }

  /** @returns {object} A read-only snapshot for inspecting the simulation. */
  snapshot() {
    return {
      time: this.time, hunts: this.hunter.hunts, catches: this.hunter.catches, pounces: this.hunter.pounces,
      crocodileAttacks: this.crocodiles.reduce((sum, hunter) => sum + hunter.attacks, 0),
      crocodileCatches: this.crocodiles.reduce((sum, hunter) => sum + hunter.catches, 0), drinks: this.drinks,
      animals: this.animals.map(animal => ({ species: animal.species, state: animal.state, visible: animal.root.visible,
        position: animal.root.position.toArray(), heading: animal.heading, radius: animal.radius,
        stride: animal.uniforms.gaitStride.value, drink: animal.uniforms.drinkAngle.value, browse: animal.uniforms.browseAmount.value })),
    }
  }
}
