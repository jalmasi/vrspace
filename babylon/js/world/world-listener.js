/** 
Convenience class to make listening to world changes easier.
Add WorldListeners to a World, and WorldManager will notify them when world changes.
*/
export class WorldListener {
  constructor(){}
  /**
  Called when user enters the world.
  @param {Welcome} welcome Welcome message
  */
  entered(welcome) {}
  /**
  Called when a new object is added to the scene
  @param {VRObject} vrobject a VRObject, typically a User, added to the scene.
   */
  added(vrobject){}
  /**
  Called when a new object is loaded.
  What that exactly means, depends on type of object - e.g. avatars are loaded differently than video streams.
  Actual mesh/avatar/etc is in vrobject, e.g. vrobject.container in case of general model.
  @param {VRObject} vrobject a VRObject, typically a User, added to the scene.
  @param mesh Root mesh created by the loader
   */
  loaded(vrobject, mesh){}
  /**
   * Called when load fails
   * @param {VRObject} vrobject that failed to load
   */
  loadError(vrobject){}
  /**
  Called when an object is removed from the scene
  @param {VRObject} vrobject a VRObject, typically a User, removed from the scene
   */
  removed(vrobject){}
}