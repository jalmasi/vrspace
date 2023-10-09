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
  Called when an object is removed from the scene
  @param vrobject a VRObject, typically a Client, removed from the scene
   */
  removed(vrobject){}
}