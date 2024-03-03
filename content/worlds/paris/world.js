import { World } from '../../../babylon/js/vrspace-min.js';

export class Paris extends World {
  async createCamera() {
    this.camera = this.firstPersonCamera(new BABYLON.Vector3(61.153, 10.676, -87.172));
    this.camera.setTarget(new BABYLON.Vector3(0,-10,0));
    this.camera.speed = 0.5;
    //this.thirdPersonCamera(); // too slow
  }
  async createLights() {
    // Add lights to the scene
    var light1 = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(1, 1, 0), this.scene);
    var light2 = new BABYLON.PointLight("light2", new BABYLON.Vector3(1, 3, -3), this.scene);
    return light2;
  }
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
  
  setMeshCollisions( mesh, state ) {
    if ( mesh.material && mesh.material.name != 'SidewalkTree' ) {
      mesh.checkCollisions = state;
    }
  }
  
  loaded(file, mesh) {
    //super.loaded(file, mesh); // FIXME: calling initXR() twice
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