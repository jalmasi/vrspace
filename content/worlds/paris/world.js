import { World } from '../../../babylon/vrspace-ui.js';

export class Paris extends World {
  async createCamera() {
    // Add a camera to the scene and attach it to the canvas
    this.camera = new BABYLON.UniversalCamera("UniversalCamera", new BABYLON.Vector3(61.153, 10.676, -87.172), scene);
    this.camera.maxZ = 100000;
    this.camera.minZ = 0;
    this.camera.setTarget(new BABYLON.Vector3(0,-10,0));
    this.camera.attachControl(canvas, true);
    this.camera.applyGravity = true;
    this.camera.speed = 1;
    //Set the ellipsoid around the camera (e.g. your player's size)
    this.camera.ellipsoid = new BABYLON.Vector3(.5, 1, .5);
    //camera.ellipsoidOffset = -0.2
    this.camera.checkCollisions = true;
  }
  async createLights() {
    // Add lights to the scene
    var light1 = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(1, 1, 0), scene);
    var light2 = new BABYLON.PointLight("light2", new BABYLON.Vector3(1, 3, -3), scene);
    return light2;
  }
  async createSkyBox() {
    var skybox = BABYLON.Mesh.CreateBox("skyBox", 10000, scene);
    var skyboxMaterial = new BABYLON.StandardMaterial("skyBox", scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.disableLighting = true;
    skybox.material = skyboxMaterial;
    skybox.infiniteDistance = true;
    skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("//www.babylonjs.com/assets/skybox/TropicalSunnyDay", scene);
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
    return skybox;
  }
  
  getFloorMeshes() {
    return [
      this.scene.getMeshByName('node167'),
      this.scene.getMeshByName('node3'),
      this.scene.getMeshByName('node30'),
      this.scene.getMeshByName('node31')
    ];
  }
  
  isSelectableMesh(mesh) {
    return mesh.name == "node167" || mesh.name == "node3" || mesh.name == "node30" || mesh.name == "node31";
  }
  
  collisions(state) {
    if ( this.sceneMeshes ) {
      for ( var i=0; i<this.sceneMeshes.length; i++ ) {
        if ( this.sceneMeshes[i].material && this.sceneMeshes[i].material.name != 'SidewalkTree' ) {
          this.sceneMeshes[i].checkCollisions = state;
        }
      }
    }
  }

  loaded(file, mesh) {
    for ( var i = 0; i < this.container.materials.length; i++ ) {
      if ( this.container.materials[i].name == 'SidewalkTree' ) {
        // tree
        //container.materials[i].opacityTexture = container.materials[i].albedoTexture;
        this.container.materials[i].transparencyMode = BABYLON.ShaderMaterial.MATERIAL_ALPHATESTANDBLEND;
      } else if ( this.container.materials[i].name == 'FacadeSets_79_103' ) {
        // street lamp
        this.container.materials[i].transparencyMode = BABYLON.ShaderMaterial.MATERIAL_ALPHATESTANDBLEND;
      }
    }
    mesh.position.y = -74;
  }
  
}

export const WORLD = new Paris();