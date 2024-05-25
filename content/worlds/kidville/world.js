import { World } from '../../../babylon/js/vrspace-min.js';

export class Kidville extends World {
  
  async createCamera() {
    // Add a camera to the scene and attach it to the scene
    this.camera = this.firstPersonCamera(new BABYLON.Vector3(-97.51, 10, 62.72));
    this.camera.speed = 1;
    this.camera.setTarget(new BABYLON.Vector3(0,0,0));
    //this.thirdPersonCamera(); // too slow
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
    skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("https://www.babylonjs.com/assets/skybox/TropicalSunnyDay", this.scene);
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
    return skybox;
  }
  
  getFloorMeshes() {
    return [this.scene.getMeshByName('Object013')];
  }
  
  isSelectableMesh(mesh) {
    return mesh.name == "node167" || mesh.name == "node3" || mesh.name == "node30" || mesh.name == "node31" || super.isSelectableMesh(mesh);
  }
  
  loaded(file, mesh) {
    super.loaded(file, mesh);
    mesh.scaling = new BABYLON.Vector3(0.5,0.5,0.5);
  }
  
}

export const WORLD = new Kidville();