import { World } from "./world.js";
import { VRSPACE } from "../client/vrspace.js";
import { VRSPACEUI } from "../ui/vrspace-ui.js";

export class VisibilitySensor {
  constructor(world = World.lastInstance) {
    this.world = world;
    this.scene = world.scene;
  }
  
  dispose() {
  }
  
  isVisible( target, confidence=1, offset=BABYLON.Vector3(0,0,0) ) {
    //console.log("isVisible "+target.name+" confidence "+confidence+" offset "+offset);
    let ret = 0;
    let camera = this.scene.activeCamera;
    if (camera.isInFrustum(target)) {
      // center
      if (this.isClosestMesh(camera, target, target.position.add(offset))) {
        ret++;
      }
      if ( ret < confidence ) {
        // bounding box - slow
        let bBox = target.getHierarchyBoundingVectors();
        let height = bBox.max.y - bBox.min.y;
        let points = [
          // TODO additional points to check
          // we could use positions of head, shoulders, arms, legs etc here
          // at the moment, just approximate the center
          new BABYLON.Vector3(target.position.x, target.position.y+height*.5, target.position.z)
        ]
        for ( let i = 0; ret<confidence && i < points.length; i++ ) {
          if (this.isClosestMesh(camera, target, points[i])) {
            ret++;
          }
        }
      }
    }
    return ret>=confidence;
  }
  
  isClosestMesh(camera, mesh, point) {
    let direction = point.subtract(camera.position).normalize();
    let ray = new BABYLON.Ray(camera.position,direction,camera.maxZ);
    let closest = this.scene.pickWithRay(ray);
    //if ( closest && closest.hit ) {
      //console.log("Picked "+closest.pickedMesh.name+" root "+VRSPACEUI.findRootNode(closest.pickedMesh).name+ " at "+point+" distance "+closest.distance);
    //}
    return closest && closest.hit && (closest.pickedMesh === mesh || mesh === VRSPACEUI.findRootNode(closest.pickedMesh));
  }
  
  getVisibleAvatars(confidence=1) {
    let ret = [];
    for ( let vrObject of VRSPACE.getScene().values() ) {
      if ( typeof vrObject.avatar != "undefined" && this.isVisible(vrObject.avatar.baseMesh(), confidence, new BABYLON.Vector3(0,vrObject.avatar.userHeight*.5,0))) {
        //console.log( "Visible: "+vrObject.id+" "+vrObject.avatar.name);
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