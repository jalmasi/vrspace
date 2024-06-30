import { BasicScript } from "./basic-script.js";
import { Whiteboard } from '../ui/world/whiteboard.js';
import { VRSPACE, VRSpace } from "../vrspace-min.js";

/**
 * Receiving component of a screen share, or some other video stream.
 * When a client creates a screen sharing VRObject (by calling VRSPACE.createStreamingObject),
 * client-side presentation logic is implemented by this class.
 * It creates an ImageArea, and once stream starts, executes ImageArea.loadStream().
 */
export class RemoteWhiteboard extends BasicScript {
  async init() {
    super.init();
    console.log("Remote whiteboard initializing", this.vrObject);
    //properties:{ screenName:screenName, clientId: client.id },
    //active:true,
    //script:'/babylon/js/scripts/remote-screen.js'
    if ( !this.isMine() ) {
      this.show();
    }
  }
  
  show() {
    if ( ! this.whiteboard ) {
      this.whiteboard = new Whiteboard(this.scene, this.vrObject.properties.name);
      this.whiteboard.size = this.vrObject.properties.size;
      this.whiteboard.addHandles = this.vrObject.properties.addHandles;
      this.whiteboard.position = new BABYLON.Vector3(this.vrObject.position.x, this.vrObject.position.y, this.vrObject.position.z); 
      this.whiteboard.show();
    }
  }

  async dispose() {
    this.whiteboard.dispose();
  }
 
  remoteChange(vrObject, changes) {
    if ( ! this.isMineChange(changes) ) {
      console.log("Remote changes for "+vrObject.id, changes);
      let method=Object.keys(changes)[0];
      let args=changes[method];
      if (this.whiteboard[method]) {
        if ( typeof(args) === 'object') {
          if (Object.keys(args).length == 0) {
            this.whiteboard[method]();
          } if (Object.keys(args).length == 2) {
            this.whiteboard[method](args.x, args.y);
          } else if (Object.keys(args).length == 3) {
            this.whiteboard[method](args.r, args.g, args.b);
          }
        } else if ( typeof(args) === 'number') {
          this.whiteboard[method](args);
        }
      }
    }
  }

  isMineChange(changes) {
    return changes.clientId == VRSPACE.me.id;
  }
}