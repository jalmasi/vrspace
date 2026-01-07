import { World, VRSPACEUI, WorldManager, WorldEditorUI, Terrain, Skybox, DefaultHud } from '../../../babylon/js/vrspace-min.js';

export class WorldEditorExample extends World {
  constructor(params) {
    super(params);
    this.gravityEnabled = false;
  }
  async load(callback) {
    // we're not loading any models
    if ( callback ) {
      // make sure to notify avatar-selection
      callback(this);
    }
  }
  async createCamera() {
    this.camera = this.firstPersonCamera(new BABYLON.Vector3(0, 2, -2));
    this.camera.setTarget(new BABYLON.Vector3(0,2,0));
    this.camera.speed = .2;
    this.camera.applyGravity = false;
    this.thirdPersonCamera();
    return this.camera;
  }

  /*
  Replaced with GroundGrid tool
  async createGround() {
    this.ground = BABYLON.MeshBuilder.CreateDisc("groundGrid", {radius:1000}, this.scene);
    this.ground.rotation = new BABYLON.Vector3( Math.PI/2, 0, 0 );
    this.ground.position = new BABYLON.Vector3( 0, -0.05, 0 );
    //this.ground.isVisible = false;
    this.ground.checkCollisions = false;
    
    // handy material
    this.ground.material = new BABYLON.GridMaterial("groundMaterial", this.scene);
    this.ground.material.opacity = 0.999;
    this.ground.material.backFaceCulling = false;
    this.ground.material.alphaMode = BABYLON.Constants.ALPHA_PREMULTIPLIED;
    //this.ground.material.alphaMode = BABYLON.Constants.ALPHA_ONEONE; // also fine
    return this.ground;
  }
  */
  
  async createLights() {
    var light = new BABYLON.DirectionalLight("light", new BABYLON.Vector3(-1, -1, 0), this.scene);
    light.intensity = 2;
    var light1 = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 1, 0), this.scene);
    return light1;
  }
  
  async createSkyBox() {
    return new Skybox(this.scene,VRSPACEUI.contentBase+"/content/skybox/eso_milkyway/milkyway").create();
  }

  async createTerrain() {
    this.terrain = new Terrain(this);
    this.terrain.terrainMaterial = new BABYLON.StandardMaterial("terrainMaterial", this.scene);
    this.terrain.terrainMaterial.specularColor = new BABYLON.Color3(.2, .2, .2);
    this.terrain.terrainMaterial.diffuseColor = new BABYLON.Color3(0, .2, 0);
    this.terrain.terrainMaterial.emissiveColor = new BABYLON.Color3(0, 0, 0);
    this.terrain.init(this.scene);
    this.terrain.mesh().setEnabled(false);
  }
  
  createUI() {
    if ( !DefaultHud.instance ) {
      this.worldEditorUI = new WorldEditorUI(this.scene);
      this.worldEditorUI.show();
      this.worldEditorUI.showGrid();
    }
  }
  
  async entered(welcome) {
    super.entered(welcome);
    // FIXME avatar-selection calls DefaultHud.init() after entered() was called
    if (DefaultHud.instance) {
      setTimeout(()=>{
        DefaultHud.instance.tools();
        DefaultHud.instance.editWorld();
        DefaultHud.instance.worldEditorUI.showGrid();
      },200);
    }
  }
  
  // used in stand-alone mode (i.e. if world is not entered via avatar-selection, but from world.html)  
  connect() {
    this.camera.ellipsoid = new BABYLON.Vector3(.1, .1, .1); // dolphins are not humans
    this.enterWith('https://www.vrspace.org/babylon/dolphin.glb').then(() => {
      // we don't really need to do anything here
      //this.worldManager.debug = true; // multi-user debug info
      //this.worldManager.VRSPACE.debug = true; // network debug info
      //this.worldManager.remoteLogging = true;
    });
  }
  
}

export const WORLD = new WorldEditorExample();