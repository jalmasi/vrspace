import { EventRouter } from './event-router.js';
import { VRObject } from '../client/vrspace.js';
import { VRSPACEUI } from '../ui/vrspace-ui.js';

export class MeshLoader extends EventRouter {
  constructor(loadCallback, loadErrorHandler) {
    super();
    this.notifyLoadListeners = loadCallback;
    this.loadErrorHandler = loadErrorHandler;    
  }
  /**
  Load an object and attach a listener.
  @param {VRObject} obj
  @param {*} callback optional
   */
  async loadMesh(obj, callback) {
    this.log("Loading object " + obj.mesh);
    if (!obj.mesh) {
      console.log("Null mesh of client " + obj.id);
      return;
    }
    // CHECKME: do this in AssetLoader?
    if (obj.mesh.startsWith('/') && VRSPACEUI.contentBase) {
      obj.mesh = VRSPACEUI.contentBase + obj.mesh;
    }
    VRSPACEUI.assetLoader.loadObject(obj, (mesh) => {
      this.log("loaded " + obj.mesh);
      mesh.VRObject = obj;

      var initialPosition = { position: {} };
      this.changeObject(obj, initialPosition, mesh);
      if (obj.scale) {
        this.changeObject(obj, { scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z } }, mesh);
      }
      if (obj.rotation) {
        // CHECKME: quaternion?
        this.changeObject(obj, { rotation: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z } }, mesh);
      }

      // add listener to process changes - active objects only
      if (obj.active) {
        obj.addListener((obj, changes) => this.changeObject(obj, changes, mesh));
        // subscribe to media stream here if available
        if (this.mediaStreams) {
          this.mediaStreams.streamToMesh(obj, mesh);
        }
      }
      this.notifyLoadListeners(obj, mesh);
      if (callback) {
        callback(mesh);
      }
    }, this.loadErrorHandler);
  }
      
}