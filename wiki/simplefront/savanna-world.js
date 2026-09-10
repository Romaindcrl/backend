import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

export const ACACIAS = [
  [-13,-8,1.1], [15,-8,.85], [26,17,.95], [-16,7,.9], [5,-18,.8],
  [-27,-16,1.7], [25,-24,1.3], [-8,-29,1.2], [34,-7,1.5], [-37,-35,2], [14,-38,1.7],
]
export const WATER = { x: 0, z: 0, rx: 8, rz: 5, y: 0.12 }
/** @param {number} min @param {number} max @returns {number} */
export const random = (min, max) => min + Math.random() * (max - min)

/** @param {number} x @param {number} z @returns {number} Distance in lake radii. */
export function lakeDistance(x, z) {
  return Math.hypot(x / WATER.rx, z / WATER.rz)
}

/** @param {number} x @param {number} z @returns {number} Ground height, including the basin. */
export function groundHeight(x, z) {
  const distance = lakeDistance(x, z)
  if (distance < 0.96) return -0.65
  const shore = THREE.MathUtils.smoothstep(distance, 0.96, 1.2)
  const hills = (Math.sin(x * 0.11) * Math.cos(z * 0.12) + 1) * 0.3
  return -0.3 + shore * (0.6 + hills * THREE.MathUtils.smoothstep(distance, 1.3, 3))
}

/** @param {number} angle @param {number} radius @returns {THREE.Vector3} */
export function lakePoint(angle, radius) {
  const x = Math.cos(angle) * WATER.rx * radius
  const z = Math.sin(angle) * WATER.rz * radius
  return new THREE.Vector3(x, groundHeight(x, z), z)
}

/** @param {THREE.Scene} scene @returns {void} */
function addSky(scene) {
  const sky = new THREE.Mesh(new THREE.SphereGeometry(160, 24, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vPosition; void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec3 vPosition;
      void main(){
        float h=normalize(vPosition).y;
        vec3 horizon=vec3(0.94,0.74,0.47);
        vec3 top=vec3(0.29,0.53,0.62);
        gl_FragColor=vec4(mix(horizon,top,smoothstep(-0.04,0.8,h)),1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }))
  scene.add(sky)
  const sun = new THREE.Mesh(new THREE.SphereGeometry(4, 24, 16), new THREE.MeshBasicMaterial({ color: '#fff3bb', fog: false }))
  sun.position.set(-48, 27, -65)
  scene.add(sun)
}

/** @param {THREE.Scene} scene @returns {void} */
function addTerrain(scene) {
  const geometry = new THREE.PlaneGeometry(220, 220, 150, 150)
  geometry.rotateX(-Math.PI / 2)
  const position = geometry.attributes.position
  const colors = []
  const dry = new THREE.Color('#9c925a')
  const sand = new THREE.Color('#c8b181')
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), z = position.getZ(i)
    position.setY(i, groundHeight(x, z))
    const color = dry.clone().lerp(sand, Math.max(0, 1 - Math.abs(lakeDistance(x, z) - 1) / 0.7))
    color.multiplyScalar(0.94 + Math.sin(x * 1.3 + z * 1.7) * 0.035)
    colors.push(color.r, color.g, color.b)
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  const ground = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }))
  ground.receiveShadow = true
  scene.add(ground)
}

/** @param {THREE.Scene} scene @returns {{update: (time: number) => void}} */
function addWater(scene) {
  const shape = new THREE.Shape()
  shape.absellipse(0, 0, WATER.rx, WATER.rz, 0, Math.PI * 2, false, 0)
  const geometry = new THREE.ShapeGeometry(shape, 96)
  geometry.rotateX(-Math.PI / 2)
  const material = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: `varying vec3 vWorld; void main(){vec4 world=modelMatrix*vec4(position,1.);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader: `uniform float time; varying vec3 vWorld;
      void main(){
        vec2 p=vWorld.xz;
        float edge=length(p/vec2(8.,5.));
        float waves=sin(p.x*2.5+p.y*1.5+time*0.6)*sin(p.y*3.2-p.x*.5-time*.4);
        float streak=pow(max(0.,sin(p.y*12.+sin(p.x*3.+time)+time*.7)),36.);
        vec3 deep=vec3(.025,.13,.12), shallow=vec3(.14,.29,.22);
        vec3 color=mix(deep,shallow,smoothstep(.35,1.,edge));
        color+=waves*.035;
        float sunPath=exp(-pow((p.x+p.y*.65+1.)/2.4,2.));
        color+=vec3(1.,.77,.35)*streak*sunPath*.25;
        float foam=smoothstep(.995,1.,edge)*(.45+.18*sin(p.y*8.+time));
        color=mix(color,vec3(.77,.79,.57),foam);
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
  const water = new THREE.Mesh(geometry, material)
  water.position.y = WATER.y
  scene.add(water)
  return { update: time => { material.uniforms.time.value = time } }
}

/** @param {THREE.Vector3} start @param {THREE.Vector3} end @param {number} width @param {THREE.Material} material @returns {THREE.Mesh} */
function branch(start, end, width, material) {
  const delta = end.clone().sub(start)
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.4, width, delta.length(), 6), material)
  mesh.position.copy(start).add(end).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize())
  mesh.castShadow = true
  return mesh
}

/** @param {THREE.Scene} scene @returns {void} */
function addAcacias(scene) {
  const grove = new THREE.Group()
  const bark = new THREE.MeshStandardMaterial({ color: '#574e32', roughness: 1 })
  const leaves = [0x52603a, 0x697043, 0x7c7941].map(color => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 1 }))
  const crown = new THREE.IcosahedronGeometry(1, 1)

  for (const [x, z, scale] of ACACIAS) {
    const tree = new THREE.Group()
    tree.position.set(x, groundHeight(x, z), z)
    tree.scale.setScalar(scale)
    tree.add(branch(new THREE.Vector3(), new THREE.Vector3(.35, 4.5, 0), .28, bark))
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * 2 / 5
      const end = new THREE.Vector3(Math.cos(angle) * 2.4, 5.4 + Math.sin(i * 5) * .3, Math.sin(angle) * 1.8)
      tree.add(branch(new THREE.Vector3(.25, 3.3, 0), end, .14, bark))
      const canopy = new THREE.Mesh(crown, leaves[i % 3])
      canopy.position.copy(end)
      canopy.scale.set(2.25, .7, 1.7)
      canopy.castShadow = true
      tree.add(canopy)
    }
    grove.add(tree)
  }
  mergeTrees(scene, grove)
}

/** @param {THREE.Scene} scene @param {THREE.Group} grove @returns {void} Batch static trees into four draws instead of hundreds. */
function mergeTrees(scene, grove) {
  const batches = new Map()
  const originals = new Set()
  grove.updateMatrixWorld(true)
  grove.traverse(mesh => {
    if (!mesh.isMesh) return
    const geometries = batches.get(mesh.material) || []
    geometries.push(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld))
    batches.set(mesh.material, geometries)
    originals.add(mesh.geometry)
  })
  for (const [material, geometries] of batches) {
    const mesh = new THREE.Mesh(mergeGeometries(geometries), material)
    mesh.castShadow = true
    scene.add(mesh)
    for (const geometry of geometries) geometry.dispose()
  }
  for (const geometry of originals) geometry.dispose()
}

/** @param {THREE.Scene} scene @returns {{update: (time: number) => void}} */
function addGrass(scene) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -.14,0,0, .14,0,0, .06,.7,0, 0,0,-.13, 0,0,.13, .12,.52,0,
  ], 3))
  geometry.computeVertexNormals()
  const wind = { value: 0 }
  const material = new THREE.MeshStandardMaterial({ color: '#b3a15c', roughness: 1, side: THREE.DoubleSide })
  material.onBeforeCompile = shader => {
    shader.uniforms.windTime = wind
    shader.vertexShader = 'uniform float windTime;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      transformed.x+=sin(windTime*1.3+instanceMatrix[3].x*.3+instanceMatrix[3].z*.4)*position.y*position.y*.2;`)
  }
  const grass = new THREE.InstancedMesh(geometry, material, 3200)
  const transform = new THREE.Object3D()
  let count = 0
  for (let i = 0; i < 4000 && count < 3200; i++) {
    const x = random(-45, 45), z = random(-45, 24)
    if (lakeDistance(x, z) < 1.3) continue
    transform.position.set(x, groundHeight(x, z), z)
    transform.rotation.y = random(0, Math.PI * 2)
    transform.scale.setScalar(random(.5, 1.3))
    transform.updateMatrix()
    grass.setMatrixAt(count, transform.matrix)
    grass.setColorAt(count, new THREE.Color().setHSL(random(.1, .16), random(.28, .48), random(.34, .55)))
    count++
  }
  grass.count = count
  scene.add(grass)
  return { update: time => { wind.value = time } }
}

/** @param {THREE.Scene} scene @returns {void} */
function addRocks(scene) {
  const material = new THREE.MeshStandardMaterial({ color: '#928771', roughness: 1, flatShading: true })
  const geometry = new THREE.IcosahedronGeometry(1, 0)
  const rocks = new THREE.InstancedMesh(geometry, material, 65)
  const transform = new THREE.Object3D()
  for (let i = 0; i < 65; i++) {
    const point = lakePoint(random(0, Math.PI * 2), random(1.3, 4))
    transform.position.copy(point)
    transform.rotation.set(random(0, 1), random(0, 6), random(0, 1))
    const size = random(.2, .7)
    transform.scale.set(size * 1.3, size * .7, size)
    transform.updateMatrix()
    rocks.setMatrixAt(i, transform.matrix)
  }
  rocks.castShadow = true
  rocks.receiveShadow = true
  scene.add(rocks)
  for (let i = 0; i < 9; i++) {
    const hill = new THREE.Mesh(geometry, material)
    hill.position.set(-70 + i * 18, -2, -65 - (i % 3) * 8)
    hill.scale.set(random(15, 25), random(7, 15), 14)
    scene.add(hill)
  }
}

/** @param {THREE.Scene} scene @returns {{update: (time: number) => void}} */
export function createWorld(scene) {
  scene.fog = new THREE.Fog('#d9bc88', 45, 115)
  scene.add(new THREE.HemisphereLight('#ffe9c5', '#7e7952', 2.1))
  const sunlight = new THREE.DirectionalLight('#ffe0a0', 3.1)
  sunlight.position.set(-25, 32, -18)
  sunlight.castShadow = true
  sunlight.shadow.mapSize.set(2048, 2048)
  Object.assign(sunlight.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 1, far: 85 })
  sunlight.shadow.bias = -.0005
  sunlight.shadow.normalBias = .04
  scene.add(sunlight)
  addSky(scene)
  addTerrain(scene)
  addAcacias(scene)
  addRocks(scene)
  const water = addWater(scene)
  const grass = addGrass(scene)
  return { update(time) { water.update(time); grass.update(time) } }
}
