import { World, Desert } from '../../../babylon/js/vrspace-min.js';

export class PersianCity extends World {
  async createGround() {
    //Ground
    this.ground = BABYLON.Mesh.CreatePlane("ground", 10000.0, this.scene);
    this.ground.material = new BABYLON.StandardMaterial("groundMat", this.scene);
    this.ground.material.diffuseColor = new BABYLON.Color3(.5, 1, .5);
    this.ground.material.backFaceCulling = false;
    this.ground.material.alpha = 0;
    this.ground.position = new BABYLON.Vector3(-40, 0.4, -20);
    this.ground.rotation = new BABYLON.Vector3(Math.PI / 2, 0, 0);
    this.ground.checkCollisions = true;
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
  async createCamera() {
    this.camera = this.firstPersonCamera(new BABYLON.Vector3(60, 23, -54));
    this.camera.setTarget(new BABYLON.Vector3(-50,-10,-50));
    this.camera.speed = 1;
    //this.thirdPersonCamera(); // too slow
  }
  async createLights() {
    // Add lights to the scene
    var light = new BABYLON.DirectionalLight("light", new BABYLON.Vector3(-1, -1, 0), this.scene);
    light.intensity = 2;
    var light1 = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(1, 1, 0), this.scene);
    return light1;
  }

  isSelectableMesh(mesh) {
    return mesh.name == "ground";
  }
  
  getFloorMeshes() {
    return [ this.ground ];
  }

  setMeshCollisions( mesh, state ) {
    if ( mesh.material && ( mesh.material.id.startsWith("LoamWalls") || mesh.material.id.startsWith("Brick") )) {
      mesh.checkCollisions = state;
    }
  }

  loaded( file, mesh ) {
    //super.loaded(file, mesh); // FIXME: calling initXR() twice
    mesh.scaling = new BABYLON.Vector3(0.05,0.05,0.05);
    mesh.position.y = .2;
    // TODO FIXME: remove this node from the model
    this.scene.getNodeByID('node4').setEnabled(false);
  }
  
  registerRenderLoop() {
    // Register a render loop to repeatedly render the scene
    var camera = this.camera;
    this.engine.runRenderLoop(() => {
      if ( this.terrain && this.terrain.isCreated() ) {
        //if ( vrHelper.currentVRCamera.position.x > -150 && vrHelper.currentVRCamera.position.x < 150 && vrHelper.currentVRCamera.position.z >= -150 && vrHelper.currentVRCamera.position.z <= 150 ) {
        //if ( camera.position.x > -150 && camera.position.x < 150 && camera.position.z >= -150 && camera.position.z <= 150 ) {
        if ( camera.globalPosition.x > -150 && camera.globalPosition.x < 150 && camera.globalPosition.z >= -150 && camera.globalPosition.z <= 150 ) {
          this.terrain.setEnabled(false);
        } else {
          this.terrain.setEnabled(true);
        }
      }
      this.scene.render();
    });
  }
  
  createTerrain() {
    this.terrainMaterial = new BABYLON.StandardMaterial("terrainMaterial", this.scene)
    var terrainTexture = new BABYLON.Texture(this.assetPath("textures/LoamWalls0012_2_S_1_1_baseColor.jpeg"), this.scene);
    this.terrainMaterial.ambientTexture = terrainTexture;
    this.terrainMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
    terrainTexture.uScale = 4.0;
    terrainTexture.vScale = terrainTexture.uScale;

    // box to fix ground texture flickering
    this.groundBox = BABYLON.MeshBuilder.CreateBox("groundBox", {width:1000, depth:1000,height:.10}, this.scene); // default box
    this.groundBox.position = new BABYLON.Vector3(-40,0,-20);
    this.groundBox.material = this.terrainMaterial;
    this.groundBox.checkCollisions = true;

    this.terrain = new Desert( this, this.terrainMaterial );
    this.terrain.checkCollisions = true;
    this.terrain.createTerrain(this.scene);
  }
  
  enableBackground(enable) {
    this.groundBox.setEnabled(enable);
  }
  
}

export const WORLD = new PersianCity();