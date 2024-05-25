import { World, Desert } from '../../../babylon/js/vrspace-min.js';

//collisions:
//group296_sand_houses:lambert6_0 - ground
//group_296_lambert52,53,(57),61,(62),66
//group_296_lambert:51_0,54,64,65,(77),80,83,88-fountain,
var collisionObjects = [
//"group296_sand_houses:lambert6_0", // we have own ground, not required
"group296_sand_houses:lambert51_0",
"group296_sand_houses:lambert54_0",
"group296_sand_houses:lambert64_0",
"group296_sand_houses:lambert65_0",
"group296_sand_houses:lambert77_0", // optional, high
"group296_sand_houses:lambert80_0",
"group296_sand_houses:lambert83_0",
"group296_sand_houses:lambert88_0", // fountain
"group296_lambert52_0",
"group296_lambert53_0",
"group296_lambert57_0",  // optional, high
"group296_lambert61_0",
"group296_lambert62_0",  // optional, high
"group296_lambert66_0"
];

export class Aladinville extends World {
  async createGround() {
    var ground = BABYLON.Mesh.CreatePlane("ground", 10000.0, this.scene);
    ground.material = new BABYLON.StandardMaterial("groundMat", this.scene);
    ground.material.diffuseColor = new BABYLON.Color3(.5, 1, .5);
    ground.material.backFaceCulling = false;
    ground.material.alpha = 0;
    ground.position = new BABYLON.Vector3(0, 0.7, 0);
    ground.rotation = new BABYLON.Vector3(Math.PI / 2, 0, 0);
    ground.checkCollisions = true;
    return ground;
  }
  async createCamera() {
    this.camera = this.firstPersonCamera(new BABYLON.Vector3(-8, 10, -60));
    this.camera.setTarget(new BABYLON.Vector3(0,10,0));
    this.camera.speed = 0.5;
    this.thirdPersonCamera();
  }
  
  async createLights() {
    // Add lights to the scene
    var light = new BABYLON.DirectionalLight("light", new BABYLON.Vector3(-1, -1, 0), this.scene);
    light.intensity = 2;
    var light1 = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(1, 1, 0), this.scene);
    return light1;
  }
  
  async createSkyBox() {
    var skybox = BABYLON.Mesh.CreateBox("skyBox", 10000, this.scene);
    var skyboxMaterial = new BABYLON.StandardMaterial("skyBox", this.scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.disableLighting = true;
    skybox.material = skyboxMaterial;
    skybox.infiniteDistance = true;
    skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture(this.assetPath("../../skybox/hw_sahara/sahara"), this.scene);
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
    return skybox;
  }

  getFloorMeshes() {
    return [this.ground];
  }
  
  isSelectableMesh(mesh) {
    return mesh.name == "ground" || super.isSelectableMesh(mesh);
  }
  
  setMeshCollisions( mesh, state ) {
    if ( collisionObjects.includes(mesh.id) ) {
      mesh.checkCollisions = state;
    }
  }

  loaded( file, mesh ) {
    console.log('Loaded '+file);
    mesh.scaling = new BABYLON.Vector3(2,2,2);
    
    // material - sand_houseslambert54 - need depth pre-pass
    var material = this.scene.getMaterialByID("sand_houseslambert54");
    material.needDepthPrePass = true;
    // missing materials on towers 57 62, gates 66
    var marbleMaterial = new BABYLON.StandardMaterial("marble", this.scene);
    var marbleTexture = new BABYLON.Texture(this.assetPath("textures/sand_houseslambert12_baseColor.png"), this.scene);
    marbleMaterial.ambientTexture = marbleTexture;
    var tower1 = this.scene.getMeshByID("group296_lambert57_0");
    tower1.material = marbleMaterial;
    var tower2 = this.scene.getMeshByID("group296_lambert62_0");
    tower2.material = marbleMaterial;
    var gates = this.scene.getMeshByID("group296_lambert66_0");
    gates.material = marbleMaterial;
    
    //super.loaded(file, mesh); // FIXME: calling initXR() twice
  }
  
  registerRenderLoop() {
    var scene = this.scene;
    var camera = this.camera;
    // Register a render loop to repeatedly render the scene
    this.engine.runRenderLoop(() => {
      if ( this.terrain && this.terrain.isCreated()) {
        if ( camera.globalPosition.x > -20 && camera.globalPosition.x < 20 && camera.globalPosition.z >= -20 && camera.globalPosition.z <= 25 ) {
          this.terrain.setEnabled(false);
        } else {
          this.terrain.setEnabled(true);
        }
      }
      if ( scene ) {
        scene.render();
      }
    });
  }
  
  createTerrain() {
    this.terrainMaterial = new BABYLON.StandardMaterial("terrainMaterial", this.scene)
    var terrainTexture = new BABYLON.Texture(this.assetPath("textures/sand_houseslambert12_baseColor.png"), this.scene);
    this.terrainMaterial.ambientTexture = terrainTexture;
    this.terrainMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
    terrainTexture.uScale = 1;
    terrainTexture.vScale = terrainTexture.uScale;
    
    this.terrain = new Desert( this, this.terrainMaterial );
    this.terrain.checkCollisions = false;
    this.terrain.createTerrain();
  }
}



export const WORLD = new Aladinville();