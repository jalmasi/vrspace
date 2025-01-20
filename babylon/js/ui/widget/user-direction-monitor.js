import { VisibilityHelper } from '../../world/visibility-helper.js'
import { WorldManager } from '../../core/world-manager.js'
import { Avatar } from '../../avatar/avatar.js';
import { VRSPACE } from "../../client/vrspace.js";
import { VRSPACEUI } from '../vrspace-ui.js';

/**
 * Points where other users are.
 * For each avatar that is not currently in the view, adds a thin cone pointing to their location.
 * Works only online, requires functional WorldManager.
 * Singleton.
 */
export class UserDirectionMonitor {
  /** Is enabled, defaults to true. */
  static enabled = true;
  /** Current instance @type {UserDirectionMonitor} */
  static instance = null;
  constructor() {
    if (UserDirectionMonitor.instance) {
      throw "there can be only one";
    }
    this.visibilityHelper = new VisibilityHelper();
    this.scene = this.visibilityHelper.scene;
    this.myChangeListener = (changes) => this.myChanges(changes);
    this.remoteChangeListener = (obj, field, node) => this.remoteChange(obj, field, node);
    this.baseRotation = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.X, Math.PI / 2);
    this.distance = 0.5;
    this.animate = true;
    this.fps = 5;
    this.vertical = 0.15;
    this.autoHide = true;
    this.active = false;
    UserDirectionMonitor.instance = this;
  }

  /** Returns true if WorldManager is active, and UserDirectionMonitor is enabled */
  static isEnabled() {
    return WorldManager.instance != null && UserDirectionMonitor.enabled;
  }

  /** Enables UserDirectionMonitor by setting static var */
  static enable() {
    UserDirectionMonitor.enabled = true;
  }

  /** Disables UserDirectionMonitor by unsetting static var, and disposes of running instance */
  static disable() {
    UserDirectionMonitor.enabled = false;
    if (UserDirectionMonitor.instance) {
      UserDirectionMonitor.instance.dispose();
    }
  }

  /**
   * Adds change local and remote change listeners to the WorldManager.
   */
  start() {
    if (!this.active) {
      this.active = true;
      WorldManager.instance.addMyChangeListener(this.myChangeListener);
      WorldManager.instance.addChangeListener(this.remoteChangeListener);
      this.animate = this.animate && WorldManager.instance.fps < 25;
    }
  }

  /**
   * Removes own change listeners from WorldManager.
   */
  stop() {
    if (this.active) {
      WorldManager.instance.removeMyChangeListener(this.myChangeListener);
      WorldManager.instance.removeChangeListener(this.remoteChangeListener);
      this.active = false;
    }
  }

  // CHECKME: not used?
  init() {
    let avatars = this.visibilityHelper.getAvatarsOutOfView();
    avatars.forEach(avatar => this.indicate(avatar));
  }

  /**
   * Stop the current instance, and remove all objects added to the scene for each avatar.
   */
  dispose() {
    this.stop();
    VRSPACE.getScene(vrObject => typeof vrObject.avatar != "undefined").values().forEach(vrObject => this.removeIndicator(vrObject.avatar));
    UserDirectionMonitor.instance = null;
  }

  /**
   * Callback triggered when local changes happen to own avatar.
   * If it's a position or rotation, calls examineAll().
   */
  myChanges(changes) {
    if (changes.some(e => e.field == "position" || e.field == "rotation")) {
      this.examineAll();
    }
  }

  /**
   * Callback triggered on remote changes to avatars in the same world. Calls indicate() for that one avatar.
   */
  remoteChange(vrObject, field, avatarBaseMesh) {
    if (field == "position" && typeof vrObject.avatar != "undefined") {
      this.indicate(vrObject.avatar, this.animate);
    }
  }

  /**
   * Reprocess positions of all avatars in the scene. Called when own position changes.
   */
  examineAll() {
    VRSPACE.getScene(vrObject => typeof vrObject.avatar != "undefined").values().forEach(vrObject => this.indicate(vrObject.avatar, this.animate));
  }

  /**
   * Recaluclate position of one avatar, and update or hide the indicator.
   * 
   * @param {Avatar} avatar 
   */
  indicate(avatar, animate) {
    let camera = this.scene.activeCamera;

    if (this.autoHide && camera.isInFrustum(avatar.baseMesh())) {
      // avatar is currently vidisible, hide the indicator if displayed  
      if (avatar.containsAttachment('positionIndicator')) {
        avatar.attachments.positionIndicator.setEnabled(false);
      }
      return;
    }

    let cameraDirection = camera.getForwardRay(1).direction;
    let avatarDirection = avatar.basePosition().subtract(camera.position);
    var destRotation = new BABYLON.Matrix();
    BABYLON.Matrix.RotationAlignToRef(cameraDirection.normalizeToNew(), avatarDirection.normalizeToNew(), destRotation);
    var quat = BABYLON.Quaternion.FromRotationMatrix(destRotation);
    if (!avatar.containsAttachment('positionIndicator')) {
      let positionIndicator = BABYLON.MeshBuilder.CreateCylinder("cone", { diameterTop: 0, diameterBottom: 0.01 * this.distance, height: .2 * this.distance, tessellation: 4 }, this.scene);
      positionIndicator.material = VRSPACEUI.uiMaterial;
      positionIndicator.parent = camera;
      positionIndicator.position = new BABYLON.Vector3(0, this.vertical, this.distance);
      avatar.attach('positionIndicator', positionIndicator);
    }
    let destQuat = quat.multiply(this.baseRotation)
    let aspectRatio = this.scene.getEngine().getAspectRatio(camera);
    let destPos = new BABYLON.Vector3(quat.y * aspectRatio / 2.5 * this.distance, this.vertical, this.distance);

    avatar.attachments.positionIndicator.setEnabled(true);
    if (animate) {
      if (!avatar.containsAttachment('positionIndicatorPosAnim')) {
        avatar.attachments.positionIndicatorPosAnim = VRSPACEUI.createAnimation(avatar.attachments.positionIndicator, "position", this.fps);
        avatar.attachments.positionIndicatorQuatAnim = VRSPACEUI.createQuaternionAnimation(avatar.attachments.positionIndicator, "rotationQuaternion", this.fps);
        avatar.attachments.positionIndicator.rotationQuaternion = destQuat;
        avatar.attachments.positionIndicator.position = destPos;
      } else {
        VRSPACEUI.updateAnimation(avatar.attachments.positionIndicatorPosAnim, avatar.attachments.positionIndicator.position, destPos);
        VRSPACEUI.updateQuaternionAnimation(avatar.attachments.positionIndicatorQuatAnim, avatar.attachments.positionIndicator.rotationQuaternion, destQuat);
      }
    } else {
      avatar.attachments.positionIndicator.rotationQuaternion = destQuat;
      avatar.attachments.positionIndicator.position = destPos;
    }
  }

  /** @param {Avatar} avatar */
  removeIndicator(avatar) {
    if (avatar.containsAttachment('positionIndicator')) {
      if (avatar.containsAttachment('positionIndicatorPosAnim')) {
        avatar.attachments.positionIndicatorPosAnim.dispose();
        avatar.attachments.positionIndicatorQuatAnim.dispose();
        avatar.detach('positionIndicatorPosAnim');
        avatar.detach('positionIndicatorQuatAnim');
      }
      avatar.attachments.positionIndicator.dispose();
      avatar.detach('positionIndicator');
    }
  }

}