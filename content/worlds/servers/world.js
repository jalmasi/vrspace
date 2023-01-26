import { World } from '../../../babylon/js/vrspace-min.js';

export class ServerWorld extends World {
  async load(callback) {
    // we're not loading any models, only ones sent by the server
    // but we do need to init SEARCH UI
    //this.makeUI();
    // now proceed with normal loading sequence
    if ( callback ) {
      callback(this);
    }
  }

  async createCamera() {
    // utility function to create UniversalCamera:
    this.camera = this.universalCamera(new BABYLON.Vector3(0, 2, -10));
    this.camera.setTarget(new BABYLON.Vector3(0,2,0));
    this.camera.speed = .2;
    return this.camera;
  }

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
  
  async createLights() {
    var light = new BABYLON.DirectionalLight("light", new BABYLON.Vector3(-1, -1, 0), this.scene);
    light.intensity = 2;
    var light1 = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 1, 0), this.scene);
    return light1;
  }
  
  async createSkyBox() {
    var skybox = BABYLON.Mesh.CreateBox("skyBox", 10000, this.scene);
    var skyboxMaterial = new BABYLON.StandardMaterial("skyBox", this.scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.disableLighting = true;
    skybox.material = skyboxMaterial;
    skybox.infiniteDistance = true;
    skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("//www.babylonjs.com/assets/skybox/TropicalSunnyDay", this.scene);
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
    return skybox;
  }
  
  createPhysics() {
    // default Earth gravity is too high, set your own here
    this.scene.gravity = new BABYLON.Vector3(0,-.05,0);
  }
  
  loaded(file, mesh) {
    super.loaded(file, mesh);
  }

  // OPTIONAL, RECOMMENDED:
  // executed once connected to the server and entered the space
  entered( welcome ) {
    this.worldManager.debug = true;
    this.worldManager.VRSPACE.debug = true;
    console.log("CONNECTED as "+welcome.client.id, this.worldManager.VRSPACE.me);
    console.log("Welcome: ", welcome);
  }

}

export const WORLD = new ServerWorld();