import { World, VRSPACEUI, WorldManager, WorldEditor, Terrain, TerrainEditor, SkyboxSelector } from '../../../babylon/js/vrspace-min.js';

export class WorldEditorExample extends World {
  constructor(params) {
    super(params);
    this.gravityEnabled = false;
  }
  async load(callback) {
    // we're not loading any models
    // but we're displaying UI instead
    //this.makeUI();
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
    skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture(VRSPACEUI.contentBase+"/content/skybox/eso_milkyway/milkyway", this.scene);
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
    return skybox;
  }

  async createTerrain() {
    this.terrain = new Terrain(this);
    this.terrain.terrainMaterial = new BABYLON.StandardMaterial("terrainMaterial", this.scene);
    this.terrain.terrainMaterial.specularColor = new BABYLON.Color3(.2, .2, .2);
    this.terrain.terrainMaterial.diffuseColor = new BABYLON.Color3(0, .2, 0);
    this.terrain.terrainMaterial.emissiveColor = new BABYLON.Color3(0, 0, 0);
    this.terrain.init(this.scene);
    this.terrain.mesh().setEnabled(false);
    this.terrainEditor = new TerrainEditor(this);
  }
  
  createUI() {
    this.contentBase=VRSPACEUI.contentBase;
    this.worldEdit = VRSPACEUI.hud.addButton("World", this.contentBase+"/content/icons/world-edit.png", (b,i)=>this.editWorld(b,i));
    this.terrainEdit = VRSPACEUI.hud.addButton("Terrain", this.contentBase+"/content/icons/terrain.png", (b,i)=>this.editTerrain(b,i));
    this.skyboxEdit = VRSPACEUI.hud.addButton("Skybox", this.contentBase+"/content/icons/sky.png", (b,i)=>this.editSkybox(b,i));
    this.terrainEdit.isVisible = !this.inAR;
    this.skyboxEdit.isVisible = !this.inAR;
    VRSPACEUI.hud.enableSpeech(true);
  }
  
  enterXR() {
    super.enterXR();
    this.terrainEdit.isVisible = !this.inAR;
    this.skyboxEdit.isVisible = !this.inAR;
  }
  
  exitXR() {
    super.exitXR();
    if ( !this.editing ) {
      this.terrainEdit.isVisible = true;
      this.skyboxEdit.isVisible = true;    
    }
  }

  // ground is not selectable while editing terrain, but otherwise must be to allow teleportation
  getFloorMeshes() {
    if ( this.editing ) {
      return [];
    }
    return [this.ground];
  }
  
  editWorld(button, vector3WithInfo) {
    this.editing = !this.editing;
    console.log("World editor active:"+this.editing);
    if ( this.editing ) {
      VRSPACEUI.hud.showButtons(!this.editing, button);
      VRSPACEUI.hud.newRow();
      this.worldEditor = new WorldEditor(this, this.fileInputElement);
    } else {
      while ( VRSPACEUI.hud.rows.length > 1 ) {
        VRSPACEUI.hud.clearRow();
      }
      this.worldEditor.dispose();
      VRSPACEUI.hud.showButtons(!this.editing, button);
    }
  }
  
  editTerrain(button, vector3WithInfo) {
    this.editing = !this.editing;
    console.log("Terrain editor active:"+this.editing);
    if ( this.editing ) {
      this.terrain.mesh().setEnabled(true);
      VRSPACEUI.hud.showButtons(!this.editing, button);
      VRSPACEUI.hud.newRow();
      this.terrainEditor.edit();
    } else {
      VRSPACEUI.hud.clearRow();
      //this.terrainEditor.dispose();
      VRSPACEUI.hud.showButtons(!this.editing, button);
    }
  }
  
  editSkybox(button, vector3WithInfo) {
    this.editing = !this.editing;
    console.log("Skybox editor active:"+this.editing);
    if ( this.editing ) {
      VRSPACEUI.hud.showButtons(!this.editing, button);
      VRSPACEUI.hud.newRow();
      if ( ! this.skyboxSelector ) {
        this.skyboxSelector = new SkyboxSelector(this);
      }
      this.skyboxSelector.show();
      VRSPACEUI.hud.enableSpeech(true);
    } else {
      VRSPACEUI.hud.clearRow();
      this.skyboxSelector.hide();
      VRSPACEUI.hud.showButtons(!this.editing, button);
    }
  }

  // used in stand-alone mode (i.e. if world is not entered via avatar-selection, but from world.html)  
  connect() {
    new WorldManager(this);
    //this.worldManager.debug = true; // multi-user debug info
    //this.worldManager.VRSPACE.debug = true; // network debug info
    //this.worldManager.remoteLogging = true;
    this.camera.ellipsoid = new BABYLON.Vector3(.1, .1, .1); // dolphins are not humans
    this.worldManager.enter({mesh:'//www.vrspace.org/babylon/dolphin.glb'}).then(() => {
      // we don't really need to do anything here
    });
  }
  
  search( what, flags ) {
    this.worldEditor.search( what, flags );
  }
}

export const WORLD = new WorldEditorExample();