import { VRSPACEUI } from '../ui/vrspace-ui.js';
import { World } from './world.js';

/**
 * Helper class containing camera creation and manipulation methods used elsewhere.
 */
export class CameraHelper {
  /**
   * Last instance of CameraHelper created
   *  
   * @type {CameraHelper} 
   */
  static lastInstance;
  /** Should mobile device orientation control camera orientation, default false (cheap devices have bad sensors) */
  static mobileOrientationEnabled = false;
  
  /**
   * @param {World} world 
   */
  constructor(world) {
    this.world = world;
    /** Should mobile device orientation control camera orientation, defaults to static World.mobileOrientationEnabled */
    this.mobileOrientationEnabled = CameraHelper.mobileOrientationEnabled;
    /** Set if used, 3rd person camera only */
    this.gamepadInput = null;
    CameraHelper.lastInstance = this;
  }

  /**
  Utility method, creates a UniversalCamera and sets defaults: gravity, collisions, ellipsoid, keys, mobile orientation.
  @param pos Vector3 to position camera at
  @param name optional camera name, default Universal Camera
   */
  universalCamera(pos, name = "Universal Camera") {
    let camera = new BABYLON.UniversalCamera(name, pos, this.world.scene);
    camera.maxZ = 100000;
    camera.minZ = 0;
    camera.applyGravity = true;
    camera.speed = 0.2;
    // 1.8 m high:
    camera.ellipsoid = new BABYLON.Vector3(.5, .9, .5);
    // eyes at 1.6 m:
    camera.ellipsoidOffset = new BABYLON.Vector3(0, .2, 0);
    camera.checkCollisions = true;

    camera.keysDown = [40, 83]; // down, S
    camera.keysLeft = [37, 65]; // left, A
    camera.keysRight = [39, 68]; // right, D
    camera.keysUp = [38, 87]; // up, W
    camera.keysUpward = [36, 33, 32]; // home, pgup, space

    camera.touchAngularSensibility = 10000;

    if ( this.mobileOrientationEnabled && VRSPACEUI.hasTouchScreen() ) {
      this.enableMobileOrientation();
    }
    
    return camera;
  }

  /**
  Utility method, calls this.universalCamera with given parameters, and sets the camera speed function.
  Original Babylon.js camera speed function takes FPS into account, but does not mean anything really.
  This one attempts to approximate meters per second, and is computationally cheaper.
  See https://forum.babylonjs.com/t/does-camera-speed-vary-depending-on-fps-performance/20802
  @param pos Vector3 to position camera at
  @param name optional camera name, default First Person Camera
   */
  firstPersonCamera(pos, name = "First Person Camera") {
    let camera = this.universalCamera(pos, name);
    /*
    // debug existing func
    console.log(camera._computeLocalCameraSpeed);
    setInterval(() => {
      console.log("engine delta: "+this.engine.getDeltaTime()+" fps "+this.engine.getFps());
    }, 5000);
    */
    // this actually makes camera speed real
    camera._computeLocalCameraSpeed = () => { return camera.speed * this.engine.getDeltaTime() * 0.001 };

    return camera;
  }
 
  /** 
   * Utility method, creates 3rd person camera.
   * Requires 1st person UniversalCamera already set, and sets rotation and direction based on it.
   * @param camera1p 1st person UniversalCamera, defaults to this.world.camera
   * @returns created 3rd person ArcRotateCamera
   */
  thirdPersonCamera(camera1p = this.world.camera) {
    let camera3p = new BABYLON.ArcRotateCamera("Third Person Camera", Math.PI / 2, 1.5 * Math.PI - camera1p.rotation.y, 3, camera1p.position, this.world.scene);
    //camera3p.maxZ = 1000;
    //camera3p.minZ = 0;
    camera3p.maxZ = camera1p.maxZ;
    camera3p.minZ = camera1p.minZ;
    camera3p.wheelPrecision = 100;
    camera3p.checkCollisions = true;

    camera3p.lowerRadiusLimit = 0.5;
    camera3p.radius = 2;
    camera3p.upperRadiusLimit = 10;

    camera3p.checkCollisions = true;
    camera3p.collisionRadius = new BABYLON.Vector3(0.1, 0.1, 0.1);
    camera3p.beta = Math.PI / 2;

    // disable panning, as it moves avatar/camera1:
    camera3p.panningSensibility = 0;
    // we can also check for
    // camera3p.inputs.attached.pointers.mousewheel
    // camera3p.inputs.attached.pointers.keyboard
    if (VRSPACEUI.hasTouchScreen()) {
      // assuming mobile
      camera3p.inputs.attached.pointers.pinchPrecision = 100;
    } else {
      // assuming PC, and we're moving using LMB
      camera3p.inputs.attached.pointers.buttons = [1, 2]; // disable LMB(0)
    }

    // gamepad support
    // https://forum.babylonjs.com/t/gamepad-controller/34409
    // this actually works only the first time
    // select 1p then 3p cam again, and no gamepad input
    const gamepadManager = this.world.scene.gamepadManager;
    this.gamepadInput = new BABYLON.ArcRotateCameraGamepadInput();
    // so this is the workaround, also explained on the forum
    const oldAttach = this.gamepadInput.attachControl;
    this.gamepadInput.attachControl = () => {
      oldAttach;
      if (!this.gamepadInput.gamepad && gamepadManager.gamepads.length) {
        this.gamepadInput.gamepad = gamepadManager.gamepads[0];
      }
    }
    // we want to invert X axis, and disable Y, so we have same controls in 1st and 3rd person mode
    // so we override checkInputs
    // https://github.com/BabylonJS/Babylon.js/blob/master/packages/dev/core/src/Cameras/Inputs/arcRotateCameraGamepadInput.ts
    this.gamepadInput.checkInputs = () => {
      const camera = camera3p;
      const rsValues = this.gamepad.rightStick;

      if (rsValues) {
        if (rsValues.x != 0) {
          const normalizedRX = rsValues.x / this.gamepadInput.gamepadRotationSensibility;
          if (normalizedRX != 0 && Math.abs(normalizedRX) > 0.005) {
            camera.inertialAlphaOffset -= normalizedRX;
          }
        }

        if (rsValues.y != 0) {
          const normalizedRY = (rsValues.y / this.gamepadInput.gamepadRotationSensibility) * this.gamepadInput._yAxisScale;
          if (normalizedRY != 0 && Math.abs(normalizedRY) > 0.005) {
            camera.inertialBetaOffset += normalizedRY;
          }
        }
      }

      // zoom in and out with left up/down
      const buttonUp = this.gamepad.browserGamepad.buttons[12];
      const buttonDown = this.gamepad.browserGamepad.buttons[13];

      if (buttonUp && buttonUp.pressed) {
        const normalizedLY = 1 / this.gamepadInput.gamepadMoveSensibility;
        if (normalizedLY != 0 && Math.abs(normalizedLY) > 0.005) {
          camera3p.inertialRadiusOffset += normalizedLY;
        }
      }

      if (buttonDown && buttonDown.pressed) {
        const normalizedLY = 1 / this.gamepadInput.gamepadMoveSensibility;
        if (normalizedLY != 0 && Math.abs(normalizedLY) > 0.005) {
          camera3p.inertialRadiusOffset -= normalizedLY;
        }
      }

    }

    gamepadManager.onGamepadConnectedObservable.add((gamepad, state) => {
      if (!this.gamepad) {
        this.gamepad = gamepad;
        camera3p.inputs.add(this.gamepadInput);
        //camera3p.inputs.attached.gamepad.gamepadAngularSensibility = 250;
        camera3p.inputs.addGamepad();
        gamepad.onleftstickchanged((stickValues) => {
          if (this.avatarController) {
            this.avatarController.processGamepadStick(stickValues);
          }
        });
      }
    });

    return camera3p;
  }

  /**
   * Mobiles: use screen orientation to control camera rotation.
   * @param {boolean} [enabled=this.mobileOrientationEnabled] true = use screen orientation, false = drag to rotate
   */
  enableMobileOrientation(enabled=this.mobileOrientationEnabled) {
    this.mobileOrientationEnabled = enabled;
    if ( VRSPACEUI.hasTouchScreen() && this.world.scene.activeCamera.getClassName() == "UniversalCamera" ) {
      let camera = this.world.scene.activeCamera;
      if ( this.mobileOrientationEnabled ) {
        // see https://github.com/BabylonJS/Babylon.js/blob/master/packages/dev/core/src/Cameras/Inputs/freeCameraDeviceOrientationInput.ts
        let deviceOrientation = new BABYLON.FreeCameraDeviceOrientationInput();
        deviceOrientation.angleOffset = 0;
        deviceOrientation.angleInitial = 0;
        deviceOrientation._deviceOrientation_original = deviceOrientation._deviceOrientation;

        deviceOrientation._deviceOrientation = (evt) => {
          if (!deviceOrientation.angleInitial && evt.alpha) {
            deviceOrientation.angleInitial = evt.alpha;
            console.log("Initial device orientation: "+evt.alpha+" "+evt.beta+" "+evt.gamma);
          }
          deviceOrientation._deviceOrientation_original(evt);
        }
        deviceOrientation.angleOffset = camera.rotation.y/2/Math.PI*360;

        // see https://github.com/BabylonJS/Babylon.js/blob/master/packages/dev/core/src/Cameras/targetCamera.ts#L260
        camera.setTarget_original = camera.setTarget;
        camera.setTarget = (vector) => {
          camera.setTarget_original(vector);
          deviceOrientation.angleOffset = camera.rotation.y/2/Math.PI*360;
        }

        deviceOrientation.checkInputs_original = deviceOrientation.checkInputs;
        deviceOrientation.checkInputs = () => {
          // https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent
          // touch screen does not necessarily mean orientation info is available - do not mess up camera for these
          if ( deviceOrientation.angleInitial ) {
            deviceOrientation._alpha -= (deviceOrientation.angleInitial + deviceOrientation.angleOffset);
            deviceOrientation.checkInputs_original();
            deviceOrientation._alpha += (deviceOrientation.angleInitial + deviceOrientation.angleOffset);
          } else {
            deviceOrientation.checkInputs_original();
          }
        }

        camera.inputs.add(deviceOrientation);
      } else {
        camera.inputs.removeByType("FreeCameraDeviceOrientationInput");
      }
    }
  }

  dispose() {
    // TODO gamepad inputs
  }
  
}