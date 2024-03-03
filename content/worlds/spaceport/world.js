import { World } from '../../../babylon/js/vrspace-min.js';

export class Spaceport extends World {

  async createGround() {
    var ground = BABYLON.Mesh.CreatePlane("ground", 10000.0, this.scene);
    ground.rotation = new BABYLON.Vector3(Math.PI / 2, 0, 0);
    ground.checkCollisions = true;
    ground.material = new BABYLON.StandardMaterial("groundMat", this.scene);
    ground.material.diffuseColor = new BABYLON.Color3(.5, 1, .5);
    ground.material.backFaceCulling = false;
    ground.material.alpha = 0;
    return ground;
  }

  async createCamera() {
    this.camera = this.firstPersonCamera(new BABYLON.Vector3(-280, 2.5, -260));
    this.camera.setTarget(new BABYLON.Vector3(0,2,0));
    //this.thirdPersonCamera(); // too slow
  }

  async createLights() {
    // Add lights to the scene
    var light = new BABYLON.DirectionalLight("light", new BABYLON.Vector3(1, -1, 1), this.scene);
    light.intensity = 1;
    var light1 = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 1, 0), this.scene);
    light1.intensity = .5;
  }

  async createSkyBox() {
    var skybox = BABYLON.Mesh.CreateBox("skyBox", 10000, this.scene);
    var skyboxMaterial = new BABYLON.StandardMaterial("skyBox", this.scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.disableLighting = true;
    skybox.material = skyboxMaterial;
    skybox.infiniteDistance = true;
    skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture(this.assetPath("../../skybox/mp_orbital/orbital-element"), this.scene);
    //skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("skybox/horizon_4", this.scene);
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
    return skybox;
  }

  getFloorMeshes() {
    return [this.scene.getMeshByName('node9'), this.scene.getMeshByName('node5')];
  }
  
  isSelectableMesh( mesh ) {
    return mesh.name == "node9";
  }
  
  setMeshCollisions( mesh, state ) {
    if ( mesh.name != 'node10' ) {
      mesh.checkCollisions = state;
    }
  }
  
  loaded( file, mesh ) {
    mesh.scaling = new BABYLON.Vector3(0.005,0.005,0.005);
    mesh.position.y = -107.3;
    //super.loaded(file, mesh); // FIXME: calling initXR() twice
    //VRSPACEUI.optimizeScene(this.scene);
  }
}

export const WORLD = new Spaceport();