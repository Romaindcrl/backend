import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { random } from './savanna-world.js'

export const SPECIES = {
  zebra: { scale: .95, walk: .75, run: 3.8, drink: .95 },
  impala: { scale: 1, walk: .95, run: 4.3, drink: 1.1 },
  elephant: { scale: .9, walk: .48, run: 1.5, drink: .32 },
  giraffe: { scale: .82, walk: .65, run: 2.6, drink: 1.48 },
  lion: { scale: .9, walk: .85, run: 4.05, drink: .75 },
  crocodile: { scale: .85, walk: .3, run: .8, drink: 0 },
}

// The downloaded models are static. The same GPU deformation drives visible
// geometry and shadows, with separate uniforms for each animal.
const RIG = `
  uniform float gaitPhase, gaitStride, drinkAngle, swimAmount, animalHeight, animalLength, crouchAmount, pounceAmount, browseAmount, jawAmount;
  vec3 poseAnimal(vec3 p) {
    float jaw=smoothstep(animalLength*.18,animalLength*.4,p.z)*(1.-smoothstep(animalHeight*.35,animalHeight*.7,p.y));
    p.y-=jawAmount*jaw*animalHeight*.4;
    float leg=1.-smoothstep(animalHeight*.20,animalHeight*.52,p.y);
    p.y-=crouchAmount*animalHeight*.13*smoothstep(0.,animalHeight*.55,p.y);
    p.y+=pounceAmount*animalHeight*.18*leg;
    p.z+=pounceAmount*sign(p.z)*animalLength*.09*leg;
    float diagonal=step(0.,p.x)*3.14159+step(0.,p.z)*3.14159;
    float stepPhase=gaitPhase+diagonal;
    p.z+=sin(stepPhase)*gaitStride*leg;
    p.y+=max(0.,cos(stepPhase))*gaitStride*.35*leg;
    float head=smoothstep(animalLength*.01,animalLength*.27,p.z)*smoothstep(animalHeight*.25,animalHeight*.5,p.y);
    float bend=(drinkAngle-browseAmount*.055)*head;
    vec3 pivot=vec3(0.,animalHeight*.38,animalLength*.04);
    vec3 q=p-pivot;
    p.y=pivot.y+q.y*cos(bend)-q.z*sin(bend);
    p.z=pivot.z+q.y*sin(bend)+q.z*cos(bend);
    float tail=1.-smoothstep(-animalLength*.38,-animalLength*.13,p.z);
    p.x+=browseAmount*sin(gaitPhase*1.6)*head*.018;
    p.x+=sin(gaitPhase*1.25+p.z*2.)*tail*(.018+swimAmount*.12);
    return p;
  }
`

/** @param {THREE.Material} material @param {object} uniforms @returns {void} */
function animateMaterial(material, uniforms) {
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = RIG + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = poseAnimal(position);')
  }
  material.customProgramCacheKey = () => 'savanna-animal-rig-v1'
}

/** @param {string} species @returns {Promise<THREE.Group>} Bake glTF transforms once. */
async function loadAnimal(species) {
  const gltf = await new GLTFLoader().loadAsync(`assets/models/${species}.glb`)
  gltf.scene.updateMatrixWorld(true)
  const template = new THREE.Group()
  gltf.scene.traverse(node => {
    if (!node.isMesh) return
    const geometry = node.geometry.clone()
    // Quantized glTF accessors must become floats before baking transforms.
    for (const key of ['position', 'normal']) {
      const attribute = geometry.getAttribute(key)
      if (!attribute) continue
      const data = []
      for (let i = 0; i < attribute.count; i++) data.push(attribute.getX(i), attribute.getY(i), attribute.getZ(i))
      geometry.setAttribute(key, new THREE.Float32BufferAttribute(data, 3))
    }
    geometry.applyMatrix4(node.matrixWorld)
    template.add(new THREE.Mesh(geometry, node.material))
  })
  const bounds = new THREE.Box3().setFromObject(template)
  const center = bounds.getCenter(new THREE.Vector3())
  for (const mesh of template.children) mesh.geometry.translate(-center.x, -bounds.min.y, -center.z)
  template.userData.size = bounds.getSize(new THREE.Vector3())
  return template
}

/** @param {(loaded: number) => void} onProgress @returns {Promise<Map<string, THREE.Group>>} */
export async function loadAnimals(onProgress) {
  let loaded = 0
  const entries = await Promise.all(Object.keys(SPECIES).map(async species => {
    const model = await loadAnimal(species)
    onProgress(++loaded)
    return [species, model]
  }))
  return new Map(entries)
}

/** @param {string} species @param {THREE.Group} template @param {number} variation @returns {object} */
export function createAnimal(species, template, variation = 1) {
  const root = new THREE.Group()
  const model = template.clone()
  const size = template.userData.size
  const uniforms = {
    gaitPhase: { value: random(0, 6) }, gaitStride: { value: 0 }, drinkAngle: { value: 0 },
    jawAmount: { value: 0 }, crouchAmount: { value: 0 }, pounceAmount: { value: 0 }, browseAmount: { value: 0 },
    swimAmount: { value: species === 'crocodile' ? 1 : 0 },
    animalHeight: { value: size.y }, animalLength: { value: size.z },
  }
  for (const mesh of model.children) {
    mesh.material = mesh.material.clone()
    mesh.material.roughness = .92
    animateMaterial(mesh.material, uniforms)
    mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })
    animateMaterial(mesh.customDepthMaterial, uniforms)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.frustumCulled = false
  }
  model.scale.setScalar(SPECIES[species].scale * variation)
  root.add(model)
  return {
    species, root, model, uniforms, state: 'wander', timer: random(4, 12),
    target: new THREE.Vector3(), speed: 0, heading: 0, phase: random(0, 6),
    height: size.y * SPECIES[species].scale * variation,
    length: size.z * SPECIES[species].scale * variation,
    radius: Math.max(size.x * .6, size.z * .34) * SPECIES[species].scale * variation,
    steerTime: 0, steerHeading: 0, animationSpeed: 0, waitTime: 0, blockedFor: 0, detour: null, detourGoal: new THREE.Vector3(), detourAge: 0, detourSide: Math.random() > .5 ? 1 : -1,
    tree: new THREE.Vector3(), treeIndex: 1, crocClaim: null, neighbors: null,
    ringAngle: 0, ringRadius: 2, drinkTime: 0,
  }
}

/** @param {object} animal @param {number} delta @returns {void} */
export function animateAnimal(animal, delta) {
  const { uniforms, species } = animal
  animal.animationSpeed = THREE.MathUtils.damp(animal.animationSpeed, animal.speed, 5, delta)
  animal.phase += delta * (animal.animationSpeed * 3 + .25)
  uniforms.gaitPhase.value = animal.phase
  const stride = Math.min(animal.animationSpeed * .17, .4)
  const walking = animal.speed > .01 && species !== 'crocodile' && animal.state !== 'pounce'
  uniforms.gaitStride.value = THREE.MathUtils.damp(uniforms.gaitStride.value, walking ? stride : 0, 10, delta)
  if (['drink', 'browse', 'caught', 'dragged', 'submerged'].includes(animal.state)) uniforms.gaitStride.value = 0
  uniforms.jawAmount.value = THREE.MathUtils.damp(uniforms.jawAmount.value, animal.state === 'surge' ? 1 : 0, 10, delta)
  uniforms.crouchAmount.value = THREE.MathUtils.damp(uniforms.crouchAmount.value, ['hide','stalk'].includes(animal.state) ? 1 : 0, 5, delta)
  uniforms.pounceAmount.value = THREE.MathUtils.damp(uniforms.pounceAmount.value, animal.state === 'pounce' ? 1 : 0, 12, delta)
  uniforms.browseAmount.value = THREE.MathUtils.damp(uniforms.browseAmount.value, animal.state === 'browse' ? 1 : 0, 3, delta)
  const drinking = animal.state === 'drink' || animal.state === 'eat'
  const angle = drinking ? SPECIES[species].drink : 0
  uniforms.drinkAngle.value = THREE.MathUtils.damp(uniforms.drinkAngle.value, angle, 2.2, delta)
  if (species === 'crocodile') return
  if (animal.state !== 'pounce') animal.model.rotation.x = THREE.MathUtils.damp(animal.model.rotation.x, 0, 9, delta)
  animal.model.position.y = 0
}
