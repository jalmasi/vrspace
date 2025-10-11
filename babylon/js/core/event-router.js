import { VRSPACE } from '../client/vrspace.js';
import { VRObject } from '../client/vrspace.js';
import { VRSPACEUI } from '../ui/vrspace-ui.js';

/**
 * Base event routing class.
 */
export class EventRouter {
  static changeListeners = [];
  constructor() {
    /** Change listeners receive changes applied to all shared objects */
    this.debug = false;    
  }
  /** 
   * Notify listeners of remote changes
   */
  notifyListeners(obj, field, node) {
    EventRouter.changeListeners.forEach((l) => {
      try {
        l(obj, field, node)
      } catch (e) {
        console.error(e);
      }
    });
  }

  /** Add a listener to remote events */
  addChangeListener(listener) {
    VRSPACE.addListener(EventRouter.changeListeners, listener);
  }

  /** Remove listener to remote events */
  removeChangeListener(listener) {
    VRSPACE.removeListener(EventRouter.changeListeners, listener);
  }

  /** Called when applying changes other than rotation and translation:
  executes a method if such a method exists, passing it a current instance of associated VRObject.
  @param {VRObject} obj VRObject to apply change to
  @param {*} field member field to set or method to execute 
   */
  routeEvent(obj, field, node) {
    if (typeof obj[field + 'Changed'] === 'function') {
      // execute changes on VRObject, required by WorldEditor
      obj[field + 'Changed'](obj, node);
    } else {
      // business as usual - most network events simply change object properties, without any callback
      //console.log("Ignoring unknown event to "+obj+": "+field);
    }
  }

  /** 
   * Apply remote changes to an object.
   * @param {VRObject} obj 
   */
  changeObject(obj, changes, node) {
    this.log("Changes on " + obj.id + ": " + JSON.stringify(changes));
    if (!node) {
      node = this.getRootNode(obj);
    }
    for (var field in changes) {
      this.routeEvent(obj, field, node);
      this.notifyListeners(obj, field, node);
    }
  }

  /**
   * Overrides VRObject routing methods (positionChanged, rotationChanged, scaleChanged)
   * with implementations that create and update animations.
   * Called during WorldManager initialization. 
   */ 
  addVRObjectRoutingMethods(fps) {
    console.log("FPS:"+fps)
    // in prototype methods, obj == this
    VRObject.prototype.positionChanged = (obj,node) => {
      if (!obj.translate) {
        obj.translate = VRSPACEUI.createAnimation(node, "position", fps);
        VRSPACEUI.updateAnimation(obj.translate, node.position, obj.position);
      } else {
        obj.translate = VRSPACEUI.chainAnimation(obj.translate, node, "position", obj.position);
      }
    }
    VRObject.prototype.rotationChanged = (obj,node) => {
      if (!obj.rotate) {
        obj.rotate = VRSPACEUI.createAnimation(node, "rotation", fps);
        VRSPACEUI.updateAnimation(obj.rotate, node.rotation, obj.rotation);
      } else {
        obj.rotate = VRSPACEUI.chainAnimation(obj.rotate, node, "rotation", obj.rotation);
      }
    }
    VRObject.prototype.scaleChanged = (obj,node) => {
      if (!obj.rescale) {
        obj.rescale = VRSPACEUI.createAnimation(node, "scaling", fps);
      }
      VRSPACEUI.updateAnimation(obj.rescale, node.scaling, obj.scale);      
    }
  }
  
  /**
   * Get root node of a VRObject
   * @param {VRObject} obj 
   */
  getRootNode(obj) {
    if (obj.avatar) {
      return obj.avatar.baseMesh();
    } else if (obj.container) {
      return obj.container.meshes[0];
    } else if (obj.instantiatedEntries) {
      return obj.instantiatedEntries.rootNodes[0];
    }
    console.log("ERROR: unknown root for " + obj);
  }
  
  /** Optionally log something */
  log(what) {
    if (this.debug) {
      console.log(what);
    }
  }
   
}