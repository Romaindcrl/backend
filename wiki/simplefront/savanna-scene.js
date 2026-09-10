import * as THREE from 'three'
import { createWorld } from './savanna-world.js'
import { loadAnimals } from './savanna-animals.js'
import { createSimulation } from './savanna-simulation.js'
import { createRipples, createSplashes } from './savanna-effects.js'

const canvas = document.querySelector('#savanna-canvas')
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
let renderer, scene, camera, world, simulation, ripples, splashes
let frame = 0, lastTime = 0, elapsed = 0
let paused = motionPreference.matches
let disposed = false

/** @returns {void} Keep the watering hole beside the reading column. */
function resize() {
  if (!renderer) return
  const width = window.innerWidth, height = window.innerHeight
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, width < 700 ? 1.2 : 1.5))
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  const mobile = width < 900
  camera.position.set(mobile ? 27 : 26, mobile ? 32 : 23, mobile ? 48 : 35)
  camera.lookAt(mobile ? 0 : -11, 0, mobile ? 0 : 5)
  camera.clearViewOffset()
  if (mobile) camera.setViewOffset(width, height, 0, height * .24, width, height)
  camera.updateProjectionMatrix()
  renderer.render(scene, camera)
}

/** @param {number} now @returns {void} The background uses at most 30 frames per second. */
function renderFrame(now) {
  frame = 0
  if (disposed || document.hidden || paused) return
  frame = requestAnimationFrame(renderFrame)
  if (now - lastTime < 1000 / 30) return
  const delta = Math.min((now - lastTime) / 1000, .07)
  lastTime = now
  elapsed += delta
  simulation?.update(delta)
  world.update(elapsed)
  ripples?.update(elapsed)
  splashes?.update(delta)
  renderer.render(scene, camera)
}

/** @returns {void} Hidden tabs do not advance the simulation or build a backlog. */
function resumeRendering() {
  cancelAnimationFrame(frame)
  frame = 0
  if (disposed || document.hidden || paused) return
  lastTime = performance.now()
  frame = requestAnimationFrame(renderFrame)
}

/** @param {boolean} value @returns {void} */
function setPaused(value) {
  paused = value
  canvas.dataset.state = paused ? 'paused' : 'running'
  resumeRendering()
}

/** @returns {void} Release shared GPU resources once when this document is discarded. */
function dispose() {
  disposed = true
  cancelAnimationFrame(frame)
  splashes?.dispose()
  const resources = new Set()
  scene?.traverse(node => {
    if (node.geometry) resources.add(node.geometry)
    if (node.material) resources.add(node.material)
    if (node.customDepthMaterial) resources.add(node.customDepthMaterial)
  })
  for (const resource of resources) resource.dispose()
  renderer?.dispose()
}

/** @returns {Promise<void>} The articles remain available if WebGL or an asset fails. */
async function start() {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' })
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    scene = new THREE.Scene()
    camera = new THREE.PerspectiveCamera(44, 1, .1, 260)
    world = createWorld(scene)
    resize()
    resumeRendering()
    const models = await loadAnimals(count => { canvas.dataset.loadedSpecies = String(count) })
    if (disposed) return
    simulation = createSimulation(scene, models)
    simulation.update(0)
    ripples = createRipples(scene, simulation.animals)
    splashes = createSplashes(scene)
    renderer.render(scene, camera)
    setPaused(paused)
    canvas.dataset.loaded = 'true'
  } catch (error) {
    cancelAnimationFrame(frame)
    canvas.dataset.state = 'error'
    console.error('[Savanna]', error)
  }
}

window.Savanna = {
  snapshot: () => ({ ...simulation?.snapshot(), paused, visible: !document.hidden,
    drawCalls: renderer?.info.render.calls, triangles: renderer?.info.render.triangles }),
}
window.addEventListener('resize', resize)
document.addEventListener('visibilitychange', resumeRendering)
motionPreference.addEventListener('change', event => setPaused(event.matches))
window.addEventListener('pagehide', event => { if (!event.persisted) dispose(); else cancelAnimationFrame(frame) })
window.addEventListener('pageshow', resumeRendering)
canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); setPaused(true); canvas.dataset.state = 'context-lost' })
void start()
