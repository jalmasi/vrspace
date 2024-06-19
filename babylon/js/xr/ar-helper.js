import {VRSPACEUI} from '../ui/vrspace-ui.js';
/** 
Wrapper around BabylonJS XR/VR classes, whatever is available in current browser, if any.
Attached to a World, places the world mesh somewhere in real world TODO
 */
export class ARHelper {
  /**
  @param world attaches the control to the World
   */
  async initXR(world, enter) {
    this.world = world;
    this.createMarker();
    this.world.scene.createDefaultXRExperienceAsync({
      // ask for an ar-session
      uiOptions: {
        sessionMode: "immersive-ar",
        referenceSpaceType: "unbounded"
      },
      optionalFeatures: true
    }).then( xr => {
      this.xr = xr;
      if ( this.xr && this.xr.baseExperience ) {
        console.log("Available WebXR features: "+BABYLON.WebXRFeaturesManager.GetAvailableFeatures());
        // we can also test if ar/vr is available with WebXRSessionManager.IsSessionSupportedAsync
        // https://doc.babylonjs.com/typedoc/classes/BABYLON.WebXRSessionManager#IsSessionSupportedAsync
        ["immersive-vr","immersive-ar","inline"].forEach(mode=>{
          BABYLON.WebXRSessionManager.IsSessionSupportedAsync(mode).then(isSupported => {
            console.log("XRMode "+mode+" available: "+isSupported)
          })
        });
        console.log(this.xr);
        // xr.enterExitUI.overlay is div html element, class div.xr-button-overlay        
        // style.position contains absolute; left 20px; etc
        xr.enterExitUI.overlay.children[0].textContent="AR";
        xr.enterExitUI.overlay.style.cssText = xr.enterExitUI.overlay.style.cssText.replace("right","left");
        
        this.featuresManager = xr.baseExperience.featuresManager;
        this.hitTest = this.featuresManager.enableFeature(BABYLON.WebXRHitTest, "latest");
        this.anchorSystem = this.featuresManager.enableFeature(BABYLON.WebXRAnchorSystem, "latest");
  
        if ( enter ) {
          this.enterAR();
        }
    
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
  // This must be done within a user interaction e.g. button click
  async enterAR() {
    if ( this.xr && this.xr.baseExperience ) {
      return this.baseExperience.enterXRAsync("immersive-ar", "unbounded", this.xr.renderTarget);
    }
  }
  startTracking() {
    if (this.anchor) {
      this.anchor.attachedNode = null;
      //this.anchor.remove(); // HANGS
      this.anchor = null;
    }
    this.tracking = true;
    if ( this.world.worldManager ) {
      // CHECKME stop sending user position/rotation?
      this.world.worldManager.trackMesh();
    }
    console.log("tracking started");
  }
  async placeMarker() {
    if ( this.anchorSystem ) {
      this.anchorSystem.addAnchorAtPositionAndRotationAsync(this.marker.position, this.marker.rotationQuaternion);
      this.anchorSystem.onAnchorAddedObservable.add((anchor) => {
        anchor.attachedNode = this.marker;
        this.anchor = anchor;
      });
      this.tracking = false;
      if ( this.world.worldManager ) {
        // TODO start sending user position/rotation - needs to be recalculated
        this.world.worldManager.trackMesh(this.anchor);
      }
      console.log("Anchor placed");
    }
  }
  createMarker() {
    this.marker = new BABYLON.TransformNode("Marker", this.world.scene);
    this.logo = VRSPACEUI.copyMesh(VRSPACEUI.logo, this.marker);
    this.logo.scaling = new BABYLON.Vector3(0.2, 0.2, 0.2);
    this.logo.rotation = new BABYLON.Vector3(0,0,0);
    this.marker.rotationQuaternion = new BABYLON.Quaternion();
  }
  realWorldHeight() {
    return 1.8;
  }
}