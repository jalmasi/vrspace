import { World, Terrain, TerrainEditor, WorldManager } from './js/vrspace-min.js';

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
    this.terrainEditor = new TerrainEditor(this);
    this.terrainEditor.edit();
  }
  
  connect() {
    new WorldManager(this);
    this.worldManager.debug = true; // multi-user debug info
    this.worldManager.VRSPACE.debug = true; // network debug info
    this.worldManager.VRSPACE.addSceneListener(e=>this.sceneChanged(e));
    this.worldManager.enter({mesh:'//www.vrspace.org/babylon/dolphin.glb'}).then(
      //() => this.worldEditor = new WorldEditor(this, this.fileInputElement)
    );
  }
  // TODO move network functions to terrain editor
  sceneChanged(e) {
    if ( e.added && e.added.className == "Terrain") {
      console.log("Terrain added", e.added);
      this.terrainEditor.sharedTerrain = e.added;
      e.added.addListener((obj,change)=>this.terrainChanged(change));
    }
  }
  terrainChanged(e) {
    console.log("Terrain changed", e);
    if ( e.change ) {
      this.terrainEditor.terrain.update(e.change.index, e.change.point.x, e.change.point.y, e.change.point.z);
      this.terrainEditor.terrain.refresh();
    } else {
      for ( const color in e ) {
        // e.g. emissiveColor, diffuseColor, specularColor
        console.log(color + "="+e[color]);
        this.terrainEditor.terrain.terrainMaterial[color] = new BABYLON.Color3(e[color].r, e[color].g, e[color].b);
      }
    }
  }
  entered(welcome) {
    console.log(welcome);
    if ( welcome.permanents ) {
      console.log( "Terrain exists" );
      welcome.permanents.forEach( obj => {
        if (obj.Terrain) {
          this.terrainEditor.sharedTerrain = obj.Terrain;
          if ( obj.Terrain.points ) {
            obj.Terrain.points.forEach( p => {
              this.terrainEditor.terrain.update(p.index, p.x, p.y, p.z);
            });
            this.terrainEditor.terrain.refresh();
          }
          if ( obj.Terrain.specularColor ) {
            this.terrain.terrainMaterial.specularColor = new BABYLON.Color3(obj.Terrain.specularColor.r, obj.Terrain.specularColor.g, obj.Terrain.specularColor.b)
          }
          if ( obj.Terrain.diffuseColor ) {
            this.terrain.terrainMaterial.diffuseColor = new BABYLON.Color3(obj.Terrain.diffuseColor.r, obj.Terrain.diffuseColor.g, obj.Terrain.diffuseColor.b)
          }
          if ( obj.Terrain.emissiveColor ) {
            this.terrain.terrainMaterial.emissiveColor = new BABYLON.Color3(obj.Terrain.emissiveColor.r, obj.Terrain.emissiveColor.g, obj.Terrain.emissiveColor.b)
          }
        };
      });
    } else {
      console.log("Creating new terrain");
      this.createSharedTerrain();
    }
  }
  createSharedTerrain() {
    var object = {
      permanent: true,
      active:true,
      specularColor:this.terrain.terrainMaterial.specularColor,
      diffuseColor:this.terrain.terrainMaterial.diffuseColor,
      emissiveColor:this.terrain.terrainMaterial.emissiveColor
    };
    this.worldManager.VRSPACE.createSharedObject(object, (obj)=>{
      console.log("Created new Terrain", obj);
      this.terrainEditor.sharedTerrain = obj;
    }, "Terrain");
  }

}

export const WORLD = new TerrainEditorExample();