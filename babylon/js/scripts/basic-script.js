/**
Basic script object. Scripts are loaded and instantiated when server demands it.
Experimental, most likely to change a lot, more towards IOC.
 */
export class BasicScript {
  /** 
  @param world the World this script runs in, contains babylon scene, WorldManager and everything else
   */
  constructor( world, vrObject ) {
    this.world = world;
    this.scene = world.scene;
    this.worldManager = world.worldManager;
    this.VRSPACE = this.worldManager.VRSPACE;
    this.vrObject = vrObject;
  }
  /**
  Supposed to create a visible object and return root node
   */
  init() {
    return null;
  }
}