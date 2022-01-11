import {VRSPACEUI} from './vrspace-ui.js';
/** 
Wrapper around BabylonJS XR/VR classes, whatever is available in current browser, if any.
Attached to a World, places the world mesh somewhere in real world TODO
 */
export class ARHelper {
  /**
  @param world attaches the control to the World
   */
  async initXR(world) {
    this.world = world;
    this.createMarker();
    this.world.scene.createDefaultXRExperienceAsync({
      // ask for an ar-session
      uiOptions: {
        sessionMode: "immersive-ar",
      },
      optionalFeatures: true      
    }).then(xr=>{
      if ( xr && xr.baseExperience ) {
        this.featuresManager = xr.baseExperience.featuresManager;
        this.hitTest = this.featuresManager.enableFeature(BABYLON.WebXRHitTest, "latest");
        this.anchorSystem = this.featuresManager.enableFeature(BABYLON.WebXRAnchorSystem, "latest");
    
        //this.createMarker();    
        this.tracker = (results) => {
          if (this.tracking && results.length) {
            var hitTest = results[0];
            hitTest.transformationMatrix.decompose(this.marker.scaling, this.marker.rotationQuaternion, this.marker.position);
          } else {
            //marker.isVisible = false;
          }
        };
        this.hitTest.onHitTestResultObservable.add(this.tracker);
        this.startTracking();
      } else {
        console.log("XR unavailable");
      }

    });
    return this;
  }
  startTracking() {
    if (this.anchor) {
      this.anchor.attachedNode = null;
      //this.anchor.remove(); // HANGS
      this.anchor = null;
    }
    this.tracking = true;
  }
  async placeMarker() {
    //const anchorPromise = anchorSystem.addAnchorPointUsingHitTestResultAsync(lastHitTest);
    this.anchorSystem.addAnchorAtPositionAndRotationAsync(this.marker.position, this.marker.rotationQuaternion);
    this.anchorSystem.onAnchorAddedObservable.add((anchor) => {
      anchor.attachedNode = this.marker;
      this.anchor = anchor;
    });
    this.tracking = false;
  }
  createMarker() {
    this.marker = new BABYLON.TransformNode("Marker", this.world.scene);
    this.logo = VRSPACEUI.copyMesh(VRSPACEUI.logo, this.marker);
    this.logo.scaling = new BABYLON.Vector3(0.2, 0.2, 0.2);
    this.logo.rotation = new BABYLON.Vector3(0,0,0);
    this.marker.rotationQuaternion = new BABYLON.Quaternion();
  }
}