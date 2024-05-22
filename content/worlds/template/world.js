import { World, RecorderUI } from '../../../babylon/js/vrspace-min.js';

export class WorldTemplate extends World {
  // OPTIONAL:
  // specify world file name and location
  constructor() {
    super();
    // your world file name, defaults to scene.gltf
    this.file='dolphin.glb';
    // your world directory, defaults to location of world script
    this.baseUrl='https://www.vrspace.org/babylon/';
  }
  // OPTIONAL: override this method to customize loading of world mesh(es)
  // leave it empty if you don't want to load anything
  //async load(callback) {
  //}
  // MANDATORY: you must create at least one camera
  async createCamera() {
    // utility function to create UniversalCamera:
    //this.camera = this.universalCamera(new BABYLON.Vector3(0, 2, -10));
    // however, this one uses correct speed calculation:
    this.camera = this.firstPersonCamera(new BABYLON.Vector3(0, 2, -10));
    this.camera.setTarget(new BABYLON.Vector3(0,2,0));
    this.camera.speed = .2;
    // optionally, create third person camera, user can switch any time:
    this.thirdPersonCamera();
    return this.camera;
  }

  // OPTIONAL, RECOMMENDED:
  // start with ground mesh enabled and visible, for reference  
  async createGround() {
    this.ground = BABYLON.MeshBuilder.CreateDisc("ground", {radius:100}, this.scene);
    this.ground.rotation = new BABYLON.Vector3( Math.PI/2, 0, 0 );
    this.ground.position = new BABYLON.Vector3( 0, -0.05, 0 );
    this.ground.parent = this.floorGroup;
    //this.ground.isVisible = false;
    this.ground.checkCollisions = true;
    
    // handy material
    this.ground.material = new BABYLON.GridMaterial("groundMaterial", this.scene);
    this.ground.material.opacity = 0.95;
    this.ground.material.alphaMode = BABYLON.Constants.ALPHA_PREMULTIPLIED;
    return this.ground;
  }
  
  // OPTIONAL, RECOMMENDED:
  // make some light(s), return one
  async createLights() {
    var light = new BABYLON.DirectionalLight("light", new BABYLON.Vector3(-1, -1, 0), this.scene);
    light.intensity = 2;
    var light1 = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 1, 0), this.scene);
    return light1;
  }
  
  // OPTIONAL:
  // create a skybox
  async createSkyBox() {
    var skybox = BABYLON.Mesh.CreateBox("skyBox", 10000, this.scene);
    var skyboxMaterial = new BABYLON.StandardMaterial("skyBox", this.scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.disableLighting = true;
    skybox.material = skyboxMaterial;
    skybox.infiniteDistance = true;
    skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("https://www.babylonjs.com/assets/skybox/TropicalSunnyDay", this.scene);
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
    return skybox;
  }
  
  // OPTIONAL, RECOMMENDED:
  async createPhysics() {
    // default Earth gravity is too high, set your own here
    this.scene.gravity = new BABYLON.Vector3(0,-.05,0);
    super.createPhysics();
  }
  
  // OPTIONAL, RECOMMENDED:  
  // executed once the world is loaded
  loaded(file, mesh) {
    super.loaded(file, mesh);
    // position, rotate, scale and otherwise manipulate world mesh here
    mesh.scaling = new BABYLON.Vector3(2,2,2);
    mesh.rotation = new BABYLON.Vector3(0,Math.PI,0);
  }

  // OPTIONAL, RECOMMENDED:
  // executed once connected to the server and entered the space
  entered( welcome ) {
    // welcome contains client object, but it can always also be accessed from elsewhere
    // at this point this.worldManager is available
    console.log("CONNECTED as "+welcome.client.id, this.worldManager.VRSPACE.me);
    
    // OPTIONAL development helpers
    // event recorder records your events and plays them back
    var recorder = new RecorderUI(this.scene, "Recorder:"+Math.floor(Math.random() * 100));
    recorder.showUI()
  }

}

export const WORLD = new WorldTemplate();