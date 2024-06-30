import {VRSPACEUI} from '../ui/vrspace-ui.js';
import {VRHelper} from '../xr/vr-helper.js';
import {ChatLog} from '../ui/widget/chat-log.js';
import {WorldManager} from '../core/world-manager.js';
import {AvatarController} from '../avatar/avatar-controller.js';
import { VRSPACE } from '../vrspace-min.js';

/**
Basic world, intended to be overridden.
Provides function placeholders for implementations, and safe implementation of basic functions, 
like loading of world file(s) and XR support.
A world may contain one or more scene files. Defaults are set for one file loaded from scene.gltf file, 
as it is, from current directory.
To load multiple files, use this.worldObjects structure or objectsFile file, that along the name allow to specifiy position, 
rotation and scale for each object.
(the structure is the same one that is also used by AssetLoader and WorldEditor)
@abstract
 */
export class World {
  /**
   * World instance that was created last.
   */
  static lastInstance = null;
  /**
  Constructor takes parems that allow to override default values.
  @param params object to override world defaults - all properties are copied to world properties
   */
  constructor(params) {
    /** World name, default null */
    this.name = null;
    /** Base URL of related content, default "" (current location) */
    this.baseUrl = "";
    /** World scene file name to load, default scene.gltf */
    this.file = "scene.gltf";
    /** World objects to load, default null */
    this.worldObjects = null;
    /** World objects json file, as saved by WorldEditor and AssetLoader, default null */
    this.objectsFile = null;
    /** Wheter gravity is enabled, default true */
    this.gravityEnabled = true;
    /** Wheter collisions are enabled, default true */
    this.collisionsEnabled = true;
    /** Wheter collisions are enabled in XR, default true */
    this.collisionsEnabledInXR = false; // CHECKME I don't even remember why
    /** Progress indicator */
    this.indicator = null;
    /** Main world camera */
    this.camera = null;
    /** First person camera, defaults to main camera */
    this.camera1p = null;
    /** Main 3rd person world camera */
    this.camera3p = null;
    /** Progress indicator functon */
    this.onProgress = null;
    /** AR mode indicator, set by VRHelper */
    this.inAR = false;
    /** VR mode indicator, set by VRHelper */
    this.inVR = false;
    /** WebXR capability indicator, set by VRHelper */
    this.hasXR = false;
    /** VR helper */
    this.vrHelper = null;
    /** AR helper */
    this.arHelper = null;
    /** Currently active VR/AR helper */
    this.xrHelper = null;
    /** Scene meshes, available once the world loads (in loaded, loadingStop, collisions methods) */
    this.sceneMeshes = null;
    /** Terrain, optionally created in createTerrain() */
    this.terrain = null;
    
    /** Handy reference to VRSpaceUI */
    this.VRSPACEUI = VRSPACEUI;
    /** Reference to worldManager, set by WorldManager once that user goes online */
    this.worldManager = null;
    /** Reference to AvatarController, set by AvatarController during initialization */
    this.avatarController = null;
    /**  Reference to own Avatar or VideoAvatar, set by AvatarController during initialization */
    this.avatar = null;
    
    /** List of world listeners. 
    WorldManager executes enter(Welcome) method once user enters the world, after World.enter() method. 
    Methods added(VRObject) and removed(VRObject) are executed whenever scene changes.
    */
    this.worldListeners = [];
    this.floorMeshes = [];
    this.ground = null;
    // CHECKME: should floors be selectable?
    this.selectionPredicates = [(mesh)=>{return this.getFloorMeshes().includes(mesh)}];

    // now override defaults
    if ( params ) {
      for ( var param in params ) {
        this[param] = params[param];
      }
    }
    
    World.lastInstance = this;
  }
  
  /** Create, load and and show the world.
  Enables gravity and collisions, then executes createScene method, optionally creates load indicator,
  registers render loop, crates terrain, and finally, executes load method. Every method executed can be overridden.
  @param engine babylonjs engine
  @param name world name
  @param scene babylonjs scene, optional
  @param callback to execute after the world has loaded
  @param baseUrl folder to load scene from, default "", used only if not defined in constructor
  @param file scene file to load, default scene.gltf, used only if not defined in constructor
  @returns final scene
  */
  async init(engine, name, scene, callback, baseUrl, file) {
    this.canvas = engine.getInputElement();
    this.engine = engine;
    // workaround for android chrome 120.0.6099.43 bug, see
    // https://forum.babylonjs.com/t/problems-on-chrome-mobile-since-december-7th-2023/46288/16
    engine.disableUniformBuffers = true
    if ( name ) {
      this.name = name;
    }
    this.scene = scene;
    if ( !this.baseUrl && baseUrl ) {
      this.baseUrl = baseUrl;
    }
    if ( !this.file && file ) {
      this.file = file;
    }
    await this.createScene(engine);
    this.registerRenderLoop();
    if ( ! this.onProgress ) {
      this.indicator = VRSPACEUI.loadProgressIndicator(this.scene, this.camera);
      this.onProgress = (evt, name) => this.indicator.progress( evt, name )
    } else {
      // make sure it's available for any and all operations (custom progress indicator may not have done it)
      VRSPACEUI.init(scene);
    }
    this.createTerrain();
    this.createUI();
    this.load(callback);
    return this.scene;
  }
  /**
  Called from init.
  If the scene does not exist, creates the scene first.
  Then calls methods in this order: 
  createCamera, attachControl, createLights, createShadows, createSkybox, createGround, createEffects, createPhysics.
  */
  async createScene(engine) {
    if ( ! this.scene ) {
      this.scene = new BABYLON.Scene(engine);
    }
    // TODO dispose of old camera(s)
    var camera = await this.createCamera();
    if ( camera ) {
      this.camera = camera;
    }
    if ( ! this.camera1p ) {
      this.camera1p = this.camera;
    }
    this.attachControl();
    // TODO dispose of old lights
    var light = await this.createLights();
    if ( light ) {
      this.light = light;
    }
    // TODO dispose of old shadow generator
    var shadowGenerator = await this.createShadows();
    if ( shadowGenerator ) {
      this.shadowGenerator = shadowGenerator;
    }
    // TODO dispose of old skybox
    var skyBox = await this.createSkyBox();
    if ( skyBox ) {
      this.skyBox = skyBox;
    }
    // TODO dispose of old ground
    var ground = await this.createGround();
    if ( ground ) {
      this.ground = ground;
    }
    await this.createEffects();
    await this.createPhysics();
  }
  /**
   * An implementation must override this method and define at least one camera.
   * Returned camera, if any, is set as main camera (this.camera), and also as 1st person
   * camera (this.camera1p) if one is not set.
   */
  async createCamera() {
    alert( 'Please override createCamera() method')
  }
  /** Optional, empty implementation, called from createScene. May return a Light */
  async createLights() {}
  /** Optional, empty implementation, called from createScene. Should return a ShadowGenerator. */
  async createShadows() {}
  /** Optional, empty implementation, called from createScene. Should return a sky Box. */
  async createSkyBox() {}
  /** Optional, empty implementation, called from createScene. Should return a mesh. */
  async createGround() {}
  /** Optional, empty implementation, called from createScene */
  async createEffects() {};
  /** Optional, called from createScene. Creates Havok physics engine and plugin, with this.scene.gravity.
   * Generally, to enable physics in the scene, just set gravity and call super.createPhysics().
   * Or to disable gravity, simply do not call super.
  */
  async createPhysics() {
    try {
      const havokInstance = await HavokPhysics();
      this.physicsPlugin = new BABYLON.HavokPlugin(true, havokInstance);
      this.scene.enablePhysics(this.scene.gravity, this.physicsPlugin);
    } catch ( err ) {
      console.error("Physics initialization error", err);
    }
  };
  /** Optional, empty implementation, called from createScene */
  async createTerrain() {}
  /** Optional, empty implementation, called from createScene */
  async createUI() {}
  /** Attach the control to the camera, called from createScene. */
  attachControl() {
    this.camera.attachControl(this.canvas, true);
  }
  /**
  Called by WorldManager after the user has entered a multiuser world.
  Default implementation calls this.createChatlog().
  Note that at this point world geometry may not have been loaded.
  @param welcome message containing users Client object and array of permanent objects
   */
  async entered(welcome) {
    this.createChatlog();
  }
  /**
  Creates a ChatLog and binds it to the HUD, then it registers remoteEvent() method
  as a change listener with WorldManager to process remote events.
  */
  createChatlog() {
    this.chatLog = new ChatLog(this.scene);
    this.chatLog.show();
    this.worldManager.addChangeListener( (obj, field, node) => this.remoteEvent(obj, field, node));
    this.chatLog.input.addListener( text=>this.write(text) );
    this.chatLog.input.virtualKeyboardEnabled = this.inXR();
    this.addSelectionPredicate((mesh) => this.chatLog.isSelectableMesh(mesh));
  }
  /**
   * Returns true if either VR or AR mode is currently active
   */
  inXR() {
    return this.inVR || this.inAR;
  }
  /**
  Utility method, creates a UniversalCamera and sets defaults: gravity, collisions, ellipsoid, keys.
  @param pos Vector3 to position camera at
  @param name optional camera name, default Universal Camera
   */
  universalCamera(pos, name = "Universal Camera") {
    let camera = new BABYLON.UniversalCamera(name, pos, this.scene);
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
    let camera = this.universalCamera( pos, name );
    /*
    // debug existing func
    console.log(camera._computeLocalCameraSpeed);
    setInterval(() => {
      console.log("engine delta: "+this.engine.getDeltaTime()+" fps "+this.engine.getFps());
    }, 5000);
    */
    // this actually makes camera speed real
    camera._computeLocalCameraSpeed = () => { return camera.speed * this.engine.getDeltaTime()*0.001};
    this.camera1p = camera;
    
    return camera;
  }

  /** 
   * Utility method, creates 3rd person camera.
   * Requires 1st person UniversalCamera already set, and sets rotation and direction based on it.
   * @param camera1p 1st person UniversalCamera, defaults to this.camera
   * @returns created 3rd person ArcRotateCamera this.camera3p
   */
  thirdPersonCamera(camera1p = this.camera) {
    // CHECKME: use camera1p.rotation.y for alpha?
    this.camera3p = new BABYLON.ArcRotateCamera("Third Person Camera", Math.PI/2, 1.5*Math.PI-camera1p.rotation.y, 3, camera1p.position, this.scene);
    //this.camera3p.maxZ = 1000;
    //this.camera3p.minZ = 0;
    this.camera3p.maxZ = this.camera1p.maxZ;
    this.camera3p.minZ = this.camera1p.minZ;
    this.camera3p.wheelPrecision = 100;
    this.camera3p.checkCollisions = true;
    
    this.camera3p.lowerRadiusLimit = 0.5;
    this.camera3p.radius = 2;
    this.camera3p.upperRadiusLimit = 10;

    this.camera3p.checkCollisions = true;
    this.camera3p.collisionRadius = new BABYLON.Vector3(0.1,0.1,0.1);
    this.camera3p.beta = Math.PI/2;
    
    // disable panning, as it moves avatar/camera1:
    this.camera3p.panningSensibility = 0;
    // we can also check for
    // this.camera3p.inputs.attached.pointers.mousewheel
    // this.camera3p.inputs.attached.pointers.keyboard
    if ( this.hasTouchScreen() ) {
      // assuming mobile
      this.camera3p.inputs.attached.pointers.pinchPrecision = 100;
    } else {
      // assuming PC, and we're moving using LMB
      this.camera3p.inputs.attached.pointers.buttons = [1,2]; // disable LMB(0)
    }
    
    // gamepad support
    // https://forum.babylonjs.com/t/gamepad-controller/34409
    // this actually works only the first time
    // select 1p then 3p cam again, and no gamepad input
    const gamepadManager = this.scene.gamepadManager;
    this.gamepadInput = new BABYLON.ArcRotateCameraGamepadInput();
    // so this is the workaround, also explained on the forum
    const oldAttach = this.gamepadInput.attachControl;
    this.gamepadInput.attachControl = () => {
      oldAttach;
      if (!this.gamepadInput.gamepad && gamepadManager.gamepads.length ) {
        this.gamepadInput.gamepad = gamepadManager.gamepads[0];
      }
    }
    // we want to invert X axis, and disable Y, so we have same controls in 1st and 3rd person mode
    // so we override checkInputs
    // https://github.com/BabylonJS/Babylon.js/blob/master/packages/dev/core/src/Cameras/Inputs/arcRotateCameraGamepadInput.ts
    this.gamepadInput.checkInputs = () => {
      const camera = this.camera3p;
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
      
      if ( buttonUp && buttonUp.pressed ) {
        const normalizedLY = 1 / this.gamepadInput.gamepadMoveSensibility;
        if (normalizedLY != 0 && Math.abs(normalizedLY) > 0.005) {
            this.camera3p.inertialRadiusOffset += normalizedLY;
        }
      }
      
      if ( buttonDown && buttonDown.pressed ) {
        const normalizedLY = 1 / this.gamepadInput.gamepadMoveSensibility;
        if (normalizedLY != 0 && Math.abs(normalizedLY) > 0.005) {
            this.camera3p.inertialRadiusOffset -= normalizedLY;
        }
      }      
      
    }
    
    gamepadManager.onGamepadConnectedObservable.add((gamepad, state) => {
      if ( ! this.gamepad ) {
        this.gamepad = gamepad;
        this.camera3p.inputs.add(this.gamepadInput);
        //this.camera3p.inputs.attached.gamepad.gamepadAngularSensibility = 250;
        this.camera3p.inputs.addGamepad();
        gamepad.onleftstickchanged( (stickValues) => {
          if ( this.avatarController ) {
            this.avatarController.processGamepadStick(stickValues);
          }
        });
      }
    });

    return this.camera3p;
  }
  
  hasTouchScreen() {
    return ('ontouchstart' in window) || (navigator.MaxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);
  }
  /**
  Disposes of all objects returned by createLights, createCamera, createShadows, createSkybox
   */
  async dispose() {
    if ( this.camera ) {
      this.camera.dispose();
      this.camera = null;    
    }
    if ( this.camera3p ) {
      this.camera3p.dispose();
      this.camera3p = null;    
    }
    if ( this.skyBox ) {
      this.skyBox.dispose();
      this.skyBox.material.dispose();
      this.skyBox = null;    
    }
    if ( this.light ) {
      this.light.dispose();
      this.light = null;
    }
    if ( this.shadowGenerator ) {
      this.shadowGenerator.dispose();
      this.shadowGenerator = null;    
    }
    if ( this.renderLoop ) {
      this.engine.stopRenderLoop(this.renderLoop);
      this.renderLoop = null;
    }
    // TODO dispose of WorldManager, AvatarController, Avatar?
  }

  /** 
  Creates a VRHelper if needed, and initializes it with the current world.
  Normally called after world is loaded, safe to call elsewhere, or call multiple times, 
  but only after World.init() has finished. (world.scene must be initialized)
  @param vrHelper optional existing vrHelper
  @param arHelper optional existing arHelper
  @param activeHelper optional, if given both helpers, one that's currently active (e.g. passed while in VR or AR mode)
   */
  initXR(vrHelper, arHelper, activeHelper) {
    if ( vrHelper ) {
      this.vrHelper = vrHelper;
    }
    if ( ! this.vrHelper ) {
      this.vrHelper = VRHelper.getInstance("immersive-vr");
    }
    this.vrHelper.initXR(this);
    
    if ( arHelper ) {
      this.arHelper = arHelper;
    }
    if ( ! this.arHelper ) {
      this.arHelper = VRHelper.getInstance("immersive-ar");
    }
    // this flag may not work due to asynchronous calls
    if ( VRSPACEUI.canAR ) {
      this.arHelper.initXR(this)
    }
    
    if ( activeHelper && activeHelper == arHelper ) {
      this.xrHelper = this.arHelper;
    } else {
      this.xrHelper = this.vrHelper;
    }
  }
  /** Called by VRHelper once XR devices are initialized. Default implementation does nothing. */
  trackXrDevices() {
  }
  /** Called by VR helper after entering XR mode. Default implementation enables virtual keyboard in ChatLog. */
  enterXR() {
    if ( this.chatLog ) {
      this.chatLog.input.virtualKeyboardEnabled = true;
    }
  }
  /** Called by VR helper after exiting XR. Default implementation turns off ChatLog virtual keyboard.*/
  exitXR() {
    if ( this.chatLog ) {
      this.chatLog.input.virtualKeyboardEnabled = false;
    }
  }
  /**
   * Called when entering world in AR mode, or entering/exiting AR.
   * VRHelper disables the skybox and terrain, but this method should dissable all other nodes that shouldn't be visible in AR. 
   */
  enableBackground(enabled) {
  }
  /**
  Used in mesh selection predicate in XR. Default implementation returns true for members of this.floorMeshes.
   */
  isSelectableMesh(mesh) {
    let ret = VRSPACEUI.hud.isSelectableMesh(mesh);
    this.selectionPredicates.forEach((p)=>{ret ||= p(mesh)});
    return ret;
  }

  /**
  Returns this.floorMeshes or this.ground if exist, or empty array.
  Used for movement in XR.
   */
  getFloorMeshes() {
    if ( this.floorMeshes && this.floorMeshes.length > 0 ) {
      return this.floorMeshes;      
    } else if ( this.ground ) {
      return [ this.ground ];
    }
    return [];
  }
  
  /**
  Enables or disables collisions in the world. This includes floorMeshes, sceneMeshes, and also applying gravity to camera.
  @param state true or false
   */
  collisions(state) {
    this._collisions( this.floorMeshes, this.collisionsEnabled && state );
    this._collisions( this.sceneMeshes, this.collisionsEnabled && state );
    this.camera.applyGravity = this.gravityEnabled && state;
    this.camera._needMoveForGravity = this.gravityEnabled && state;
  }
  
  /**
  Utility method, enables or disables collisions on the given set of meshes.
  @param meshes array of meshes
  @param state true or false
   */
  _collisions( meshes, state ) {
    if ( meshes ) {
      for ( var i=0; i<meshes.length; i++ ) {
        this.setMeshCollisions( meshes[i], state );
      }
    }
  }
  
  /**
  Enable or disable collisions for a mesh. Override to fine-tune collisions.
  @param mesh
  @param state
   */
  setMeshCollisions(mesh, state) {
    mesh.checkCollisions = state;    
  }
  
  /**
  Called on loading progress, executes whatever this.onProgress contains, by default LoadProgressListener.
  @param evt
  @param name
   */
  loadProgress( evt, name ) {
    if ( this.onProgress ) {
      this.onProgress( evt, name );
    }
  }
  /**
  Called if loading the world fails. Passes the exception to this.onFailure handler if it exists,
  otherwise logs it to the console.
  @param exception whatever caused loading to fail
   */
  loadFailed( exception ) {
    if (this.onFailure) {
      this.onFailure( exception );
    } else {
      console.log( "Error loading world "+this.name, exception);
    }
    if ( this.indicator ) {
      this.indicator.remove(this.name);
    }
  }
  /**
  Called when loading starts. Calls this.indicator.add if available.
  @param name
   */
  loadingStart(name) {
    if ( this.indicator ) {
      this.indicator.add(name);
    }
  }
  /**
  Called when loading finishes. Calls this.indicator.remove if available.
  @param name
   */
  loadingStop(name) {
    if ( this.indicator ) {
      this.indicator.remove(name);
    }
  }
  
  /** Load the world, then execute given callback passing self as argument.
  Loads an AssetContainer from file specified by this.file, if any (by default scene.gltf), and adds it to the scene.
  Then loads all world objects specified in this.objectsFile or this.worldObjects, if any - file takes precedence.
  Takes care of loading progress.
  Calls loadingStart, loaded, loadingStop, collisions - each may be overridden.
  @param callback to execute after the content has loaded
  @returns world object
   */
  async load(callback) {
    this.loadingStart(this.name);

    var promises = [];
    if ( this.file ) {
      var scenePromise = VRSPACEUI.assetLoader.loadAsset( this.baseUrl+this.file,
        // onSuccess:
        (url, container, info ) => {
          this.sceneMeshes = container.meshes;
          this.container = container;
  
          // Adds all elements to the scene
          var mesh = container.createRootMesh();
          mesh.name = this.name;
          container.addAllToScene();
        
          this.loaded( this.file, mesh );
          
        },
        // onError:
        exception => this.loadFailed( exception ),
        // onProgress:
        evt => this.loadProgress(evt, this.name)
      );
      promises.push(scenePromise);
    }
    
    if ( this.objectsFile ) {
      var response = await fetch(this.baseUrl+this.objectsFile);
      var json = response.json();
      this.worldObjects = JSON.parse(json);
    }
    
    if ( this.worldObjects ) {
      this.sceneMeshes = [];
      for ( var url in this.worldObjects ) {
        var instances = this.worldObjects[url].instances;
        if ( !url.startsWith("/") ) {
          // relative url, make it relative to world script path
          url = this.baseUrl+url;
        }
        instances.forEach( (instance) => {
          var objPromise = VRSPACEUI.assetLoader.loadAsset(url,
            // callback 
            (loadedUrl, container,info,instances)=>{
              if ( instances ) {
                var mesh = obj.instantiatedEntries.rootNodes[0];
                // CHECKME: untested
                var children = mesh.getChildMeshes();
                this.sceneMeshes.push(...children);
              } else {
                // Adds all elements to the scene
                var mesh = container.createRootMesh();
                var pos = loadedUrl.lastIndexOf('/');
                if ( pos >= 0 ) {
                  mesh.name = loadedUrl.substring(pos+1);
                }
                container.addAllToScene();
                this.sceneMeshes.push(...container.meshes);
              }
              if ( instance.position ) {
                mesh.position = new BABYLON.Vector3(instance.position.x, instance.position.y, instance.position.z);
              }
              if ( instance.rotation ) {
                mesh.rotation = new BABYLON.Vector3(instance.rotation.x, instance.rotation.y, instance.rotation.z);
              }
              if ( instance.scale ) {
                mesh.scaling = new BABYLON.Vector3(instance.scale.x, instance.scale.y, instance.scale.z);
              }
              this.loaded( loadedUrl, mesh );
            },
            // onError:
            exception => this.loadFailed( exception ),
            // onProgress:
            evt => this.loadProgress(evt, url)
          );
          promises.push(objPromise);
        });
      }
    }
    
    Promise.all(promises).then(() => {
      VRSPACEUI.log("World loaded");
      this.loadingStop(this.name);
      this.collisions(this.collisionsEnabled);
      if ( callback ) {
        callback(this);
      }
      this.initXR();
    });
    
    return this;
  }
  
  /**
  Called after assets are loaded. By default calls initXR().
  Subclasses typically override this with some spatial manipulations, e.g. scaling the world.
  Subclasses may, but are not required, call super.loaded()
  @param file world file that has loaded
  @param mesh root mesh of the world
   */
  loaded( file, mesh ) {
    //FIXME
    //this.initXR();
  }
  
  /** Register render loop. */
  registerRenderLoop() {
    // Register a render loop to repeatedly render the scene
    this.renderLoop = () => {
      if ( this.scene ) {
        this.scene.render();
      } else {
        this.engine.stopRenderLoop(this.renderLoop);
      }
    }
    this.engine.runRenderLoop(this.renderLoop);
  }

  /**
  Utility method to fix the path and load the file, executes LoadAssetContainerAsync.
  @param relativePath path relative to current world directory
  @param file file name to load
   */
  async loadAsset(relativePath, file) {
    return VRSPACEUI.assetLoader.loadAsset(this.assetPath(relativePath)+file);
  }
  
  /**
  Utility method, returns baseUrl+relativePath
  @param relativePath path relative to current world directory
   */
  assetPath(relativePath) {
    return this.baseUrl+relativePath;
  }
  
  /**
  Write some text to world chat. Usually text appears above avatar's head and/or in chat log,
  but this method only sends own 'wrote' event.
  @param text something to say
   */
  write(text) {
    if ( this.worldManager && text ) {
      this.worldManager.write(text);
    }
  }
  /**
   * Receives a remote event. Default implementation handles only 'wrote' event, and sends it to the ChatLog. 
   * @param obj a VRObject that has changed
   * @param field a field that has changed, obj[field] contains the actual value
   * @param node root node in the scene that has received event, may be null
   */
  remoteEvent(obj, field, node) {
    if ( 'wrote' === field && this.chatLog ) {
      console.log(obj.id+' wrote '+obj.wrote);
      var name = obj.name;
      if ( ! name ) {
        name = 'u'+obj.id;
      }
      this.chatLog.log(name,obj.wrote);
    }
  }
  /**
  Utility method, returns true if the world is online, i.e. the client is connected to the server.
   */
  isOnline() {
    return this.worldManager && this.worldManager.isOnline();
  }

  /**
   * Add a selection predicate. It takes a mesh and returns true if it can be selected by the pointer.
   */
  addSelectionPredicate(p) {
    this.selectionPredicates.push(p);
  }
  /** Remove a selection predicate function */
  removeSelectionPredicate(p) {
    let pos = this.selectionPredicates.indexOf(p);
    if ( pos > -1 ) {
      this.selectionPredicates.splice(pos,1);
    }
  }

  /**
   * Activate first person camera (this.camera1p), if available.
   * Makes a call to AvatarController method that applies camera rotation and takes care of everything else.
   */  
  firstPerson() {
    if ( this.avatarController ) {
      this.avatarController.firstPerson();
    }
  }

  /**
   * Activate third person camera  (this.camera3p), if available.
   * Makes a call to AvatarController method that applies camera rotation and takes care of everything else.
   */  
  thirdPerson() {
    if ( this.avatarController ) {
      this.avatarController.thirdPerson();
    }
  }

  /**
   * Quick enter, with avatar url and optionally user name.
   * @param avatarUrl URL to load avatar from
   * @param userName login name of the user
   */
  async enterWith(avatarUrl, userName) {
    this.worldManager = new WorldManager(this);
    //this.worldManager.debug = true;
    this.worldManager.enterWith(avatarUrl,userName).then( avatar => {
      avatar.load( () => {
          this.avatarController = new AvatarController(this.worldManager, avatar);
          this.worldManager.addMyChangeListener( changes => this.avatarController.processChanges(changes) );
        });
    });
  }
  
  addListener(worldListener) {
    VRSPACE.addListener(this.worldListeners, worldListener);
  }
  
  removeListener(worldListener) {
    VRSPACE.removeListener(this.worldListeners, worldListener);
  }
}

