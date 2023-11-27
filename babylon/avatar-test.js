import { VRSPACEUI, World } from './js/vrspace-min.js';
//TODO refactor this
export class Avatars extends World {
  async createScene(engine) {
    // Create the scene space
    this.scene = new BABYLON.Scene(engine);
    this.scene.gravity = new BABYLON.Vector3(0, -9.81, 0);

    // Add a camera to the scene and attach it to the canvas
    //var camera = new BABYLON.UniversalCamera("UniversalCamera", new BABYLON.Vector3(0, 2, -10), this.scene);
    this.camera = new BABYLON.ArcRotateCamera("Camera", -Math.PI/2, Math.PI/3, 4, new BABYLON.Vector3(0, 1, 0), this.scene);
    //var camera = new BABYLON.FlyCamera("FlyCamera", new BABYLON.Vector3(0, 5, -10), this.scene);
    this.camera.maxZ = 100000;
    this.camera.attachControl(canvas, true);
    this.camera.upperRadiusLimit = 30;
    //this.camera.applyGravity = true;
    //Set the ellipsoid around the camera (e.g. your player's size)
    //camera.ellipsoid = new BABYLON.Vector3(.5, 1.8, .5);
    //camera.ellipsoidOffset = -0.2
    this.scene.collisionsEnabled = true;
    this.camera.checkCollisions = true;

    let pos = new BABYLON.Vector3(0,1.8,-.2);
    this.camera1p = this.universalCamera(pos, "1st Person Camera");
    this.camera1p.setTarget(new BABYLON.Vector3(0,1.8,-10));
    this.thirdPersonCamera(this.camera1p);
    
    // Add lights to the scene
    var light1 = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(1, 1, 0), this.scene);
    var light2 = new BABYLON.PointLight("light2", new BABYLON.Vector3(1, 3, -3), this.scene);

    // Shadows
    shadowGenerator = new BABYLON.ShadowGenerator(1024, light2);
    shadowGenerator.useBlurExponentialShadowMap = true;
    shadowGenerator.blurKernel = 32;

    // Fog
    //this.scene.fogMode = BABYLON.Scene.FOGMODE_EXP;

    // Skybox
    //var envTexture = new BABYLON.CubeTexture("skybox/horizon_4", this.scene);
    //var envTexture = new BABYLON.CubeTexture("mp_drakeq/drakeq", this.scene);
    //this.scene.createDefaultSkybox(envTexture, true, 1000);

    var skybox = BABYLON.Mesh.CreateBox("skyBox", 100.0, this.scene);
    var skyboxMaterial = new BABYLON.StandardMaterial("skyBox", this.scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.disableLighting = true;
    skybox.material = skyboxMaterial;
    skybox.infiniteDistance = true;
    skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("../content/skybox/mp_drakeq/drakeq", this.scene);
    //skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("skybox/horizon_4", this.scene);
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;

    //Ground
    var ground = BABYLON.Mesh.CreatePlane("ground", 200.0, this.scene);
    ground.material = new BABYLON.StandardMaterial("groundMat", this.scene);
    ground.material.diffuseColor = new BABYLON.Color3(.5, 1, .5);
    ground.material.backFaceCulling = false;
    ground.material.alpha = 0.5;
    //ground.position = new BABYLON.Vector3(0, -1, 0);
    ground.rotation = new BABYLON.Vector3(Math.PI / 2, 0, 0);
    ground.checkCollisions = true;
    ground.receiveShadows = true;
    this.ground = ground;

    return this.scene;
  }
  
  load( name, file ) {
  }

}

export { VRSPACEUI };
export const WORLD = new Avatars();
