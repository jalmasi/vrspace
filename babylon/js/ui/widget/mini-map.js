import { VRSPACEUI } from "../vrspace-ui.js";

export class MiniMap {
  constructor(scene) {
    this.scene = scene;
    this.engine = scene.getEngine();
    this.camera = new BABYLON.ArcRotateCamera("MiniMapCamera", -Math.PI/2, 0, 100, new BABYLON.Vector3(0, 0, 0), this.scene);
    VRSPACEUI.hud.ignoreCamera=this.camera;
    this.camera.parent = this.scene.activeCamera;
    this.capturing = false;
    this.ground = BABYLON.MeshBuilder.CreateDisc("MiniMap", {radius:.05}, this.scene);
    this.ground.parent = this.scene.activeCamera;
    this.ground.position = new BABYLON.Vector3(.16*this.engine.getAspectRatio(this.scene.activeCamera),.15,.5);
    //this.ground.rotation = new BABYLON.Vector3(0,Math.PI,0);
    this.ground.material = new BABYLON.StandardMaterial("screenshotMaterial");
    this.ground.material.disableLighting = true;
    //this.ground.material.sideOrientation = BABYLON.StandardMaterial.ClockWiseSideOrientation;
    this.shot();
    this.movementHandler = () => this.movement();
    this.scene.registerBeforeRender(this.movementHandler);
    this.timestamp = Date.now();
    this.delay = 1000/25; //fps
    window.addEventListener("resize", () => {
      this.ground.position = new BABYLON.Vector3(.16*this.engine.getAspectRatio(this.scene.activeCamera),.15,.5);
    });
    
  }
  shot() {
    if (!this.capturing) {
      this.capturing = true;
      // all the same
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
    if ( this.camera.parent != this.scene.activeCamera) {
      this.camera.parent = this.scene.activeCamera;
    }
    if ( this.camera.parent.hasMoved ) {
      this.shot();
    }
  }
  dispose() {
    this.scene.unregisterBeforeRender(this.movementHandler);
    this.ground.dispose();
  }
}