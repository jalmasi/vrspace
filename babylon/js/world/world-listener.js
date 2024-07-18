/** 
Convenience class to make listening to world changes easier.
Add WorldListeners to a World, and WorldManager will notify them when world changes.
*/
export class WorldListener {
  constructor(){}
  /**
  Called when user enters the world.
  @param welcome Welcome message
  */
  entered(welcome) {}
  /**
  Called when a new object is added to the scene
  @param vrobject a VRObject, typically a Client, added to the scene.
   */
  added(vrobject){}
  /**
  Called when a new object is loaded.
  What that exactly means, depends on type of object - e.g. avatars are loaded differently than video streams.
  Actual mesh/avatar/etc is in vrobject, e.g. vrobject.container in case of general model.
  @param vrobject a VRObject, typically a Client, added to the scene.
   */
  loaded(vrobject){}
  /**
  Called when an object is removed from the scene
  @param vrobject a VRObject, typically a Client, removed from the scene
   */
  removed(vrobject){}
}