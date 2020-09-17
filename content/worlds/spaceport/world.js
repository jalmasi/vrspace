import { World } from '../../../babylon/vrspace-ui.js';

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
    // Add a camera to the scene and attach it to the canvas
    this.camera = new BABYLON.UniversalCamera("UniversalCamera", new BABYLON.Vector3(-280, 2.5, -260), this.scene);
    this.camera.maxZ = 100000;
    this.camera.minZ = 0;
    this.camera.setTarget(new BABYLON.Vector3(0,2,0));
    // not required, world.init() does that
    //this.camera.attachControl(canvas, true);
    this.camera.applyGravity = true;
    this.camera.speed = 0.5
    //Set the ellipsoid around the camera (e.g. your player's size)
    this.camera.ellipsoid = new BABYLON.Vector3(.5, 1, .5);
    //camera.ellipsoidOffset = -0.2
    this.camera.checkCollisions = true;
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
  
  collisions(state) {
    if ( this.sceneMeshes ) {
      for ( var i=0; i<this.sceneMeshes.length; i++ ) {
        if ( this.sceneMeshes[i].name != 'node10' ) {
          this.sceneMeshes[i].checkCollisions = state;
        }
      }
    }
  }
  
  loaded( file, mesh ) {
    mesh.scaling = new BABYLON.Vector3(0.005,0.005,0.005);
    mesh.position.y = -107.3;
  }
}

export const WORLD = new Spaceport();