import { VRSPACEUI } from "../vrspace-ui.js";
import { World } from '../../world/world.js';

export class MiniMap {
  constructor(scene) {
    /** Delay in ms, defines frame rate, defaults to 25fps (20ms)*/
    this.delay = 1000/25; //fps
    /** Movement resolution to track, defaut 0.5 */
    this.resolution = 0.5;
    this.scene = scene;
    this.engine = scene.getEngine();
    this.camera = new BABYLON.ArcRotateCamera("MiniMapCamera", -Math.PI/2, 0, 100, new BABYLON.Vector3(0, 0, 0), this.scene);
    
    VRSPACEUI.hud.ignoreCamera=this.camera;
    
    this.capturing = false;
    this.ground = BABYLON.MeshBuilder.CreateDisc("MiniMap", {radius:.05}, this.scene);
    this.ground.parent = VRSPACEUI.hud.root;
    this.ground.material = new BABYLON.StandardMaterial("screenshotMaterial");
    this.ground.material.disableLighting = true;
    this.setPosition();

    this.center = BABYLON.MeshBuilder.CreateSphere("MiniMapCenter", {diameter: 0.002}, this.scene);
    this.center.material = new BABYLON.StandardMaterial("MiniMapCenterMaterial");
    this.center.material.emissiveColor=BABYLON.Color3.Blue();
    this.center.material.disableLighting = true;
    this.center.parent = this.ground;

    this.top = BABYLON.MeshBuilder.CreateSphere("MiniMapTop", {diameter: 0.002}, this.scene);
    this.top.material = new BABYLON.StandardMaterial("MiniMapTopMaterial");
    this.top.material.emissiveColor=BABYLON.Color3.Green();
    this.top.material.disableLighting = true;
    this.top.parent = this.ground;
    this.top.position = new BABYLON.Vector3(0,0.05,0);
    
    this.shot();
    this.movementHandler = () => this.movement();
    this.scene.registerBeforeRender(this.movementHandler);
    this.timestamp = Date.now();
    
    this.lastPos = new BABYLON.Vector3(0,0,0);
    
    window.addEventListener("resize", () => {
      this.setPosition();
    });    
  }
  setPosition(){
    this.ground.position = new BABYLON.Vector3(VRSPACEUI.hud.scaling()*.2*this.engine.getAspectRatio(this.scene.activeCamera)-0.05,-2*VRSPACEUI.hud.vertical(),0);
  }
  shot() {
    if (!this.capturing) {
      this.capturing = true;
      
      // top-down view bookkeeping:
      let pos = VRSPACEUI.hud.root.parent.position;
      if ( this.scene.activeCamera.getClassName() == 'ArcRotateCamera' && World.lastInstance && World.lastInstance.camera1p ) {
        pos = World.lastInstance.camera1p.position;
      }
      this.camera.position = new BABYLON.Vector3(pos.x,pos.y+100,pos.z);
      this.camera.target = new BABYLON.Vector3(pos.x,pos.y,pos.z);
      
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
  hasMoved() {
    let pos;
    if ( this.scene.activeCamera.getClassName() == 'UniversalCamera') {
      pos = this.scene.activeCamera.position;
    } else if (this.scene.activeCamera.getClassName() == 'WebXRCamera') {
      pos = this.scene.activeCamera.position;
    } else if (this.scene.activeCamera.getClassName() == 'ArcRotateCamera') {
      if (World.lastInstance && World.lastInstance.camera1p) {
        // relies on AvatarController keeping camera1p position in sync
        pos = World.lastInstance.camera1p.position;
      } else {
        // CHECKME fallback
        // return this.scene.activeCamera.hasMoved;
      }
    }
    let dist = this.lastPos.subtract(pos).length();
    if (dist > this.resolution) {
      this.lastPos = this.scene.activeCamera.position.clone();
      return true;
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
    if (this.scene.activeCamera.getClassName() == 'UniversalCamera') {
      //this.camera.alpha = -Math.PI/2-this.scene.activeCamera.rotation.y;
      this.ground.rotation.z = this.scene.activeCamera.rotation.y;
    } else if (this.scene.activeCamera.getClassName() == 'ArcRotateCamera') {
      //this.camera.alpha = this.scene.activeCamera.alpha;
      this.ground.rotation.z = 1.5*Math.PI-this.scene.activeCamera.alpha;
    } else if (this.scene.activeCamera.getClassName() == 'WebXRCamera') {
      let rot = this.scene.activeCamera.rotationQuaternion.toEulerAngles();
      //this.camera.alpha = -Math.PI/2-rot.y;
      this.ground.rotation.z = rot.y;
    }
    if ( this.hasMoved() ) {
      this.shot();
    }
  }
  dispose() {
    this.scene.unregisterBeforeRender(this.movementHandler);
    this.ground.dispose();
    this.camera.dispose();
  }
}