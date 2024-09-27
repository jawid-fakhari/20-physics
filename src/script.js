import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import GUI from "lil-gui";
import CANNON, { Vec3 } from "cannon";

/******************************************
 * Debug
 */
const gui = new GUI();
const debugObject = {};

//creare sfere
debugObject.createSphere = () => {
  createSphere(Math.random() * 0.5, {
    x: (Math.random() - 0.5) * 3,
    y: 3,
    z: (Math.random() - 0.5) * 3,
  });
};
gui.add(debugObject, "createSphere");

//creare boxes
debugObject.createBoxes = () => {
  createBoxes(Math.random() * 0.5, Math.random() * 0.5, Math.random() * 0.5, {
    x: (Math.random() - 0.5) * 3,
    y: 3,
    z: (Math.random() - 0.5) * 3,
  });
};
gui.add(debugObject, "createBoxes");

/********************************************
 * Base
 */
// Canvas
const canvas = document.querySelector("canvas.webgl");

// Scene
const scene = new THREE.Scene();

/******************************************
 * Sounds
 */
const collisionSound = new Audio("/sounds/hit.mp3");

/******************************************
 * Textures
 */
const textureLoader = new THREE.TextureLoader();
const cubeTextureLoader = new THREE.CubeTextureLoader();

const environmentMapTexture = cubeTextureLoader.load([
  "/textures/environmentMaps/0/px.png",
  "/textures/environmentMaps/0/nx.png",
  "/textures/environmentMaps/0/py.png",
  "/textures/environmentMaps/0/ny.png",
  "/textures/environmentMaps/0/pz.png",
  "/textures/environmentMaps/0/nz.png",
]);

/******************************************
 * Physics
 */
//World
const world = new CANNON.World();
//Migliorare le prestazioni; SAPBroadphase testa i corpi su assi arbitrari durante più passaggi.
world.broadphase = new CANNON.SAPBroadphase(world);
//Anche se utilizziamo un algoritmo broadphase migliorato, tutti i Body vengono testati, anche quelli che non si muovono più. Possiamo usare una funzionalità chiamata sleep. con questa modalità quando il corpo è addormentato non verrà testato
world.allowSleep = true;
//dare gravità della terra al world
world.gravity.set(0, -9.82, 0);

//**Materials, referenza dei materiali che useremo per contact material
const defaultMaterial = new CANNON.Material("default");

//**Contact Material che setta il comportamento del contatto di due materiali
const defaultContatctMaterial = new CANNON.ContactMaterial(
  defaultMaterial,
  defaultMaterial,
  {
    friction: 0.1,
    restitution: 0.7, //bouncing
  }
);

//aggiungiamo al world, ma dobbiamo passare i materiali alle geometrie
world.addContactMaterial(defaultContatctMaterial);

//Floor
//plane in cannon è infinito al contrario del three.js place
//plane di default rivolta verso la camera, quindi necessità di cambiare l'angolo in base alla necessità
const floorShape = new CANNON.Plane();
const floorBody = new CANNON.Body();
//dedicare concretMaterial al floor
floorBody.material = defaultMaterial;
//possiamo non scriverlo perche di default è 0
floorBody.mass = 0;
//addShape, ci da possibilità di creare un Body composito da multipli shapes
floorBody.addShape(floorShape);
//cambiare l'angolo di cmaera con quaternion e setFromAxixAngle
floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(-1, 0, 0), Math.PI * 0.5);
world.addBody(floorBody);

/******************************************
 * Floor
 */
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(10, 10),
  new THREE.MeshStandardMaterial({
    color: "#777777",
    metalness: 0.3,
    roughness: 0.4,
    envMap: environmentMapTexture,
    envMapIntensity: 0.5,
  })
);
floor.receiveShadow = true;
floor.rotation.x = -Math.PI * 0.5;
scene.add(floor);

/******************************************
 * Lights
 */
const ambientLight = new THREE.AmbientLight(0xffffff, 2.1);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.set(1024, 1024);
directionalLight.shadow.camera.far = 15;
directionalLight.shadow.camera.left = -7;
directionalLight.shadow.camera.top = 7;
directionalLight.shadow.camera.right = 7;
directionalLight.shadow.camera.bottom = -7;
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

/******************************************
 * Sizes
 */
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};

window.addEventListener("resize", () => {
  // Update sizes
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  // Update camera
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  // Update renderer
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

/******************************************
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(
  75,
  sizes.width / sizes.height,
  0.1,
  100
);
camera.position.set(-3, 3, 3);
scene.add(camera);

// Controls
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

/******************************************
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
});
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

/******************************************
 * Utils (handle multiple objects) creare una funzione per automatizzare
 */
//oggetto che salva gli oggetti che necessitano aggiornamenti per physics animation
const objectsToUpdate = [];

//Geometries
const sphereGeometry = new THREE.SphereGeometry(1, 20, 20);
const boxGeometry = new THREE.BoxGeometry(1, 1, 1);

//Materials
const meshMaterial = new THREE.MeshStandardMaterial({
  metalness: 0.3,
  roughness: 0.4,
  envMap: environmentMapTexture,
  envMapIntensity: 0.5,
});

// Sphere Maker function
const createSphere = (radius, position) => {
  //Three.js mesh
  const mesh = new THREE.Mesh(sphereGeometry, meshMaterial);
  mesh.scale.set(radius, radius, radius);
  mesh.castShadow = true;
  mesh.position.copy(position);
  scene.add(mesh);

  //Cannon.js body
  const shape = new CANNON.Sphere(radius);
  const body = new CANNON.Body({
    mass: 1,
    position: new CANNON.Vec3(0, 3, 0),
    shape,
    material: defaultMaterial,
  });
  body.position.copy(position);

  soundPlayer(body);

  world.addBody(body);

  //Salavare dentro objects To Update
  objectsToUpdate.push({
    mesh,
    body,
  });
};

// Box Maker function
const createBoxes = (width, height, depth, position) => {
  //Three.js mesh
  const mesh = new THREE.Mesh(boxGeometry, meshMaterial);
  mesh.scale.set(width, height, depth);
  mesh.castShadow = true;
  mesh.position.copy(position);
  scene.add(mesh);

  //Cannon.js body
  const shape = new CANNON.Box(new Vec3(width, height, depth)); //Box in CANNON.js ha bisgono di Vec3
  const body = new CANNON.Body({
    mass: 1,
    position: new CANNON.Vec3(0, 3, 0),
    shape,
    material: defaultMaterial,
  });
  body.position.copy(position);

  soundPlayer(body);

  world.addBody(body);

  //Salavare dentro objects To Update
  objectsToUpdate.push({
    mesh,
    body,
  });
};

const soundPlayer = (body) => {
  //collide listener to play sound
  body.addEventListener("collide", (e) => {
    const impactForce = e.contact.getImpactVelocityAlongNormal();
    if (impactForce > 2) {
      collisionSound.currentTime = 0;
      collisionSound.play();
    }
  });
};

//Chiamare la funzione e passare i parametri. qui al posto di Vetor3 oppure Vec3 possiamo passare object x y z, grazie a una funzionalità di CANNON.js
//******Creato un lil-gui button per creare le sphere */
// createSphere(0.5, { x: 0, y: 3, z: 0 });
// createSphere(0.5, { x: 2, y: 1, z: 2 });

/******************************************
 * Animate
 */
const clock = new THREE.Clock();
let oldElapsedTime = 0;

const tick = () => {
  const elapsedTime = clock.getElapsedTime();
  //trovare delta time
  const deltaTime = elapsedTime - oldElapsedTime;
  oldElapsedTime = elapsedTime;

  //Update physics world .step(fps, deltaTime, number of iterations)
  world.step(1 / 60, deltaTime, 3);

  for (const object of objectsToUpdate) {
    object.mesh.position.copy(object.body.position);
    object.mesh.quaternion.copy(object.body.quaternion);
  }

  // Update controls
  controls.update();

  // Render
  renderer.render(scene, camera);

  // Call tick again on the next frame
  window.requestAnimationFrame(tick);
};

tick();
