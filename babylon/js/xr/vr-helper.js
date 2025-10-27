import { VRSPACEUI } from '../ui/vrspace-ui.js';
import { GamepadHelper } from '../ui/gamepad-helper.js';
import { World } from '../world/world.js';
/** 
Wrapper around BabylonJS XR/VR classes, whatever is available in current browser, if any.
Attached to a World, uses World floor meshes and camera.
Tracks available VR controllers and gamepad, and updates state variables.
As Babylon.js in XR mode doesn't make use of the gamepad, this implements necessary methods to make it useful,
ones that pass gamepad events to HUD and scene.
While this is mandatory to use gamepad in XR, it is also useful outside of XR, and is quite handy on mobiles.
CHECKME: SoC?
 */
export class VRHelper {
  static instances = {};
  static activeInstance = null;
  constructor(sessionMode = "immersive-vr") {
    /** Underlying babylon VR (obsolete) or XR helper (WebXRDefaultExperience) component */
    this.vrHelper = null;
    /** @type {World} */
    this.world = null;
    /** Function that tracks XR devices (headeset, controllers), calls this.trackXrDevices() */
    this.xrDeviceTracker = () => this.trackXrDevices();
    this.tracking = false;
    this.controller = { left: null, right: null };
    /** Function that tracks enter/exit VR */
    this.stateChangeObserver = null;
    /** Function that tracks turning XR controllers on/off */
    this.controllerObserver = null;
    /** left and right trigger values*/
    this.trigger = { left: 0, right: 0 };
    /** left and right squeeze values */
    this.squeeze = { left: 0, right: 0 };
    /** left and right thumbstick, if available */
    this.thumbstick = { left: null, right: null };
    /** left and right touchpad, if available */
    this.touchpad = { left: null, right: null };
    /** left and right buttons. */
    this.buttons = { left: [], right: [] };
    /** left and right thumb and index finger */
    this.hands = {
      left: { hand: null, thumb: null, index: null, middle: null, rotation: BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Z, -Math.PI / 2) },
      right: { hand: null, thumb: null, index: null, middle: null, rotation: BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Z, Math.PI / 2) }
    };
    /**
     * Near hover radius:
     * more than this, selection with ray,
     * less than this, selection with finger/controller touch
     * (babylonjs internal defaults to 10cm, we set it to 3cm)
     * https://github.com/BabylonJS/Babylon.js/blob/a1a76330a43a210c258c274d19ae736cc409752f/packages/dev/core/src/XR/features/WebXRNearInteraction.ts#L446 
     */
    this.nearHoverRadius = 0.03;
    /** Babylonjs internal, defaults to 2cm, set to 1cm here */
    this.nearPickRadius = 0.01;

    this.squeezeConsumers = [];
    this.triggerListeners = [];
    this.activeController = "none";
    this.teleporting = false;
    this.sessionMode = sessionMode;
    this.userHeight = 1.8;
    this.timeToTeleport = 1000;
    /** or NONE, or SLIDE */
    this.movementMode = "TELEPORT";
    console.log("New VRHelper " + sessionMode);
    if (this.constructor.instances[sessionMode]) {
      throw new Error("VRHelper " + sessionMode + " already exists");
    }
    this.constructor.instances[sessionMode] = this;
  }
  static getInstance(sessionMode = "immersive-vr") {
    let instance = VRHelper.instances[sessionMode];
    if (!instance) {
      instance = new VRHelper(sessionMode);
    }
    return instance;
  }
  /**
  @param {World} world attaches the control to the World
   */
  async initXR(world) {
    var xrHelper = this.vrHelper;
    if (this.vrHelper) {
      console.log("VR helper already intialized");
      if (this.world) {
        this.clearFloors();
      }
      this.world = world;
      this.addFloors();
    } else {
      this.world = world;
      try {
        xrHelper = await this.world.scene.createDefaultXRExperienceAsync({
          // ask for an ar-session
          uiOptions: {
            sessionMode: this.sessionMode,
            referenceSpaceType: "local-floor"
          },
          floorMeshes: this.world.getFloorMeshes(),
          teleportationOptions: {
            timeToTeleport: this.timeToTeleport
          }
        });
        // selection disallowed until controllers are initialized
        VRSPACEUI.hud.allowSelection = false;

        // xr.enterExitUI.overlay is div html element, class div.xr-button-overlay
        // contains a button of class babylonVRicon
        // we can manipulate their styles like 
        if (xrHelper.enterExitUI.overlay.children[0]) {
          if ("immersive-vr" == this.sessionMode) {
            xrHelper.enterExitUI.overlay.children[0].textContent = "VR";
            xrHelper.enterExitUI.overlay.style.cssText = xrHelper.enterExitUI.overlay.style.cssText
              .replace("right: 20px;", "right: 5px;")
              .replace("bottom: 50px;", "bottom: 5px");
          } else if ("immersive-ar" == this.sessionMode) {
            xrHelper.enterExitUI.overlay.children[0].textContent = "AR";
            xrHelper.enterExitUI.overlay.style.cssText = xrHelper.enterExitUI.overlay.style.cssText
              .replace("right: 20px;", "left: 5px;")
              .replace("bottom: 50px;", "bottom: 5px");
          }
        }

      } catch (err) {
        console.log("Can't init XR:" + err);
      }
    }

    if (xrHelper && xrHelper.baseExperience) {
      // WebXRDefaultExperience class
      console.log("Using XR helper");
      this.vrHelper = xrHelper;
      world.hasXR = true;

      // updating terrain after teleport
      if (this.movementObserver) {
        // remove existing teleportation observer
        xrHelper.baseExperience.sessionManager.onXRReferenceSpaceChanged.remove(this.movementObserver);
      }
      this.movementObserver = () => { this.afterTeleportation() };
      xrHelper.baseExperience.sessionManager.onXRReferenceSpaceChanged.add(this.movementObserver);

      if (!this.initialPoseObserver) {
        this.initialPoseObserver = (xrCamera) => {
          // TODO restore this after exit VR
          if (this.sessionMode == "immersive-vr") {
            // only in AR, this puts the camera to ground level, only on mobile
            xrCamera.position.y = this.world.camera.position.y - this.world.camera.ellipsoid.y * 2;
          }
        };
        xrHelper.baseExperience.onInitialXRPoseSetObservable.add(this.initialPoseObserver);
      }

      if (!this.stateChangeObserver) {
        this.stateChangeObserver = (state) => {
          console.log("State: " + state);
          switch (state) {
            case BABYLON.WebXRState.IN_XR:
              // XR is initialized and already submitted one frame
              console.log("Entered " + this.sessionMode);
              VRSPACEUI.hud.initXR(this);
              this.world.inAR = (this.sessionMode == "immersive-ar");
              this.world.inVR = (this.sessionMode == "immersive-vr");
              if (this.camera().realWorldHeight) {
                // are we absolutely sure that all mobiles deliver this value?
                this.userHeight = this.camera().realWorldHeight;
              }
              this.camera().setTransformationFromNonVRCamera(world.camera);
              this.startTracking();
              // Workaround for teleporation/selection bug
              xrHelper.teleportation.setSelectionFeature(null);
              this.world.enterXR();
              break;
            case BABYLON.WebXRState.ENTERING_XR:
              // xr is being initialized, enter XR request was made
              console.log("Entering " + this.sessionMode);
              this.world.xrHelper = this;
              VRHelper.activeInstance = this;
              this.enableBackground(false);
              this.world.collisions(this.world.collisionsEnabledInXR);
              // disable harmless warning on android:
              //const featureManager = this.vrHelper.baseExperience.featuresManager;
              //featureManager.disableFeature(BABYLON.WebXRFeatureName.HAND_TRACKING);
              break;
            case BABYLON.WebXRState.EXITING_XR:
              // CHECKME: this doesn't seem to be emitted?
              console.log("Exiting " + this.sessionMode);
              this.enableBackground(true);
              this.stopTracking();
              this.world.camera.position = this.camera().position.clone();
              this.world.camera.rotation = this.camera().rotation.clone();
              this.world.collisions(this.world.collisionsEnabled);
              this.world.inAR = false;
              this.world.inVR = false;
              break;
            case BABYLON.WebXRState.NOT_IN_XR:
              console.log("Exited " + this.sessionMode);
              this.stopTracking();
              this.world.camera.position = this.camera().position.clone();
              // CHECKME: use rotation quaternion instead?
              this.world.camera.rotation = this.camera().rotation.clone();
              this.world.collisions(this.world.collisionsEnabled);
              this.world.inAR = false;
              this.world.inVR = false;
              VRHelper.activeInstance = null;
              // all the above copied from previous case
              this.clearPointer();
              this.world.attachControl();
              this.world.scene.activeCamera = this.world.camera;
              this.world.exitXR();
              // self explanatory - either out or not yet in XR
              break;
          }
        };
        xrHelper.baseExperience.onStateChangedObservable.add(this.stateChangeObserver);
      }

      // CHECKME: really ugly way to make it work
      this.world.scene.pointerMovePredicate = (mesh) => {
        return this.isSelectableMesh(mesh);
      };
      xrHelper.pointerSelection.raySelectionPredicate = (mesh) => {
        return this.isSelectableMesh(mesh);
      };

      // WebXRMotionControllerTeleportation
      xrHelper.teleportation.rotationEnabled = false; // CHECKME
      //xrHelper.teleportation.teleportationEnabled = false; // test
      //xrHelper.teleportation.parabolicRayEnabled = false; // CHECKME

      if (!this.controllerObserver) {
        // actual class is WebXRInputSource
        this.controllerObserver = (xrController) => {
          if (xrController.grip) {
            console.log("Controller added: " + xrController.grip.name, xrController.inputSource.profiles);
            this.clearPointer();
            // right contrtoller seems to be active by default, do we have a way to know?
            this.activeController = "right";
            VRSPACEUI.hud.allowSelection = true;
            const side = this.getGripSide(xrController.grip);
            this.controller[side] = xrController;
            xrController.onMotionControllerInitObservable.add((motionController) => {
              console.log(side + ' motion controller: ' + motionController.profileId, motionController.getComponentIds());
              this.trackMotionController(motionController, side);
            });
            VRSPACEUI.hud.controllerAdded(xrController);
          } else if (xrController.inputSource.profiles && xrController.inputSource.profiles.includes("generic-touchscreen")) {
            console.log("Controller added: " + xrController.inputSource.profiles);
            // this happens in AR, touching something brings up teleportation
            this.touchTimestamp = Date.now();
          } else {
            // apparently grip can be null on mobile device(s)
            console.log("Cannot handle xr controller device, profiles: " + xrController.inputSource.profiles, xrController);
          }
        };
        xrHelper.input.onControllerAddedObservable.add(this.controllerObserver);
        xrHelper.input.onControllerRemovedObservable.add((xrController) => {
          console.log("Controller removed", xrController);
          if (xrController.inputSource.profiles && xrController.inputSource.profiles.includes("generic-touchscreen")) {
            if (this.touchTimestamp && Date.now() - this.touchTimestamp > 1000) {
              this.teleportForward();
              delete this.touchTimestamp;
            }
          } else {
            VRSPACEUI.hud.controllerRemoved(xrController);
          }
        });
        this.trackHands();
      }
    } else {
      // obsolete and unsupported TODO REMOVEME
      this.vrHelper = this.world.scene.createDefaultVRExperience({ createDeviceOrientationCamera: false });
      //vrHelper.enableInteractions();
      //this.vrHelper.webVRCamera.ellipsoid = new BABYLON.Vector3(.5, 1.8, .5); // removed in babylon6
      this.vrHelper.onEnteringVRObservable.add(() => {
        this.world.collisions(false);
        this.world.enterXR();
      });
      this.vrHelper.onExitingVRObservable.add(() => {
        this.world.collisions(this.world.collisionsEnabled);
        this.world.exitXR();
      });

      this.vrHelper.enableTeleportation({ floorMeshes: this.world.getFloorMeshes() });
      this.vrHelper.raySelectionPredicate = (mesh) => {
        return this.isSelectableMesh(mesh);
      };

      this.vrHelper.onBeforeCameraTeleport.add((targetPosition) => {
        this.world.camera.globalPosition.x = targetPosition.x;
        this.world.camera.globalPosition.y = targetPosition.y;
        this.world.camera.globalPosition.z = targetPosition.z;
        if (this.world.terrain) {
          this.world.terrain.refresh(true);
        }
      });

    }

    // we want to support gamepad on mobiles in both cases
    this.trackGamepad();

    //console.log("VRHelper initialized", this.vrHelper);
  }

  isSelectableMesh(mesh) {
    return VRSPACEUI.isSelectableMesh(mesh) || this.world.isSelectableMesh(mesh);
  }

  gamepadTrigger(state) {
    if (this.pickInfo) {
      // scene event
      if (state) {
        this.world.scene.simulatePointerDown(this.pickInfo);
      } else {
        this.world.scene.simulatePointerUp(this.pickInfo);
      }
    }
  }

  trackGamepad() {
    GamepadHelper.getInstance(this.world.scene).addConnectListener(connected => {
      let triggerCallback = (state) => this.gamepadTrigger(state);
      if (connected) {
        this.createPointer();
        // teleportation may be enabled with touch screen, so just in case 
        this.disableMovement();
        GamepadHelper.instance.addTriggerListener(triggerCallback);

        this.teleportTarget = new BABYLON.TransformNode("Teleport-target", this.scene);
        let teleportMesh = new BABYLON.MeshBuilder.CreatePlane("Teleport-mesh", { width: 1, height: 1 }, this.scene);
        teleportMesh.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;
        teleportMesh.material = new BABYLON.StandardMaterial('teleportTargetMaterial', this.scene);
        teleportMesh.material.emissiveColor = BABYLON.Color3.White();
        teleportMesh.material.disableLightning = true;
        teleportMesh.material.diffuseTexture = new BABYLON.Texture("/content/icons/download.png", this.scene);
        teleportMesh.position = new BABYLON.Vector3(0, 1, 0);
        teleportMesh.parent = this.teleportTarget;
        this.teleportTarget.setEnabled(false);
      } else {
        this.clearPointer();
        GamepadHelper.instance.removeTriggerListener(triggerCallback);
      }
    });

    GamepadHelper.instance.addAxisListener(direction => {
      switch (direction) {
        case 'left':
          this.changeRotation(-Math.PI / 8);
          break;
        case 'right':
          this.changeRotation(Math.PI / 8);
          break;
        case 'forward':
          this.teleportStart();
          break;
        case 'back':
          this.changePosition(-1);
          break;
        case 'none':
          this.teleportEnd();
          break;
        default:
          throw "Unknown gamepad event " + direction;
      }
    });
  }

  enableBackground(enabled) {
    console.log("background: " + this.sessionMode + " enabled: " + enabled);
    if ("immersive-ar" == this.sessionMode) {
      if (this.world.skyBox) {
        this.world.skyBox.setEnabled(enabled);
      }
      if (this.world.terrain) {
        this.world.terrain.setEnabled(enabled);
      }
      this.world.enableBackground(enabled);
    }
  }

  /**
   * Rotates the WebXRCamera by given angle
   */
  changeRotation(angle) {
    if (this.camera()) {
      BABYLON.Quaternion.FromEulerAngles(0, angle, 0).multiplyToRef(
        this.camera().rotationQuaternion,
        this.camera().rotationQuaternion
      );
    }
  }

  /**
   * Change position of WebXRCamera by given distance, i.e. moves forward or back
   */
  changePosition(distance) {
    if (this.camera()) {
      var forwardDirection = this.camera().getForwardRay(distance).direction;
      //this.camera().position = forwardDirection;
      this.camera().position.addInPlace(new BABYLON.Vector3(-forwardDirection.x, 0, -forwardDirection.z));
    }
  }

  teleportForward() {
    console.log("touch end", this.vrHelper.teleportation);
    // based on WebXRControllerTeleportation.ts
    const options = this.vrHelper.teleportation._options;
    if (options.teleportationTargetMesh && options.teleportationTargetMesh.isVisible) {
      this.camera().position.copyFrom(options.teleportationTargetMesh.position);
      this.camera().position.y += this.realWorldHeight();
    }
  }

  /**
   * Start of teleportation, when gampad stick is pressed forward.
   * Installs a ray caster into rendering loop, that moves teleportation destination marker around.
   */
  teleportStart() {
    if (this.teleporting || !this.world.inXR()) {
      return;
    }
    this.teleporting = true;
    this.teleportTarget.setEnabled(false);
    this.caster = () => {
      var ray = this.camera().getForwardRay(100);
      var pickInfo = this.world.scene.pickWithRay(ray, (mesh) => {
        return this.world.getFloorMeshes().includes(mesh);
      });
      if (pickInfo.hit) {
        this.teleportTarget.setEnabled(this.teleporting);
        this.teleportTarget.position = pickInfo.pickedPoint;
      }
    }
    this.world.scene.registerBeforeRender(this.caster);
  }

  /**
   * End of teleportation: moves the camera to the destination (this.teleportTarget) and cleans up.
   */
  teleportEnd() {
    if (this.camera() && this.teleporting) {
      this.world.scene.unregisterBeforeRender(this.caster);
      this.caster = null;
      this.teleporting = false;
      this.teleportTarget.setEnabled(false);
      this.camera().position = this.teleportTarget.position.add(new BABYLON.Vector3(0, this.userHeight, 0));
      this.afterTeleportation();
    }
  }

  trackMotionController(controller, side) {
    try {
      for (const prop in controller.components) {
        // WebXRControllerComponent
        let component = controller.components[prop];
        //console.log(side+' '+prop+' '+component.isButton()+' '+component.isAxes()+' '+component.type);
        if (component.isAxes()) {
          if (component.type == BABYLON.WebXRControllerComponent.TOUCHPAD_TYPE) {
            this.touchpad[side] = component;
          } else if (component.type == BABYLON.WebXRControllerComponent.THUMBSTICK_TYPE) {
            this.thumbstick[side] = component;
          } else {
            console.log("Unknown component type: " + component.type, component);
          }
          /*
          component.onAxisValueChangedObservable.add((pos)=>{
            console.log(side+' '+prop+" x="+pos.x+" y="+pos.y);
          });
          */
        } else if (component.isButton()) {
          // buttons can give values 0,1 or anywhere in between
          if (component.type == BABYLON.WebXRControllerComponent.TRIGGER_TYPE) {
            // TODO: make this removable
            component.onButtonStateChangedObservable.add((c) => {
              this.triggerTracker(controller, c.value, side);
            });
          } else if (component.type == BABYLON.WebXRControllerComponent.SQUEEZE_TYPE) {
            // TODO: make this removable
            component.onButtonStateChangedObservable.add((c) => {
              this.squeezeTracker(c.value, side, this.controller[side].grip);
            });
          } else if (component.type == BABYLON.WebXRControllerComponent.BUTTON_TYPE) {
            this.buttons[side].push(component);
          } else {
            console.log("Unknown component type: " + component.type, component);
          }
        } else {
          console.log("Don't know how to handle component", component);
        }
      };
    } catch (error) {
      console.log('ERROR ' + error);
    }
  }

  /**
   * Track thumbsticks on VR controllers. Thumbsticks are used for teleporatation by default,
   * so this may be useful when teleporation is disabled.
   * @param callback function to call when thumbsticks change, passed position (x,y) and side (left/right)
   */
  trackThumbsticks(callback) {
    if (this.thumbstick.left) {
      this.thumbstick.left.onAxisValueChangedObservable.add((pos) => {
        callback(pos, 'left');
      });
    }
    if (this.thumbstick.right) {
      this.thumbstick.right.onAxisValueChangedObservable.add((pos) => {
        callback(pos, 'right');
      });
    }
  }

  /**
   * Used internally to track squeeze buttons of VR controllers. Disables the teleporation if a button is pressed.
   * Calls squeeze listeners, passing the them the value (0-1) and side (left/right);  
   */
  squeezeTracker(value, side, mesh) {
    this.squeeze[side] = value;
    if (value == 1) {
      this.vrHelper.teleportation.detach();
    } else if (value == 0) {
      this.vrHelper.teleportation.attach();
    }
    this.squeezeConsumers.every(callback => {
      try {
        return callback(value, side, mesh);
      } catch (err) {
        console.log("Error processing squeeze ", err);
        return true;
      }
    });
  }

  /**
   * Adds given callback to the list of XR controller squeeze button consumer.
   * Consumer is passed value(0-1) and side (left/right) of the event. 
   * If it consumes the event, returns false.
   * @param callback returns true if processing should continue
   */
  addSqueezeConsumer(callback) {
    if (!this.squeezeConsumers.includes(callback)) {
      this.squeezeConsumers.push(callback);
    }
  }
  /** Remove squeeze listener */
  removeSqueezeConsumer(callback) {
    let index = this.squeezeConsumers.indexOf(callback);
    if (index > -1) {
      this.squeezeConsumers.splice(index, 1);
    }
  }

  /**
   * Used internally to track triggers of VR controllers. Disables the teleporation if a trigger is pressed.
   * Calls trigger listeners, passing the them the value (0-1) and side (left/right);  
   */
  triggerTracker(controller, value, side) {
    this.trigger[side] = value;
    // XR hand has only one component, xr-standard-trigger
    // normal XR controller has many
    if (Object.keys(controller.components).length > 1) {
      if (value == 1) {
        this.vrHelper.teleportation.detach();
        this.activeController = side;
      } else if (value == 0) {
        this.vrHelper.teleportation.attach();
      }
    }
    this.triggerListeners.forEach(callback => { callback(value, side) });
  }

  /**
   * Adds given callback to the list of XR controller trigger listeners
   * CHECKME: include gamepad trigger?
   */
  addTriggerListener(callback) {
    this.triggerListeners.push(callback);
  }

  /** Remove trigger listener */
  removeTriggerListener(callback) {
    this.triggerListeners.splice(this.triggerListeners.indexOf(callback), 1);
  }

  /**
   * Called after teleoportation to update non-VR world camera and dynamic terrain if needed
   */
  afterTeleportation() {
    var targetPosition = this.vrHelper.baseExperience.camera.position;
    if (this.world.camera) {
      // this might get triggered before the world camera is initialized
      this.world.camera.globalPosition.x = targetPosition.x;
      this.world.camera.globalPosition.y = targetPosition.y;
      this.world.camera.globalPosition.z = targetPosition.z;
    }
    if (this.world.terrain) {
      this.world.terrain.refresh(false);
    }
    // TODO we can modify camera y here, adding terrain height on top of ground height
  }

  /**
   * Creates pointer ray and intersection mesh.
   */
  createPointer() {
    this.pointerTarget = new BABYLON.TransformNode("Pointer-target", this.scene);
    let pointerMesh = new BABYLON.MeshBuilder.CreateDisc("Pointer-mesh", { radius: .05 }, this.scene);
    pointerMesh.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    pointerMesh.material = new BABYLON.StandardMaterial('pointerTargetMaterial', this.scene);
    pointerMesh.material.diffuseTexture = new BABYLON.Texture("/content/icons/target-aim.png", this.scene);
    pointerMesh.material.diffuseTexture.hasAlpha = true;
    pointerMesh.material.useAlphaFromDiffuseTexture = true;
    pointerMesh.material.emissiveColor = BABYLON.Color3.White();
    pointerMesh.material.disableLightning = true;
    pointerMesh.position = new BABYLON.Vector3(0, 0, 0);
    pointerMesh.parent = this.pointerTarget;

    const points = [
      new BABYLON.Vector3(0, 0, 0),
      new BABYLON.Vector3(0, -1, 0)
    ]
    const colors = [
      new BABYLON.Color4(1, 0, 0, 1),
      new BABYLON.Color4(1, 1, 0, 1),
    ]
    // returns LinesMesh
    this.pointerLines = BABYLON.MeshBuilder.CreateLines("Pointer-lines", { points: points, colors: colors, updatable: true });
    this.pointerLines.alwaysSelectAsActiveMesh = true;
  }

  /**
   * Removes pointer ray and target
   */
  clearPointer() {
    if (this.pointerTarget) {
      this.pointerTarget.dispose();
      this.pointerTarget = null;
    }
    if (this.pointerLines) {
      this.pointerLines.dispose();
      this.pointerLines = null;
    }
  }

  /**
   * Called from render loop to set internal state variables, and implements XR pointer for mobile devices.
   * When XR controllers are unavailable, it renders a ray pointing forward, and moves pointer mesh to
   * ray intersection with scene meshes.
   * Calls World.trackXrDevices()
   */
  trackXrDevices() {
    try {
      if (this.world && this.world.inXR()) {
        // user height has to be tracked here due to
        //XRFrame access outside the callback that produced it is invalid
        if (this.camera().realWorldHeight) {
          // are we absolutely sure that all mobiles deliver this value?
          this.userHeight = this.camera().realWorldHeight;
        }
        if (!this.controller.left && !this.controller.right && this.pointerTarget) {
          // we don't have controllers (yet), use ray from camera for interaction
          var ray = this.camera().getForwardRay(100);
          this.pickInfo = this.world.scene.pickWithRay(ray, (mesh) => {
            return this.isSelectableMesh(mesh);
          });
          if (this.pickInfo.hit) {
            const points = [
              new BABYLON.Vector3(this.camera().position.x, this.camera().position.y - .5, this.camera().position.z),
              this.pickInfo.pickedPoint
            ]
            this.pointerLines = BABYLON.MeshBuilder.CreateLines("Pointer-lines", { points: points, instance: this.pointerLines });
            this.pointerTarget.position = this.pickInfo.pickedPoint;
            this.pointerTarget.setEnabled(true);
          } else {
            const points = [
              new BABYLON.Vector3(this.camera().position.x, this.camera().position.y - .5, this.camera().position.z),
              ray.direction.scale(ray.length)
            ]
            this.pointerLines = BABYLON.MeshBuilder.CreateLines("Pointer-lines", { points: points, instance: this.pointerLines });
            this.pointerTarget.setEnabled(false);
          }
          if (!this.controller.left && !this.controller.right && this.pointerTarget) {
            // we don't have controllers (yet), use ray from camera for interaction
            var ray = this.camera().getForwardRay(100);
            this.pickInfo = this.world.scene.pickWithRay(ray, (mesh) => {
              return this.isSelectableMesh(mesh);
            });
            if (this.pickInfo.hit) {
              const points = [
                new BABYLON.Vector3(this.camera().position.x, this.camera().position.y - .5, this.camera().position.z),
                this.pickInfo.pickedPoint
              ]
              this.pointerLines = BABYLON.MeshBuilder.CreateLines("Pointer-lines", { points: points, instance: this.pointerLines });
              this.pointerTarget.position = this.pickInfo.pickedPoint;
              this.pointerTarget.setEnabled(true);
            } else {
              const points = [
                new BABYLON.Vector3(this.camera().position.x, this.camera().position.y - .5, this.camera().position.z),
                ray.direction.scale(ray.length)
              ]
              this.pointerLines = BABYLON.MeshBuilder.CreateLines("Pointer-lines", { points: points, instance: this.pointerLines });
              this.pointerTarget.setEnabled(false);
            }
            this.world.scene.simulatePointerMove(this.pickInfo);
            this.pointerLines.alwaysSelectAsActiveMesh = true;
          }
        }
        if (this.hands.left.hand) {
          this.checkPinch("left");
        }
        if (this.hands.right.hand) {
          this.checkPinch("right");
        }
        this.world.trackXrDevices();
      }
    } catch (err) {
      console.error("ERROR in render loop: " + err);
    }
  }

  /**
   * Start XR device tracking: prepare pointer ray and mesh, and register tracking function (trackXrDevices) to scene render loop.
   */
  startTracking() {
    if (!this.tracking) {
      console.log("startTracking");
      this.tracking = true;
      this.world.scene.registerBeforeRender(this.xrDeviceTracker);
    } else {
      console.log("already tracking");
    }
  }

  /**
   * Stop XR device tracking: clean up
   */
  stopTracking() {
    if (this.tracking) {
      console.log("stopTracking");
      this.world.scene.unregisterBeforeRender(this.xrDeviceTracker);
      this.clearPointer();
      this.tracking = false;
    } else {
      console.log("tracking already stopped");
    }
  }
  /**
   * Returns the absolute position of left or right controller grip
   * @param side left or right
   */
  armPos(side) {
    return this.controller[side].grip.absolutePosition;
  }
  /**
   * Returns the absolute position of left controller grip
   */
  leftArmPos() {
    return this.controller.left.grip.absolutePosition;
  }
  /**
   * Returns the absolute position of right controller grip
   */
  rightArmPos() {
    return this.controller.right.grip.absolutePosition;
  }
  /**
   * Returns the rotation quaternion of left or right controller grip
   * @param side left or right
   */
  armRot(side) {
    return this.controller[side].pointer.rotationQuaternion;
  }
  /**
   * Returns the rotation quaternion of left controller grip
   */
  leftArmRot() {
    //return this.controller.left.pointer.rotationQuaternion;
    return this.handRotation('left');
  }
  /**
   * Returns the rotation quaternion of right controller grip
   */
  rightArmRot() {
    //return this.controller.right.pointer.rotationQuaternion;
    return this.handRotation('right');
  }
  /**
   * Returns the height of the user, as defined by WebXRCamera
   */
  realWorldHeight() {
    return this.userHeight;
  }
  /**
   * Returns the current WebXRCamera
   */
  camera() {
    return this.vrHelper.input.xrCamera;
  }
  /**
   * Internally used to add teleportation mesh
   */
  addFloorMesh(mesh) {
    if (this.vrHelper && this.vrHelper.teleportation && mesh) {
      // do not add a floor twice
      this.vrHelper.teleportation.removeFloorMesh(mesh);
      this.vrHelper.teleportation.addFloorMesh(mesh);
    }
  }
  /**
   * Internally used to remove teleportation mesh
   */
  removeFloorMesh(mesh) {
    if (this.vrHelper && this.vrHelper.teleportation) {
      this.vrHelper.teleportation.removeFloorMesh(mesh);
    }
  }
  /**
   * Returns the current ray selection predicate, and optionally installs a new one
   */
  raySelectionPredicate(predicate) {
    var ret = this.vrHelper.pointerSelection.raySelectionPredicate;
    if (predicate) {
      this.vrHelper.pointerSelection.raySelectionPredicate = predicate;
    }
    return ret;
  }
  /**
   * Removes all current teleportation meshes
   */
  clearFloors() {
    for (var i = 0; i < this.world.getFloorMeshes().length; i++) {
      this.removeFloorMesh(this.world.getFloorMeshes()[i]);
    }
  }
  /**
   * Adds all world floor meshes to teleportation
   */
  addFloors() {
    for (var i = 0; i < this.world.getFloorMeshes().length; i++) {
      this.addFloorMesh(this.world.getFloorMeshes()[i]);
    }
  }

  trackHands() {
    try {
      // https://forum.babylonjs.com/t/xr-hands-and-finger-tracking/53436
      // https://forum.babylonjs.com/t/webxr-hand-functions-like-grabbing-in-quest-3/49287/2
      const featureManager = this.vrHelper.baseExperience.featuresManager;
      const xrHandFeature = featureManager.enableFeature(BABYLON.WebXRFeatureName.HAND_TRACKING, "latest", {
        xrInput: this.vrHelper.input
      });
      if (xrHandFeature) {
        console.log("XR Hands enabled");
        xrHandFeature.onHandAddedObservable.add((hand) => {
          // TODO introduce rotation correction for controller grip mesh
          // left: BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Z,-Math.PI/2)
          // right:  BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Z,Math.PI/2)
          // see if that can be also used in HUD
          let side = this.getGripSide(hand.xrController.grip);
          this.hands[side].hand = hand;
          this.hands[side].thumb = hand.getJointMesh(BABYLON.WebXRHandJoint.THUMB_TIP);
          this.hands[side].index = hand.getJointMesh(BABYLON.WebXRHandJoint.INDEX_FINGER_TIP);
          this.hands[side].middle = hand.getJointMesh(BABYLON.WebXRHandJoint.MIDDLE_FINGER_TIP);
        });
        // XR hand may get removed any time, when out of camera range, even if one hand covers the other
        // in that case controller grip base mesh disappears, HUD loses parent
        xrHandFeature.onHandRemovedObservable.add((hand) => {
          let side = this.getGripSide(hand.xrController.grip);
          this.notifyHud(hand.xrController);
          this.hands[side].hand = null;
          this.hands[side].thumb = null;
          this.hands[side].index = null;
          this.hands[side].middle = null;
        });
      }
      const nearInteraction = featureManager.getEnabledFeature(BABYLON.WebXRFeatureName.NEAR_INTERACTION);
      if (nearInteraction) {
        console.log("Near interaction enabled, setting up...");
        nearInteraction._hoverRadius = this.nearHoverRadius;
        nearInteraction._pickRadius = this.nearPickRadius;
      } else {
        console.log("Near interaction disabled");
      }
    } catch (error) {
      console.log("ERROR " + error);
    }
  }

  getGripSide(grip) {
    if (
      grip.id.toLowerCase().indexOf("left") >= 0 || grip.name.toLowerCase().indexOf("left") >= 0
    ) {
      return "left";
    } else if (
      grip.id.toLowerCase().indexOf("right") >= 0 || grip.name.toLowerCase().indexOf("right") >= 0
    ) {
      return "right";
    } else {
      console.log("ERROR unknown controller side: " + grip.id + " " + grip.name);
      return '';
    }
  }

  checkPinch(side) {
    let hand = this.hands[side]
    //let distance = BABYLON.Vector3.Distance(hand.index.position, hand.thumb.position);
    let distance = BABYLON.Vector3.Distance(hand.middle.position, hand.thumb.position);

    if (this.squeeze[side] == 0 && distance < 0.03) {
      this.squeeze[side] = 1;
      this.squeezeTracker(1, side, hand.thumb);
    } else if (this.squeeze[side] == 1 && distance > 0.03) {
      this.squeeze[side] = 0;
      this.squeezeTracker(0, side, hand.thumb);
    }
  }
  /**
   * Disable sliding movement and enable teleportation.
   */
  enableTeleportation() {
    this.movementMode = "TELEPORT";
    if (this.world && this.world.hasXR) {
      const featureManager = this.vrHelper.baseExperience.featuresManager;
      featureManager.disableFeature(BABYLON.WebXRFeatureName.MOVEMENT);
      featureManager.enableFeature(BABYLON.WebXRFeatureName.TELEPORTATION, "latest", {
        xrInput: this.vrHelper.input,
        floorMeshes: this.world.getFloorMeshes(),
        timeToTeleport: this.timeToTeleport
      });
    }
  }

  /**
   * Experimental, quite limited.
   * Disable teleportation and enable sliding movement.
   * Movement then ignores collisions, i.e. camera flies through everything.
   * Correctly implementing this will require collision calculation using a collider mesh,
   * mesh.moveWithCollisions(), then setting camera positon - much like AvatarMovement.moveAvatar().
   */
  enableSliding() {
    this.movementMode = "SLIDE";
    if (this.world && this.world.hasXR) {
      const featureManager = this.vrHelper.baseExperience.featuresManager;
      featureManager.disableFeature(BABYLON.WebXRFeatureName.TELEPORTATION);
      let speed = 1;
      if (this.world.camera1p) {
        speed = this.world.camera1p.speed;
      }
      featureManager.enableFeature(BABYLON.WebXRFeatureName.MOVEMENT, "latest", {
        xrInput: this.vrHelper.input,
        // disables rotation, but left stick still calculates into position
        // movementOrientationFollowsViewerPose: false,
        // does not work, use speed 0 instead
        //movementEnabled: false,
        movementSpeed: speed
      });
    }
  }

  /**
   * Disable both teleportation and sliding.
   */
  disableMovement() {
    this.movementMode = "NONE";
    const featureManager = this.vrHelper.baseExperience.featuresManager;
    featureManager.disableFeature(BABYLON.WebXRFeatureName.TELEPORTATION);
    featureManager.disableFeature(BABYLON.WebXRFeatureName.MOVEMENT);
  }

  /**
   * Enable movement in given mode
   * @param {string} mode TELEPORT or SLIDE 
   */
  enableMovement(mode) {
    if ("SLIDE" == mode) {
      this.enableSliding();
    } else if ("TELEPORT" == mode) {
      this.enableTeleportation();
    } else {
      throw "Unknown movement mode: " + mode;
    }
  }

  /**
   * Returns controller/hand position relative to the user.
   * @param {string} side left or right 
   */
  handPosition(side) {
    const cameraPos = this.camera().position;
    const xrController = this.controller[side];
    // CHECKME: 0, rather than user height?
    const pos = xrController.grip.absolutePosition.subtract(new BABYLON.Vector3(cameraPos.x, 0, cameraPos.z));
    return pos;
  }

  /**
   * Returns controller/hand rotation relative to the user.
   * @param {string} side left or right 
   */
  handRotation(side) {
    const xrController = this.controller[side];
    if (this.hands[side].hand) {
      return xrController.pointer.rotationQuaternion.multiply(this.hands[side].rotation);
    } else {
      return xrController.pointer.rotationQuaternion.clone();
    }
  }
  
  handActive() {
    let side = this.activeController;
    return "none" != side && this.hands[side].hand != null;
  }

}