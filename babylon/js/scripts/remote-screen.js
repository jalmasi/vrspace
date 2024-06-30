import { BasicScript } from "./basic-script.js";
import { ImageArea } from '../ui/widget/image-area.js';

/**
 * Receiving component of a screen share, or some other video stream.
 * When a client creates a screen sharing VRObject (by calling VRSPACE.createScriptedObject),
 * client-side presentation logic is implemented by this class.
 * It creates an ImageArea, and once stream starts, executes ImageArea.loadStream().
 */
export class RemoteScreen extends BasicScript {
  async init() {
    super.init();
    console.log("Remote screen initializing", this.vrObject);
    //properties:{ screenName:screenName, clientId: client.id },
    //active:true,
    //script:'/babylon/js/scripts/remote-screen.js'
    if (this.worldManager.mediaStreams) {
      this.worldManager.mediaStreams.addStreamListener(this.vrObject.properties.clientId, mediaStream => this.playStream(mediaStream));
    }
    this.show();
  }
  
  show() {
    this.imageArea = new ImageArea(this.scene, "ScreencastArea");
    this.imageArea.size = this.vrObject.properties.size;
    this.imageArea.addHandles = this.vrObject.properties.addHandles;
    this.imageArea.position = new BABYLON.Vector3(this.vrObject.position.x, this.vrObject.position.y, this.vrObject.position.z); 
    if (this.vrObject.rotation) {
      this.imageArea.group.rotation = new BABYLON.Vector3(this.vrObject.rotation.x, this.vrObject.rotation.y, this.vrObject.rotation.z);
    }
    this.imageArea.show();
  }

  async dispose() {
    this.worldManager.mediaStreams.removeStreamListener(this.vrObject.properties.clientId);
    this.imageArea.dispose();
  }
  
  playStream(mediaStream) {
    this.imageArea.loadStream(mediaStream);
  }
  
}