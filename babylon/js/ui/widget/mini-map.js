import { VRSPACEUI } from "../vrspace-ui.js";
import { World } from '../../world/world.js';
import { CameraHelper } from "../../core/camera-helper.js";

/**
 * MiniMap sets up a camera looking from above at current avatar position,
 * takes a screenshot every now and then, and displays it.
 */
export class MiniMap {
  constructor(scene) {
    /** Delay in ms, defines frame rate, defaults to 25fps (20ms)*/
    this.delay = 1000 / 25;
    /** Movement resolution to track, defaut 0.5 */
    this.resolution = 0.5;
    /** Height above the avatar use to capture the scene */
    this.height = 100;

    // internal constants
    this.scene = scene;
    this.engine = scene.getEngine();
    this.camera = new BABYLON.ArcRotateCamera("MiniMapCamera", -Math.PI / 2, 0, this.height, new BABYLON.Vector3(0, 0, 0), this.scene);

    // taking screenshot changes active camera, tell HUD to ignore the change    
    CameraHelper.getInstance(this.scene).ignoreCamera = this.camera;

    this.surface = BABYLON.MeshBuilder.CreateDisc("MiniMap", { radius: .05 }, this.scene);
    this.surface.parent = VRSPACEUI.hud.root;
    VRSPACEUI.hud.addAttachment(this.surface);
    this.surface.material = new BABYLON.StandardMaterial("screenshotMaterial");
    this.surface.material.disableLighting = true;

    this.pointerDragBehavior = new BABYLON.PointerDragBehavior({ dragPlaneNormal: new BABYLON.Vector3(0, 0, 1) });
    //this.pointerDragBehavior.useObjectOrientationForDragging = false;
    //this.pointerDragBehavior.updateDragPlane = false;
    this.surface.addBehavior(this.pointerDragBehavior);
    
    this.center = BABYLON.MeshBuilder.CreateSphere("MiniMapCenter", { diameter: 0.002 }, this.scene);
    this.center.material = new BABYLON.StandardMaterial("MiniMapCenterMaterial");
    this.center.material.emissiveColor = BABYLON.Color3.Yellow();
    this.center.material.disableLighting = true;
    this.center.parent = this.surface;

    this.top = BABYLON.MeshBuilder.CreateSphere("MiniMapTop", { diameter: 0.002 }, this.scene);
    this.top.material = new BABYLON.StandardMaterial("MiniMapTopMaterial");
    this.top.material.emissiveColor = BABYLON.Color3.Yellow();
    this.top.material.disableLighting = true;
    this.top.parent = this.surface;
    this.top.position = new BABYLON.Vector3(0, 0.05, 0);

    // state variables
    this.timestamp = Date.now();
    this.capturing = false;
    this.lastPos = new BABYLON.Vector3(0, 0, 0);

    // handlers
    this.movementHandler = () => this.movement();
    this.scene.registerBeforeRender(this.movementHandler);

    this.windowResized = () => this.setPosition();
    window.addEventListener("resize", this.windowResized);

    this.setPosition();
  }

  setPosition() {
    this.surface.position = new BABYLON.Vector3(VRSPACEUI.hud.scaling() * .2 * this.engine.getAspectRatio(this.scene.activeCamera) - 0.05, -2 * VRSPACEUI.hud.vertical(), 0);
  }

  shot() {
    if (!this.capturing) {
      this.capturing = true;

      // top-down view bookkeeping:
      let pos = VRSPACEUI.hud.root.parent.position;
      if (this.scene.activeCamera.getClassName() == 'ArcRotateCamera' && World.lastInstance && World.lastInstance.camera1p) {
        pos = World.lastInstance.camera1p.position;
      }
      this.camera.position = new BABYLON.Vector3(pos.x, pos.y + this.height, pos.z);
      this.camera.target = new BABYLON.Vector3(pos.x, pos.y, pos.z);
      // mandatory, as it gets recalculated:
      this.camera.alpha = -Math.PI * .5;

      // same thing with both methods
      //BABYLON.Tools.CreateScreenshot(this.engine, this.camera, {precision: 1.0, height:1024, width:1024}, (data) => {
      BABYLON.Tools.CreateScreenshotUsingRenderTarget(this.engine, this.camera, { precision: 1.0, height: 1024, width: 1024 }, (data) => {
        const screenshotTexture = new BABYLON.Texture(data, this.engine, false, false);
        screenshotTexture.onLoadObservable.add((texture) => {
          this.surface.material.emissiveTexture = texture;
          this.capturing = false;
        });

      });
    }
  }

  hasMoved() {
    let pos;
    if (this.scene.activeCamera.getClassName() == 'UniversalCamera') {
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
    if (this.timestamp + this.delay > Date.now()) {
      return;
    }
    this.timestamp = Date.now();
    if (this.scene.activeCamera.getClassName() == 'UniversalCamera') {
      //this.camera.alpha = -Math.PI/2-this.scene.activeCamera.rotation.y;
      this.surface.rotation.z = this.scene.activeCamera.rotation.y;
    } else if (this.scene.activeCamera.getClassName() == 'ArcRotateCamera') {
      //this.camera.alpha = this.scene.activeCamera.alpha;
      this.surface.rotation.z = 1.5 * Math.PI - this.scene.activeCamera.alpha;
    } else if (this.scene.activeCamera.getClassName() == 'WebXRCamera') {
      let rot = this.scene.activeCamera.rotationQuaternion.toEulerAngles();
      //this.camera.alpha = -Math.PI/2-rot.y;
      this.surface.rotation.z = rot.y;
    }
    if (this.hasMoved()) {
      this.shot();
    }
  }

  dispose() {
    this.scene.unregisterBeforeRender(this.movementHandler);
    VRSPACEUI.hud.removeAttachment(this.surface);
    CameraHelper.getInstance(this.scene).ignoreCamera = null;
    this.surface.dispose();
    this.camera.dispose();
    window.removeEventListener("resize", this.windowResized);
  }
}