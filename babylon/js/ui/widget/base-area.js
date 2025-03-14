import { ManipulationHandles } from "./manipulation-handles.js";
import { VRSPACEUI } from "../vrspace-ui.js";

/**
 * Base class common for TextArea and ImageArea, possibly more to come.
 * Provides methods to attach the area to HUD or camera, and common variables.
 */
export class BaseArea {
  constructor(scene, name) {
    this.scene = scene;
    this.name = name;
    this.size = .2;
    this.position = BABYLON.Vector3.ZERO; // OVERRIDE!
    this.addHandles = true;
    this.canMinimize = true;
    this.canClose = false;
    this.onClose = null;
    this.group = new BABYLON.TransformNode(name, this.scene);
    this.attachedToHud = false;
    this.attachedToCamera = false;
    this.areaPlane = null;
    /** @type {ManipulationHandles} */
    this.handles = null;
    this.texture = null;
    /** Subclasses dispose of material, if they create it */
    this.material = null;
    this.billboardMode = BABYLON.Mesh.BILLBOARDMODE_NONE;
  }
  
  /**
   * Attach it to the HUD. It does not resize automatically, just sets the parent.
   * Optionally also attaches handles to the hud, if they are active.
   */
  attachToHud() {
    this.group.parent = VRSPACEUI.hud.root;
    this.group.position = this.position;
    this.attachedToCamera = false;
    this.attachedToHud = true;
    VRSPACEUI.hud.addAttachment(this.areaPlane);
    if ( this.handles ) {
      this.handles.attachToHud();
    }
  }
 
  /**
   * Attach it to the camera. It does not resize automatically, just sets the parent.
   * It does not automatically switch to another camera if active camera changes.
   * @param camera currently active camera
   */
  attachToCamera(camera = this.scene.activeCamera) {
    this.group.parent = camera;
    this.group.position = this.position;
    this.attachedToCamera = true;
    this.attachedToHud = false;
    VRSPACEUI.hud.removeAttachment(this.areaPlane);
    if ( this.handles ) {
      // FIXME this is most likely wrong
      this.handles.attachToHud();
      this.handles.handles.forEach( h => VRSPACEUI.hud.addAttachment(h));
      VRSPACEUI.hud.removeAttachment(this.handles.box);
    }
  }
  
  /**
   * Detach from whatever attached to, i.e. drop it where you stand.
   * @param {number} [offset=this.position.z] how far away from the camera to drop it, defaults to current z position (assuming it's attached to HUD or camera) 
   */
  detach(offset=this.position.z) {
    this.group.parent = null;
    let camera = this.scene.activeCamera;
    // just in front of camera:
    this.group.position = camera.position.add(camera.getForwardRay(1).direction.scale(offset));
    this.attachedToCamera = false;
    this.attachedToHud = false;
    VRSPACEUI.hud.removeAttachment(this.areaPlane);
    if ( this.handles ) {
      // FIXME this is most likely wrong
      this.handles.handles.forEach( h => VRSPACEUI.hud.addAttachment(h));
      VRSPACEUI.hud.removeAttachment(this.handles.box);
    }
  }
 
  /**
  * Removes manipulation handles.
  */
  removeHandles() {
    if ( this.handles ) {
      this.handles.dispose();
      this.handles = null;
    }
  }
 
  /**
  * XR pointer support
  */
  isSelectableMesh(mesh) {
    return mesh == this.areaPlane && this.areaPlane.isEnabled() || (this.handles && this.handles.isSelectableMesh(mesh)); 
  }

  /** Clean up allocated resources */
  dispose() {
    this.detach();
    this.removeHandles();
    if ( this.areaPlane ) {
      this.areaPlane.dispose();
    }
  }
}