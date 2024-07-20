import { OpenViduStreams } from '../../core/media-streams.js';
import { WorldListener } from '../../world/world-listener.js';

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
  constructor(world, name="Shared screen") {
    super();
    /** text to display on the share screen button, by default Share screen */
    this.text = 'Share screen';
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
    this.callback = null;
  }

  /**
  Initialize the sharing component. Requires functional WorldManager attached to the world,
  so is safe to call from World.entered() method, or after it has been called.
   */  
  init() {
    this.worldManager = this.world.worldManager;
    this.world.addListener(this);
    this.setupStreaming();
  }

  /**
   * Called from init(). Attaches itself to MediaStreams, creates new MediaStreams if required.
   * Registers handleSceneEvent() as a SceneListener with WorldManager.
  */
  setupStreaming() {
    this.client = this.worldManager.VRSPACE.me;
    if ( ! this.worldManager.mediaStreams ) {
      this.worldManager.mediaStreams = new OpenViduStreams(this.scene, 'videos');
      this.worldManager.pubSub(this.client, false); // audio only
    }
  }
  
  /**
   * Starts the screencast: creates new shared VRObject, and calls MediaStreams.shareScreen().
   */
  startSharing() {
    let screenName = this.name;
    if ( ! screenName ) {
      if ( this.client.name ) {
        screenName = this.client.name;
      } else {
        screenName = 'u'+this.client.id;
      }
    }

    this.worldManager.VRSPACE.createScriptedObject({
      properties:{ screenName:screenName, type: "Screencast", clientId: this.client.id, size:this.size, addHandles:this.addHandles },
      active:true,
      script:'/babylon/js/scripts/remote-screen.js',
      position: {x: this.position.x, y: this.position.y, z: this.position.z},
      rotation: {x: this.rotation.x, y: this.rotation.y, z: this.rotation.z}
    }).then(obj=>{
      this.screenShare = obj;
      console.log("Created new VRObject", obj);
      this.worldManager.mediaStreams.shareScreen(()=>{
        // end callback, executed when user presses browser stop share button
        this.deleteSharedObject();
      }).then((mediaStream)=>{
        console.log("streaming",mediaStream);
        // imageArea is created by scene event handler
        //this.imageArea.loadStream(mediaStream);
        obj.attachedScript.playStream(mediaStream);
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
   * Internally used to delete the shared object.
   */
  deleteSharedObject() {
    if ( this.screenShare ) {
      this.worldManager.VRSPACE.deleteSharedObject(this.screenShare);
      this.screenShare = null;
    }
  }

  /**
   * Clean up.
   */
  dispose() {
    this.stopSharing();
    //this.deleteSharedObject();
  }
  
  added(vrObject){
    if ( vrObject.properties && vrObject.properties.screenName ) {
      this.sharing(true);
    }    
  }
  
  removed(vrObject){
    if ( vrObject.properties && vrObject.properties.screenName ) {
      this.sharing(false);
    }
  }
  
  sharing(state) {
    if ( this.callback ) {
      this.callback(state);
    }
  }
}