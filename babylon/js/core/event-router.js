import { VRSPACE } from '../client/vrspace.js';
import { VRObject } from '../client/vrspace.js';

/**
 * Base event routing class
 */
export class EventRouter {
  constructor() {
    /** Change listeners receive changes applied to all shared objects */
    this.changeListeners = [];
    this.debug = false;    
  }
  /** 
   * Notify listeners of remote changes 
   */
  notifyListeners(obj, field, node) {
    this.changeListeners.forEach((l) => {
      try {
        l(obj, field, node)
      } catch (e) {
        console.error(e);
      }
    });
  }

  /** Add a listener to remote events */
  addChangeListener(listener) {
    VRSPACE.addListener(this.changeListeners, listener);
  }

  /** Remove listener to remote events */
  removeChangeListener(listener) {
    VRSPACE.removeListener(this.changeListeners, listener);
  }

  /** Called when applying changes other than rotation and translation:
  executes a method if such a method exists, passing it a current instance of associated VRObject.
  @param {VRObject} obj VRObject to apply change to
  @param {*} field member field to set or method to execute 
   */
  routeEvent(obj, field, node) {
    var object = obj;
    if (obj.avatar) {
      object = obj.avatar;
    } else if (obj.container) {
      object = obj.container;
    } else if (obj.instantiatedEntries) {
      object = obj.instantiatedEntries;
    } else {
      //this.log("Ignoring unknown event "+field+" to object "+obj.id);
      return;
    }
    if (typeof object[field] === 'function') {
      object[field](obj);
    } else if (typeof obj[field + 'Changed'] === 'function') {
      obj[field + 'Changed'](obj);
      //} else if (object.hasOwnProperty(field)) {
    } else {
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
      if ('position' === field) {
        if (!obj.translate) {
          obj.translate = VRSPACEUI.createAnimation(node, "position", this.fps);
        }
        VRSPACEUI.updateAnimation(obj.translate, node.position, obj.position);
      } else if ('rotation' === field) {
        if (!obj.rotate) {
          obj.rotate = VRSPACEUI.createAnimation(node, "rotation", this.fps);
        }
        VRSPACEUI.updateAnimation(obj.rotate, node.rotation, obj.rotation);
      } else if ('scale' === field) {
        if (!obj.rescale) {
          obj.rescale = VRSPACEUI.createAnimation(node, "scaling", this.fps);
        }
        VRSPACEUI.updateAnimation(obj.rescale, node.scaling, obj.scale);
      } else {
        this.routeEvent(obj, field, node);
      }
      this.notifyListeners(obj, field, node);
    }
  }
 
  /** Optionally log something */
  log(what) {
    if (this.debug) {
      console.log(what);
    }
  }
   
}