import { World, WorldManager, ChatLog, ImageArea, Whiteboard } from './js/vrspace-min.js';

export class ImageAreaWorld extends World {
  async load(callback) {
    // we're not loading any models
    // but we're displaying UI instead
    if ( callback ) {
      // make sure to notify avatar-selection
      callback(this);
    }
  }
  async createCamera() {
    this.camera = this.universalCamera(new BABYLON.Vector3(0, 2, -2));
    this.camera.ellipsoid = new BABYLON.Vector3(.1, .1, .1); // dolphins are not humans
    this.camera.setTarget(new BABYLON.Vector3(0,2,0));
    this.camera.speed = .2;
    this.camera.applyGravity = false;
    return this.camera;
  }

  async createGround() {
    this.ground = BABYLON.MeshBuilder.CreateDisc("ground", {radius:1000}, this.scene);
    this.ground.rotation = new BABYLON.Vector3( Math.PI/2, 0, 0 );
    this.ground.position = new BABYLON.Vector3( 0, -0.05, 0 );
    this.ground.parent = this.floorGroup;
    //this.ground.isVisible = false;
    this.ground.checkCollisions = false;
    
    // handy material
    this.ground.material = new BABYLON.GridMaterial("groundMaterial", this.scene);
    this.ground.material.opacity = 0.999;
    this.ground.material.backFaceCulling = false;
    this.ground.material.alphaMode = BABYLON.Constants.ALPHA_PREMULTIPLIED;
    //this.ground.material.alphaMode = BABYLON.Constants.ALPHA_ONEONE; // also fine
    return this.ground;
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
    skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("/content/skybox/eso_milkyway/milkyway", this.scene);
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
    return skybox;
  }
  
  createUI() {
    this.initXR();
    // chatlog test
    let chatLog = new ChatLog(this.scene);
    chatLog.show();
    
    chatLog.writeln("Click here: www.vrspace.org");
    
    this.selectables = [];
    // detach/attach to hud/camera test
    let state = 0;
    let imageArea = new ImageArea(this.scene, "TouchImageArea");
    imageArea.attachToCamera();
    imageArea.size = .05;
    imageArea.position = new BABYLON.Vector3(.1, 0, .2);
    imageArea.show();
    this.selectables.push(imageArea);
    
    imageArea.onClick(e=>{
      // loading video only on click, otherwise chrome doesn't allow sound
      if ( ! this.videoLoaded ) {
        this.videoLoaded = true;
        imageArea.loadVideo("https://www.vrspace.org/content/vrspace-ui-demo.mp4");
      }
      if ( imageArea.handles ) {
        imageArea.removeHandles();
      } else {
        imageArea.createHandles();
      }
      if ( state%3 == 0 ) {
        imageArea.attachToHud();
      } else if (state%3 == 1) {
        imageArea.attachToCamera();
        chatLog.leftSide();
      } else if (state%3 == 2) {
        imageArea.detach();
        chatLog.rightSide();
      }
      state ++;
    });

    this.whiteboard = new Whiteboard(this.scene, "Whiteboard");
    this.whiteboard.size = 2;
    this.whiteboard.position = new BABYLON.Vector3(0,2,3);
    this.whiteboard.show();
    this.selectables.push(this.whiteboard);
    this.addListener(this.whiteboard);

    this.connect();
  }

  isSelectableMesh(mesh) {
    let ret = super.isSelectableMesh(mesh);
    this.selectables.forEach( o => ret |= o.isSelectableMesh(mesh));
    return ret;
  }

  connect() {
    new WorldManager(this);
    this.worldManager.enter({mesh:'//www.vrspace.org/babylon/dolphin.glb'});
  }

}

export const WORLD = new ImageAreaWorld();