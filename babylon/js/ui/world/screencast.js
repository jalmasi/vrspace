import { OpenViduStreams } from '../../core/media-streams.js';
import { WorldListener } from '../../world/world-listener.js';
import { World } from '../../world/world.js';
import { WorldManager } from '../../core/world-manager.js';
import { MediaStreams } from "../../core/media-streams.js";

/**
 * Base screen sharing class, sending side.
 * Using should be simple - construct and init. All methods except startSharing/stopSharing are internally called,
 * intended to be overridden by subclasses.
 * Receiving side of the screen is implemented by RemoteScreen script.
 */
export class Screencast extends WorldListener {
  /**
   * Creates but hides meshes.
   * 
   * @param world the world
   * @param name screen share name, displayed when sharing. Defaults to user name or id.
   */
  constructor(world, name = "Shared screen") {
    super();
    /** text to display on the share screen button, by default Share screen */
    this.text = 'Share screen';
    /** @type {World} */
    this.world = world;
    this.scene = world.scene;
    this.name = name;

    /** Screen size, default 3. Height is fixed, width may scale accordingly. */
    this.size = 3;
    /** Add manupulation handles? Default true. */
    this.addHandles = true;
    /** Screen position, default 0,3,0 */
    this.position = new BABYLON.Vector3(0, 3, 0);
    /** Screen rotation, default Math.PI - away from presenter */
    this.rotation = new BABYLON.Vector3(0, Math.PI, 0);

    /** Contains VRObject used to exchange screens share messages, exists only on the sending side */
    this.screenShare = null;
    this.vrObject = null;
    /** Callback executed when sharing state changes, passed true/false */
    this.callback = null;
    /** @type {WorldManager} */
    this.worldManager = null;
  }

  /**
  Initialize the sharing component. Requires functional WorldManager attached to the world,
  so is safe to call from World.entered() method, or after it has been called.
   */
  init() {
    this.worldManager = this.world.worldManager;
    this.world.addListener(this, true);
    this.setupStreaming();
  }

  /**
   * Called from init(). Attaches itself to MediaStreams, creates new MediaStreams if required.
  */
  setupStreaming() {
    this.client = this.worldManager.VRSPACE.me;
    if (!MediaStreams.instance) {
      // CHECKME this is very unlikely to work
      const mediaStreams = new OpenViduStreams(this.scene, 'videos');
      this.worldManager.connectionManager.pubSub(this.client, false); // audio only
    }
  }

  /**
   * Starts the screencast: creates new shared VRObject, and calls MediaStreams.shareScreen().
   */
  startSharing() {
    let screenName = this.name;
    if (!screenName) {
      if (this.client.name) {
        screenName = this.client.name;
      } else {
        screenName = 'u' + this.client.id;
      }
    }

    this.worldManager.VRSPACE.createSharedObject({
      properties: { screenName: screenName, type: "Screencast", clientId: this.client.id, size: this.size, addHandles: this.addHandles },
      active: true,
      script: '/babylon/js/scripts/remote-screen.js',
      position: { x: this.position.x, y: this.position.y, z: this.position.z },
      rotation: { x: this.rotation.x, y: this.rotation.y, z: this.rotation.z }
    }).then(obj => {
      this.screenShare = obj;
      console.log("Created new VRObject", obj);
      MediaStreams.instance.shareScreen(() => {
        // end callback, executed when user presses browser stop share button
        this.deleteSharedObject();
      }).then((mediaStream) => {
        console.log("streaming", mediaStream);
        // imageArea is created by scene event handler
        //this.imageArea.loadStream(mediaStream);
        obj.attachedScript.playStream(mediaStream, true);
      }).catch((e) => {
        console.log('sharing denied', e);
        this.deleteSharedObject();
      });
    });
  }

  /**
   * Stop sharing and delete shared object.
  */
  stopSharing() {
    this.deleteSharedObject();
    MediaStreams.instance.stopSharingScreen();
  }

  /**
   * Internally used to delete the shared object.
   */
  deleteSharedObject() {
    if (this.screenShare) {
      this.worldManager.VRSPACE.deleteSharedObject(this.screenShare);
      this.screenShare = null;
    }
  }

  /**
   * Clean up.
   */
  dispose() {
    this.stopSharing();
  }

  /** WorldListener interface */
  added(vrObject) {
    if (vrObject.properties && vrObject.properties.screenName) {
      console.log("Added screencast", vrObject);
      this.vrObject = vrObject;
      this.sharing(true);
    }
  }

  /** WorldListener interface */
  removed(vrObject) {
    if (vrObject.properties && vrObject.properties.screenName) {
      console.log("Removed screencast", vrObject);
      this.sharing(false);
      this.vrObject = null;
    }
  }

  /** Called when sharing starts/stops (shared object is added/removed), executes callback */
  sharing(state) {
    if (this.callback) {
      this.callback(state);
    }
  }
}