import { VRSPACEUI, World } from './vrspace-ui.js';
import { Avatar } from './avatar.js';

export class Avatars extends World {
  async createScene(engine) {
    // Create the scene space
    var scene = new BABYLON.Scene(engine);
    scene.gravity = new BABYLON.Vector3(0, -9.81, 0);

    // Add a camera to the scene and attach it to the canvas
    //var camera = new BABYLON.UniversalCamera("UniversalCamera", new BABYLON.Vector3(0, 2, -10), scene);
    camera = new BABYLON.ArcRotateCamera("Camera", 0, 2, -3, new BABYLON.Vector3(0, 1, 0), scene);
    camera.setPosition(new BABYLON.Vector3(0, 2, -3));
    //var camera = new BABYLON.FlyCamera("FlyCamera", new BABYLON.Vector3(0, 5, -10), scene);
    camera.maxZ = 100000;
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.attachControl(canvas, true);
    camera.applyGravity = true;
    //Set the ellipsoid around the camera (e.g. your player's size)
    //camera.ellipsoid = new BABYLON.Vector3(.5, 1.8, .5);
    //camera.ellipsoidOffset = -0.2
    scene.collisionsEnabled = true;
    camera.checkCollisions = true;

    // Add lights to the scene
    var light1 = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(1, 1, 0), scene);
    var light2 = new BABYLON.PointLight("light2", new BABYLON.Vector3(1, 3, -3), scene);

    // Shadows
    shadowGenerator = new BABYLON.ShadowGenerator(1024, light2);
    shadowGenerator.useBlurExponentialShadowMap = true;
    shadowGenerator.blurKernel = 32;

    // Fog
    //scene.fogMode = BABYLON.Scene.FOGMODE_EXP;

    // Skybox
    //var envTexture = new BABYLON.CubeTexture("skybox/horizon_4", scene);
    //var envTexture = new BABYLON.CubeTexture("mp_drakeq/drakeq", scene);
    //scene.createDefaultSkybox(envTexture, true, 1000);

    var skybox = BABYLON.Mesh.CreateBox("skyBox", 100.0, scene);
    var skyboxMaterial = new BABYLON.StandardMaterial("skyBox", scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.disableLighting = true;
    skybox.material = skyboxMaterial;
    skybox.infiniteDistance = true;
    skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("../content/skybox/mp_drakeq/drakeq", scene);
    //skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("skybox/horizon_4", scene);
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;

    //Ground
    var ground = BABYLON.Mesh.CreatePlane("ground", 200.0, scene);
    ground.material = new BABYLON.StandardMaterial("groundMat", scene);
    ground.material.diffuseColor = new BABYLON.Color3(.5, 1, .5);
    ground.material.backFaceCulling = false;
    ground.material.alpha = 0.5;
    //ground.position = new BABYLON.Vector3(0, -1, 0);
    ground.rotation = new BABYLON.Vector3(Math.PI / 2, 0, 0);
    ground.checkCollisions = true;
    ground.receiveShadows = true;

    return scene;
  }
  
  load( name, file ) {
  }

}

export { VRSPACEUI };
export const WORLD = new Avatars();
