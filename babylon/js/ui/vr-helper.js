/** 
Wrapper around BabylonJS XR/VR classes, whatever is available in current browser, if any.
Attached to a World, uses World floor meshes and camera.
 */
export class VRHelper {
  /**
  @param world attaches the control to the World
   */
  async initXR(world) {
    this.world = world;
    var xrHelper = this.vrHelper;
    if ( this.vrHelper ) {
      console.log("VR helper already intialized");
      this.addFloors();
    } else {
      try {
        xrHelper = await this.world.scene.createDefaultXRExperienceAsync({floorMeshes: this.world.getFloorMeshes()});        
      } catch ( err ) {
        console.log("Can't init XR:"+err);
      }
    }

    if (xrHelper && xrHelper.baseExperience) {
      console.log("Using XR helper");
      this.vrHelper = xrHelper;

      // updating terrain after teleport
      if ( this.movementObserver ) {
        // remove existing teleportation observer
        xrHelper.baseExperience.sessionManager.onXRReferenceSpaceChanged.remove( this.movementObserver );
      }
      this.movementObserver = () => { this.afterTeleportation() };
      xrHelper.baseExperience.sessionManager.onXRReferenceSpaceChanged.add( this.movementObserver );

      if ( !this.initialPoseObserver ) {
        this.initialPoseObserver = (xrCamera) => {
          // TODO restore this after exit VR
          xrCamera.position.y = this.world.camera.position.y - this.world.camera.ellipsoid.y*2;
        };
        xrHelper.baseExperience.onInitialXRPoseSetObservable.add( this.initialPoseObserver ); 
      }

      if ( this.tracker ) {
        this.stopTracking();
      }
      this.tracker = () => this.trackXrDevices();
      
      if ( !this.stateChangeObserver ) {
        this.stateChangeObserver = (state) => {
          console.log( "State: "+state );
          switch (state) {
            case BABYLON.WebXRState.IN_XR:
              // XR is initialized and already submitted one frame
              console.log( "Entered VR" );
              this.userHeight = this.camera().realWorldHeight;
              this.startTracking();
              // Workaround for teleporation/selection bug
              xrHelper.teleportation.setSelectionFeature(null);
              this.world.inXR = true;
              break;
            case BABYLON.WebXRState.ENTERING_XR:
              // xr is being initialized, enter XR request was made
              console.log( "Entering VR" );
              this.world.collisions(false);
              break;
            case BABYLON.WebXRState.EXITING_XR:
              console.log( "Exiting VR" );
              this.stopTracking();
              this.world.camera.position = this.camera().position.clone();
              this.world.camera.rotation = this.camera().rotation.clone();
              // doesn't do anything
              //camera.position.y = xrHelper.baseExperience.camera.position.y + 3; //camera.ellipsoid.y*2;
              this.world.collisions(this.world.collisionsEnabled);
              this.world.inXR = false;
              break;
            case BABYLON.WebXRState.NOT_IN_XR:
              console.log( "Not in VR" );
              this.world.attachControl();
              this.world.scene.activeCamera = this.world.camera;
              // self explanatory - either out or not yet in XR
              break;
          }
        };
        xrHelper.baseExperience.onStateChangedObservable.add(this.stateChangeObserver);
      }

      // CHECKME: really ugly way to make it work
      this.world.scene.pointerMovePredicate = (mesh) => {
        return this.world.isSelectableMesh(mesh);
      };
      xrHelper.pointerSelection.raySelectionPredicate = (mesh) => {
        return this.world.isSelectableMesh(mesh);
      };

      xrHelper.teleportation.rotationEnabled = false; // CHECKME
      //xrHelper.teleportation.parabolicRayEnabled = false; // CHECKME

      if ( !this.controllerObserver ) {
        this.controllerObserver = (xrController) => {
          console.log("Controller added: "+xrController.grip.name+" "+xrController.grip.name);
          console.log(xrController);
          if ( xrController.grip.id.toLowerCase().indexOf("left") >= 0 || xrController.grip.name.toLowerCase().indexOf("left") >=0 ) {
            this.leftController = xrController;
          } else if (xrController.grip.id.toLowerCase().indexOf("right") >= 0 || xrController.grip.name.toLowerCase().indexOf("right") >= 0) {
            this.rightController = xrController;
          } else {
            log("ERROR: don't know how to handle controller");
          }
        };
        xrHelper.input.onControllerAddedObservable.add(this.controllerObserver);
      }
      
      
    } else {
      // obsolete and unsupported TODO REMOVEME
      this.vrHelper = this.world.scene.createDefaultVRExperience({createDeviceOrientationCamera: false });
      //vrHelper.enableInteractions();
      this.vrHelper.webVRCamera.ellipsoid = new BABYLON.Vector3(.5, 1.8, .5);
      this.vrHelper.onEnteringVRObservable.add(()=>{this.world.collisions(false)});
      this.vrHelper.onExitingVRObservable.add(()=>{this.world.collisions(this.world.collisionsEnabled);});

      this.vrHelper.enableTeleportation({floorMeshes: this.world.getFloorMeshes(this.world.scene)});
      this.vrHelper.raySelectionPredicate = (mesh) => {
        return this.world.isSelectableMesh(mesh);
      };
      
      this.vrHelper.onBeforeCameraTeleport.add((targetPosition) => {
        this.world.camera.globalPosition.x = targetPosition.x;
        this.world.camera.globalPosition.y = targetPosition.y;
        this.world.camera.globalPosition.z = targetPosition.z;
        if ( this.world.terrain ) {
          this.world.terrain.update(true);
        }
      });
      
    }
    
    console.log("VRHelper initialized", this.vrHelper);
  }
  
  afterTeleportation() {
    var targetPosition = this.vrHelper.baseExperience.camera.position;
    this.world.camera.globalPosition.x = targetPosition.x;
    this.world.camera.globalPosition.y = targetPosition.y;
    this.world.camera.globalPosition.z = targetPosition.z;
    if ( this.world.terrain ) {
      this.world.terrain.update(false);
    }
    // TODO we can modify camera y here, adding terrain height on top of ground height
  }
  trackXrDevices() {
    // user height has to be tracked here due to
    //XRFrame access outside the callback that produced it is invalid
    this.userHeight = this.camera().realWorldHeight;
    this.world.trackXrDevices();
  }
  startTracking() {
    this.world.scene.registerBeforeRender(this.tracker);
  }
  stopTracking() {
    this.world.scene.unregisterBeforeRender(this.tracker);
  }
  leftArmPos() {
    return this.leftController.grip.absolutePosition;
  }
  rightArmPos() {
    return this.rightController.grip.absolutePosition;
  }
  leftArmRot() {
    return this.leftController.pointer.rotationQuaternion;
  }
  rightArmRot() {
    return this.rightController.pointer.rotationQuaternion;
  }
  realWorldHeight() {
    return this.userHeight;
  }
  camera() {
    return this.vrHelper.input.xrCamera;
  }
  addFloorMesh(mesh) {
    if ( this.vrHelper && this.vrHelper.teleportation && mesh) {
      // do not add a floor twice
      this.vrHelper.teleportation.removeFloorMesh(mesh);
      this.vrHelper.teleportation.addFloorMesh(mesh);
    }
  }
  removeFloorMesh(mesh) {
    if ( this.vrHelper && this.vrHelper.teleportation) {
      this.vrHelper.teleportation.removeFloorMesh(mesh);
    }
  }
  raySelectionPredicate(predicate) {
    var ret = this.vrHelper.pointerSelection.raySelectionPredicate;
    if ( predicate ) {
      this.vrHelper.pointerSelection.raySelectionPredicate = predicate;
    }
    return ret;
  }
  clearFloors() {
    for ( var i = 0; i < this.world.getFloorMeshes().length; i++ ) {
      this.removeFloorMesh(this.world.getFloorMeshes()[i]);
    }
  }
  addFloors() {
    for ( var i = 0; i < this.world.getFloorMeshes().length; i++ ) {
      this.addFloorMesh(this.world.getFloorMeshes()[i]);
    }
  }
}

