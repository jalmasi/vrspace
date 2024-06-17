import { Avatar } from "./avatar.js";

/**
 * Avatar that is not humanoid but some other 3d model.
 */
export class MeshAvatar extends Avatar {
  constructor(scene, vrObject) {
    super(scene);
    this.vrObject = vrObject;
    this.name = vrObject.name;
    this.mesh = null;
    this.textOffset = 0.2;
  }
  
  getUrl() {
    return this.vrObject.mesh;
  }
  
  baseMesh() {
    return this.mesh;
  }

  basePosition() {
    return new BABYLON.Vector3(this.mesh.position.x, this.mesh.position.y, this.mesh.position.z);
  }

  dispose() {
    // no need to do anything - WorldManager calls unloadObject
  }

}