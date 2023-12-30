import {VRSPACEUI} from './vrspace-ui.js';

/**
Default progress indicator: rotating vrspace.org logo, 30 cm ahead, 5 cm below camera.
Always bounds to active camera, to ensure same look and function on PC, mobile and VR devices.
 */
export class LoadProgressIndicator {
  /** Initializes VRSpaceUI, loading logo geometry so it can be reused.
  Installs active camera listener on the scene.
  @param scene
  @param camera current camera to bind to
   */
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.mesh = null;
    this.totalItems = 0;
    this.currentItem = 0;
    this.zeroRotation = null;
    this.angle = Math.PI;
    /** Debug log flag */
    this.debug = false;
    /** Whether progress of individual items should be tracked.
    Default true rotates the logo only when an item loads.
    False results in continous rotation.
    */
    this.trackItems = true;
    var indicator = this;
    VRSPACEUI.init(scene).then( (ui) => {
        indicator.mesh = ui.logo.clone("LoadingProgressIndicator");
        indicator.mesh.scaling.scaleInPlace(0.05);
        indicator.attachTo( indicator.camera );
        indicator.zeroRotation = new BABYLON.Quaternion.RotationAxis(BABYLON.Axis.X,-Math.PI/2);
        indicator.mesh.rotationQuaternion = indicator.zeroRotation;
        indicator.mesh.setEnabled(indicator.totalItems > indicator.currentItem);
        indicator.log("Loaded logo, current progress "+indicator.currentItem+"/"+indicator.totalItems);
    });
    this.scene.onActiveCameraChanged.add( () => {
      if ( this.scene.activeCamera ) {
        //console.log("Camera changed: "+this.scene.activeCamera.getClassName());
        this.attachTo(camera); // FIXME undefined
      }
    });
  }
  _init() {
    this.totalItems = 0;
    this.currentItem = 0;
    this.angle = Math.PI;
  }
  attachTo(camera) { // FIXME not used
    this.camera = this.scene.activeCamera;
    if ( this.mesh ) {
      this.mesh.parent = this.scene.activeCamera;
      // VRDeviceOrientationFreeCamera
      // WebXRCamera
      if ( this.scene.activeCamera.getClassName() == 'WebXRCamera' ) {
        this.mesh.position = new BABYLON.Vector3(0,-0.2,0.5);
      } else {
        this.mesh.position = new BABYLON.Vector3(0,-0.1,0.5);
      }
    }
  }
  /** Add an item to be tracked. First item added shows the indicator and starts the animation.
  @param item an item to track
   */
  add(item) {
    if ( this.mesh && ! this.mesh.isEnabled() ) {
      this.mesh.setEnabled(true);
    }
    this.totalItems++;
    this.log("Added "+this.currentItem+"/"+this.totalItems);
    this._update();
  }
  /** Remove an item, e.g. loaded file. Last item removed stops the animation and hides the indicator.
  @param item to remove
   */
  remove(item) {
    this.currentItem++;
    this._update();
    this.log("Finished "+this.currentItem+"/"+this.totalItems);
    if ( this.totalItems <= this.currentItem && this.mesh ) {
      this.mesh.setEnabled(false);
      if ( this.animation ) {
        this.scene.unregisterBeforeRender(this.animation);
        delete this.animation;
      }
      this._init();
    }
  }
  /** Stops tracking individual items and runs contionous animation */
  animate() {
    this.trackItems = false;
    this.animation = () => { this._update() };
    this.scene.registerBeforeRender( this.animation );
  }
  /** 
  Call on load progress event.
  @param evt progress event
  @param item related item 
  */
  progress(evt, item) {
    this.trackItems = false;
    if (evt.lengthComputable) {
      var loaded = evt.loaded / evt.total;
      this.log("Loaded "+(loaded*100)+"%");
      if ( this.mesh && this.zeroRotation ) {
        this.angle += 0.01;
        this.mesh.rotationQuaternion = this.zeroRotation.multiply( new BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y,this.angle) );
      }
    } else {
      var dlCount = evt.loaded / (1024 * 1024);
      this.log("Loaded "+dlCount+" MB" );
    }
  }
  _update() {
    if ( this.mesh && this.zeroRotation ) {
      if ( this.trackItems ) {
        this.angle = Math.PI*(1+this.currentItem/this.totalItems);
      } else {
        this.angle += 0.01;
      }
      this.mesh.rotationQuaternion = this.zeroRotation.multiply( new BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y,this.angle) );
    }
  }
  log(something) {
    if ( this.debug ) {
      console.log(something);
    }
  }
}

