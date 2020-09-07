import { World } from '../../../babylon/vrspace-ui.js';

export class Spaceport extends World {
  async createScene(engine) {
    // Create the scene space
    var scene = new BABYLON.Scene(engine);
    //scene.gravity = new BABYLON.Vector3(0, -9.81, 0);
    scene.collisionsEnabled = true;

    var ground = BABYLON.Mesh.CreatePlane("ground", 10000.0, scene);
    ground.rotation = new BABYLON.Vector3(Math.PI / 2, 0, 0);
    ground.checkCollisions = true;
    ground.material = new BABYLON.StandardMaterial("groundMat", scene);
    ground.material.diffuseColor = new BABYLON.Color3(.5, 1, .5);
    ground.material.backFaceCulling = false;
    ground.material.alpha = 0;

    // Add a camera to the scene and attach it to the canvas
    this.camera = new BABYLON.UniversalCamera("UniversalCamera", new BABYLON.Vector3(-280, 2.5, -260), scene);
    this.camera.maxZ = 100000;
    this.camera.minZ = 0;
    this.camera.setTarget(new BABYLON.Vector3(0,2,0));
    this.camera.attachControl(canvas, true);
    this.camera.applyGravity = true;
    this.camera.speed = 0.5
    //Set the ellipsoid around the camera (e.g. your player's size)
    this.camera.ellipsoid = new BABYLON.Vector3(.5, 1, .5);
    //camera.ellipsoidOffset = -0.2
    this.camera.checkCollisions = true;

    // Add lights to the scene
    var light = new BABYLON.DirectionalLight("light", new BABYLON.Vector3(1, -1, 1), scene);
    light.intensity = 1;
    var light1 = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 1, 0), scene);
    light1.intensity = .5;

    var skybox = BABYLON.Mesh.CreateBox("skyBox", 10000, scene);
    var skyboxMaterial = new BABYLON.StandardMaterial("skyBox", scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.disableLighting = true;
    skybox.material = skyboxMaterial;
    skybox.infiniteDistance = true;
    skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("../../skybox/mp_orbital/orbital-element", scene);
    //skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("skybox/horizon_4", scene);
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;

    return scene;
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
    mesh.position.y = -108;
  }
}

export const WORLD = new Spaceport();