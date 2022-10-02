import { World, VRSPACEUI, Terrain } from './js/vrspace-min.js';

export class TerrainEditorExample extends World {
  constructor(params) {
    super(params);
    this.lastIndex = -1;
  }
  async load() {
    // we're not loading any models
    // but we're displaying UI instead
    this.connect();
  }
  async createCamera() {
    this.camera = this.universalCamera(new BABYLON.Vector3(0, 2, -2));
    this.camera.ellipsoid = new BABYLON.Vector3(.1, .1, .1); // dolphins are not humans
    this.camera.setTarget(new BABYLON.Vector3(0,2,0));
    this.camera.speed = .2;
    this.camera.applyGravity = false;
    return this.camera;
  }

  async createGround() {
    // no ground
  }
  
  async createLights() {
    var light = new BABYLON.DirectionalLight("light", new BABYLON.Vector3(-1, -1, 0), this.scene);
    light.intensity = .3;
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
    skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("/content/skybox/eso_milkyway/milkyway", this.scene);
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
    return skybox;
  }

  createTerrain() {
    this.terrain = new Terrain();

    this.terrain.terrainMaterial = new BABYLON.StandardMaterial("terrainMaterial", this.scene);
    //var terrainTexture = new BABYLON.Texture(this.assetPath("textures/LoamWalls0012_2_S_1_1_baseColor.jpeg"), this.scene);
    //this.terrain.terrainMaterial.ambientTexture = terrainTexture;
    this.terrain.terrainMaterial.specularColor = new BABYLON.Color3(.3, .3, .3);
    this.terrain.terrainMaterial.diffuseColor = new BABYLON.Color3(0, .5, 0);
    this.terrain.terrainMaterial.emissiveColor = new BABYLON.Color3(0, 0, 0);
    //this.terrain.terrainMaterial.wireframe = true;
    //terrainTexture.uScale = 4.0;
    //terrainTexture.vScale = terrainTexture.uScale;

    this.terrain.init(this.scene);
    
    this.observer = this.scene.onPointerObservable.add((pointerInfo) => {
      switch (pointerInfo.type) {
        case BABYLON.PointerEventTypes.POINTERDOWN:
          if(pointerInfo.pickInfo.hit && pointerInfo.pickInfo.pickedMesh == this.terrain.mesh()) {
            this.lastIndex = this.updatePicked(pointerInfo.pickInfo);
            this.terrain.mesh().enablePointerMoveEvents = true;
          }
          break;
        case BABYLON.PointerEventTypes.POINTERUP:
          this.lastIndex = -1;
          this.terrain.mesh().enablePointerMoveEvents = false;
          break;
        case BABYLON.PointerEventTypes.POINTERMOVE:
          if ( this.lastIndex >= 0 && pointerInfo.pickInfo.pickedMesh == this.terrain.mesh() ) {
            var newIndex = this.terrain.findIndex(pointerInfo.pickInfo.pickedPoint.x,pointerInfo.pickInfo.pickedPoint.z);
            if ( newIndex != this.lastIndex ) {
              this.lastIndex = newIndex;
              this.updatePicked(pointerInfo.pickInfo);
            }
          }
          break;
        }
    });
    
    this.raiseButton = VRSPACEUI.hud.addButton("Raise", "https://www.babylonjs-playground.com/textures/icons/Upload.png"); // FIXME: cdn
    this.digButton = VRSPACEUI.hud.addButton("Dig", "https://www.babylonjs-playground.com/textures/icons/Download.png"); // FIXME: cdn
    this.raiseButton.onPointerDownObservable.add( () => {
      this.heightIncrement = 1;
      this.digButton.isVisible = !this.digButton.isVisible;
      this.editing = !this.raiseButton.isVisible || !this.digButton.isVisible
      this.terrain.terrainMaterial.wireframe = this.editing;
    });
    this.digButton.onPointerDownObservable.add( () => {
      this.heightIncrement = -1;
      this.raiseButton.isVisible = !this.raiseButton.isVisible;
      this.editing = !this.raiseButton.isVisible || !this.digButton.isVisible
      this.terrain.terrainMaterial.wireframe = this.editing;
    });
    
    
  }
  
  updatePicked( pickInfo ) {
    var ret = -1;
    //console.log(pickInfo);
    //console.log(pickInfo.pickedPoint);
    var x = pickInfo.pickedPoint.x;
    var z = pickInfo.pickedPoint.z;
    //var y = this.terrain.terrain.getHeightFromMap(x, z);
    //console.log(x,y,z);
    //var sphere = BABYLON.MeshBuilder.CreateSphere("point", {diameter:0.1}, this.scene);
    //sphere.position = new BABYLON.Vector3(x,y,z);
    if ( this.editing ) {
      ret = this.terrain.raise(x,z,this.heightIncrement);
    }
    return ret;
  }
    
  connect() {
    //new WorldManager(this);
    //this.worldManager.debug = true; // multi-user debug info
    //this.worldManager.VRSPACE.debug = true; // network debug info
    //this.worldManager.enter({mesh:'//www.vrspace.org/babylon/dolphin.glb'}).then(() => this.worldEditor = new WorldEditor(this, this.fileInputElement));
  }
  
}

export const WORLD = new TerrainEditorExample();