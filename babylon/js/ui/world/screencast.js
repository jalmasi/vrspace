import { OpenViduStreams } from '../../core/media-streams.js';
import { ImageArea } from '../widget/image-area.js';

/**
 * Base screen sharing class. Uses ImageArea to play a video stream.
 * Using should be simple - construct and init. All methods except startSharing/stopSharing are internally called,
 * intended to be overridden by subclasses.
 */
export class Screencast {
  /**
   * Creates but hides meshes.
   * 
   * @param world the world
   * @param name screen share name, displayed when sharing. Defaults to user name or id.
   */
  constructor(world, name="Shared screen") {
    /** text to display on the share screen button, by default Share screen */
    this.text = 'Share screen';
    this.world = world;
    this.scene = world.scene;
    this.name = name;
    
    this.size = 3;
    this.addHandles = false;
    this.position = new BABYLON.Vector3(0, 3, 0);
    this.rotation = new BABYLON.Vector3(0, Math.PI, 0);
    
    this.sceneEventHandler = sceneEvent => this.handleSceneEvent(sceneEvent);
    this.listeners = [];
    /** Contains VRObject used to exchange screens share messages */
    this.screenShare = null;
  }

  /**
  Initialize the sharing component. Requires functional WorldManager attached to the world,
  so is safe to call from World.entered() method, or after it has been called.
   */  
  init() {
    this.worldManager = this.world.worldManager;
    this.setupStreaming();
  }

  /**
   * Called from init(). Attaches itself to MediaStreams, creates new MediaStreams if required.
   * Registers handleSceneEvent() as a SceneListener with WorldManager.
  */
  setupStreaming() {
    let client = this.worldManager.VRSPACE.me;
    if ( ! this.worldManager.mediaStreams ) {
      this.worldManager.mediaStreams = new OpenViduStreams(this.scene, 'videos');
      this.worldManager.pubSub(client, false); // audio only
    }
    this.worldManager.mediaStreams.playStream = ( client, mediaStream ) => {
      console.log('mapping incoming screen share of '+client.id+" to ",this.screenShare);
      if ( this.screenShare && client.id == this.screenShare.properties.clientId ) {
        this.imageArea.loadStream(mediaStream);
      }
    }
    //this.worldManager.debug = true;
    // this gets triggers whenever any client receives any new VRobject
    this.worldManager.VRSPACE.addSceneListener( this.sceneEventHandler );
  }
  
  /**
   * Starts the screencast: creates new shared VRObject, and calls MediaStreams.shareScreen().
   */
  startSharing() {
    let client = this.worldManager.VRSPACE.me;
    let screenName = this.name;
    if ( ! screenName ) {
      if ( client.name ) {
        screenName = client.name;
      } else {
        screenName = 'u'+client.id;
      }
    }
    this.worldManager.VRSPACE.createSharedObject({
      properties:{ screenName:screenName, clientId: client.id },
      active:true
    }, (obj)=>{
      console.log("Created new VRObject", obj);
      this.worldManager.mediaStreams.shareScreen(()=>{
        // end callback, executed when user presses browser stop share button
        this.deleteSharedObject();
      }).then((mediaStream)=>{
        console.log("streaming",mediaStream);
        this.imageArea.loadStream(mediaStream);
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
    this.worldManager.mediaStreams.stopSharingScreen();
  }

  /**
   * Handle a scene event. If a screen share object has been added, calls this.show().
   * If removed, calls hide().
   */
  handleSceneEvent(sceneEvent) {
    //console.log(sceneEvent);
    // identify the object
    if ( sceneEvent.added && sceneEvent.added.properties && sceneEvent.added.properties.screenName) {
      // keep the reference, share the event when touched on
      this.screenShare = sceneEvent.added;
      this.show(sceneEvent);
    } else if ( sceneEvent.removed && this.screenShare && sceneEvent.removed.id == this.screenShare.id) {
      console.log("Screen share removed");
      this.screenShare = null;
      this.hide(sceneEvent);
    }
  }
  
  /**
   * Create and show an ImageArea.
   * @param sceneEvent Event that starts screen sharing, most important is sceneEvent.added.properties.screenName property.
   */
  show(sceneEvent) {
    this.imageArea = new ImageArea(this.scene, "ScreencastArea");
    this.imageArea.size = this.size;
    this.imageArea.addHandles = this.addHandles;
    this.imageArea.position = this.position;
    this.imageArea.group.rotation = this.rotation;
    this.imageArea.show();
    this.listeners.forEach(listener=>listener(true));
  }

  /**
   * Dispose of ImageArea.
   */
  hide(sceneEvent) {
    this.imageArea.dispose();
    this.listeners.forEach(listener=>listener(false));
  }  
  
  /**
   * Internally used to delete the shared object.
   */
  deleteSharedObject() {
    if ( this.screenShare ) {
      this.worldManager.VRSPACE.deleteSharedObject(this.screenShare);
    }
  }

  /**
   * Clean up.
   */
  dispose() {
    this.stopSharing();
    this.hide();
    this.worldManager.VRSPACE.removeSceneListener( this.sceneEventHandler );
    //this.deleteSharedObject();
  }
}