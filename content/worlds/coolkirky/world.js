import { World } from '../../../babylon/vrspace-ui.js';

export class Farm extends World {
  constructor() {
    super();
    this.file = 'coolkirky.gltf';
  }
  async createCamera() {
    // Add a camera to the scene and attach it to the scene
    this.camera = this.universalCamera(new BABYLON.Vector3(0, 300, 0));
    this.camera.setTarget(new BABYLON.Vector3(0,300,10));
    this.camera.applyGravity = false;
    this.camera.speed = .5;
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
    this.scene.gravity = new BABYLON.Vector3( 0, -.2, 0 );
  }  
  loaded(file, mesh) {
    //super.loaded(file, mesh); // FIXME: calling initXR() twice
    //mesh.scaling = new BABYLON.Vector3(0.1,0.1,0.1);
  }
  
}

export const WORLD = new Farm();
