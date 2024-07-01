/**
Basic script object. Scripts are loaded and instantiated when server demands it.
Experimental, most likely to change a lot, more towards IOC.
 */
export class BasicScript {
  /** 
  @param world the World this script runs in, contains babylon scene, WorldManager and everything else
  @param vrObject VRObject added tot he scene.. 
   */
  constructor( world, vrObject ) {
    this.world = world;
    this.scene = world.scene;
    this.worldManager = world.worldManager;
    this.VRSPACE = this.worldManager.VRSPACE;
    this.vrObject = vrObject;
    this.vrObject.attachedScript = this;
    this.vrObject.addListener((obj,changes)=>this.remoteChange(this.vrObject,changes));
  }
  /**
  Supposed to create a visible object and return root node
   */
  init() {
    return null;
  }

  /**
   * Executed when a remote change is triggerred. Changes have been already applied to the object.
  */  
  remoteChange(vrObject, changes) {
    console.log("Remote changes for "+vrObject.id, changes);
  }
  
  dispose() {
    console.log("Disposing of script", this.vrObject);
  }
  
  isMine() {
    return this.vrObject.properties && this.VRSPACE.me.id == this.vrObject.properties.clientId;
  }
}