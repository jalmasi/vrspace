import { VisibilityHelper } from '../../world/visibility-helper.js'
import { WorldManager } from '../../core/world-manager.js'
import { Avatar } from '../../avatar/avatar.js';
import { VRSPACE } from "../../client/vrspace.js";

export class UserDirectionMonitor {
  constructor() {
    this.visibilityHelper = new VisibilityHelper();
    this.scene = this.visibilityHelper.scene;
    this.myChangeListener = (changes) => this.myChanges(changes);
    this.remoteChangeListener = (obj, field, node) => this.remoteChange(obj, field, node);
    this.baseRotation = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.X, Math.PI/2);
  }
  
  start() {
    WorldManager.instance.addMyChangeListener(this.myChangeListener);
    WorldManager.instance.addChangeListener(this.remoteChangeListener);
  }
  stop() {
    WorldManager.instance.removeMyChangeListener(this.myChangeListener);
    WorldManager.instance.removeChangeListener(this.remoteChangeListener);
  }

  init() {
    let avatars = this.visibilityHelper.getAvatarsOutOfView();
    avatars.forEach(avatar=>this.indicate(avatar));
  }
  dispose() {
  }
  
  myChanges(changes) {
    if (changes.some(e=>e.field == "position" || e.field == "rotation") ) {
      this.examineAll();
    }
  }
  
  remoteChange(vrObject, field, avatarBaseMesh) {
    if (field == "position" && typeof vrObject.avatar != "undefined") {
      this.indicate(vrObject.avatar);
    }
  }

  examineAll() {
    VRSPACE.getScene(vrObject=>typeof vrObject.avatar != "undefined").values().forEach(vrObject=>this.indicate(vrObject.avatar));
  }
  
  /**
   * @param {Avatar} avatar 
   */
  indicate(avatar) {
    let camera = this.scene.activeCamera;
    let cameraDirection = camera.getForwardRay(1).direction;
    let avatarDirection = avatar.basePosition().subtract(camera.position);
    var destRotation = new BABYLON.Matrix();
    BABYLON.Matrix.RotationAlignToRef(cameraDirection.normalizeToNew(), avatarDirection.normalizeToNew(), destRotation);
    var quat = BABYLON.Quaternion.FromRotationMatrix(destRotation);
    if ( !avatar.containsKey('positionIndicator')) {
      let positionIndicator = BABYLON.MeshBuilder.CreateCylinder("cone", {diameterTop:0, diameterBottom:0.1, height: .2, tessellation: 4}, this.scene);
      positionIndicator.parent = camera;
      positionIndicator.position = new BABYLON.Vector3(0,0,1);
      avatar.attach('positionIndicator',positionIndicator);
    }
    avatar.attachments.positionIndicator.rotationQuaternion = quat.multiply(this.baseRotation);    
  }
}