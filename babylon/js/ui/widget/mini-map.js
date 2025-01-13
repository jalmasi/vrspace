import { VRSPACEUI } from "../vrspace-ui.js";

export class MiniMap {
  constructor(scene) {
    this.scene = scene;
    this.engine = scene.getEngine();
    this.camera = new BABYLON.ArcRotateCamera("MiniMapCamera", -Math.PI/2, 0, 100, new BABYLON.Vector3(0, 0, 0), this.scene);
    
    VRSPACEUI.hud.ignoreCamera=this.camera;
    // very simple to use, but does not keep top-down view
    //this.camera.parent = VRSPACEUI.hud.root;
    
    this.capturing = false;
    this.ground = BABYLON.MeshBuilder.CreateDisc("MiniMap", {radius:.05}, this.scene);
    this.ground.parent = VRSPACEUI.hud.root;
    this.setPosition();
    this.ground.material = new BABYLON.StandardMaterial("screenshotMaterial");
    this.ground.material.disableLighting = true;

    this.shot();
    this.movementHandler = () => this.movement();
    this.scene.registerBeforeRender(this.movementHandler);
    this.timestamp = Date.now();
    this.delay = 1000/25; //fps
    window.addEventListener("resize", () => {
      this.setPosition();
    });    
  }
  setPosition(){
    this.ground.position = new BABYLON.Vector3(.35*this.engine.getAspectRatio(this.scene.activeCamera),.5,.5);
  }
  shot() {
    if (!this.capturing) {
      this.capturing = true;
      
      // top-down view bookkeeping:
      // position
      let pos = VRSPACEUI.hud.root.parent.position;
      this.camera.position = new BABYLON.Vector3(pos.x,pos.y+100,pos.z);
      this.camera.target = new BABYLON.Vector3(pos.x,pos.y,pos.z);
      // rotation
      if (this.scene.activeCamera.getClassName() == 'UniversalCamera') {
        this.camera.alpha = -Math.PI/2-this.scene.activeCamera.rotation.y;
      } else if (this.scene.activeCamera.getClassName() == 'ArcRotateCamera') {
        this.camera.alpha = this.scene.activeCamera.alpha;
      } else if (this.scene.activeCamera.getClassName() == 'WebXRCamera') {
        let rot = this.scene.activeCamera.rotationQuaternion.toEulerAngles();
        this.camera.alpha = -Math.PI/2-rot.y;
      }
      
      // same thing with both methods
      //BABYLON.Tools.CreateScreenshot(this.engine, this.camera, {precision: 1.0, height:1024, width:1024}, (data) => {
      BABYLON.Tools.CreateScreenshotUsingRenderTarget(this.engine, this.camera, {precision: 1.0, height:1024, width:1024}, (data) => {
        const screenshotTexture = new BABYLON.Texture(data,this.engine,false,false);
        screenshotTexture.onLoadObservable.add((texture) => {
          this.ground.material.emissiveTexture = texture;
          this.capturing = false;
        });

      });
    }
  }
  movement() {
    if ( this.timestamp + this.delay > Date.now() ) {
      return;
    }
    this.timestamp = Date.now();
    //if ( this.camera.parent != this.scene.activeCamera) {
      //this.camera.parent = this.scene.activeCamera;
    //}
    if ( this.scene.activeCamera.hasMoved ) {
      this.shot();
    }
  }
  dispose() {
    this.scene.unregisterBeforeRender(this.movementHandler);
    this.ground.dispose();
    this.camera.dispose();
  }
}