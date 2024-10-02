export class VisibilitySensor {
  constructor(world) {
    this.world = world;
    this.scene = world.scene;
  }
  
  isVisible( target, confidence=1 ) {
    let ret = 0;
    let camera = this.scene.activeCamera;
    if (camera.isInFrustum(target)) {
      // center
      if (this.isClosestMesh(camera, target.position)) {
        ret++;
      }
      if ( ret < confidence ) {
        // bounding box - slow
        let bBox = target.getHierarchyBoundingVectors();
        let points = [
          new BABYLON.Vector3(bBox.min.x, bBox.min.y, bBox.min.z),
          new BABYLON.Vector3(bBox.min.x, bBox.min.y, bBox.max.z),
          new BABYLON.Vector3(bBox.min.x, bBox.max.y, bBox.min.z),
          new BABYLON.Vector3(bBox.min.x, bBox.max.y, bBox.max.z),
          new BABYLON.Vector3(bBox.max.x, bBox.min.y, bBox.min.z),
          new BABYLON.Vector3(bBox.max.x, bBox.min.y, bBox.max.z),
          new BABYLON.Vector3(bBox.max.x, bBox.max.y, bBox.min.z),
          new BABYLON.Vector3(bBox.max.x, bBox.max.y, bBox.max.z)
        ]
        for ( let i = 0; ret<confidence && i < points.length; i++ ) {
          if (this.isClosestMesh(camera, point)) {
            ret++;
          }
        }
      }
    }
    return ret>=confidence;
  }
  
  isClosestMesh(camera, point) {
    // CHECKME: direction relative?
    let direction = point; // - camera.position
    // center
    let ray = new BABYLON.Ray(camera.position,direction,camera.maxZ);
    let closest = this.scene.pickWithRay(ray);
    // we may need to examine parents here, with VRSPACEUI.findRootNode(target)
    return closest === target;
  }
  
  getVisibleAvatars(confidence=1) {
    let ret = [];
    for ( let vrObject of VRSPACE.getScene().values() ) {
      if ( typeof vrObject.avatar != "undefined" && this.isVisible(vrObject.avatar.baseMesh(), confidence)) {
        ret.push(vrObject.avatar);
      }
    }
    return ret;
  }
  
  getVisibleObjects(confidence=1) {
    let ret = [];
    this.scene.rootNodes.forEach( (node) => {
      if ( typeof node.vrObject != "undefined" && this.isVisible(node, confidence)) {
        ret.push(node);
      }
    });
    return ret;
  }
  
  getVisibleOf(list, confidence=1) {
    let ret = [];
    list.forEach( (node) => {
      if ( this.isVisible(node, confidence)) {
        ret.push(node);
      }
    });
    return ret;
  }
}