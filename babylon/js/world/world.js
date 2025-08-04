import { VRSpaceUI, VRSPACEUI } from '../ui/vrspace-ui.js';
import { VRHelper } from '../xr/vr-helper.js';
import { ChatLog } from '../ui/widget/chat-log.js';
import { WorldManager } from '../core/world-manager.js';
import { AvatarController } from '../avatar/avatar-controller.js';
import { Avatar } from '../avatar/avatar.js';
import { VRSPACE } from '../client/vrspace.js';
import { WorldListener } from './world-listener.js';
import { CameraHelper } from '../core/camera-helper.js';
import { Terrain } from '../terrain/terrain.js';
import { Skybox } from './skybox.js';

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
   * @type {World}
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
    /** VR helper @type { VRHelper }*/
    this.vrHelper = null;
    /** AR helper @type { VRHelper }*/
    this.arHelper = null;
    /** Currently active VR/AR helper */
    this.xrHelper = null;
    /** Scene meshes, available once the world loads (in loaded, loadingStop, collisions methods) */
    this.sceneMeshes = null;
    /** Terrain, optionally created in createTerrain() @type {Terrain} */
    this.terrain = null;
    /** Skybox, optionally created in createSkybox() @type {Skybox} */
    this.skyBox = null;
    /** Terrain VRObject */
    this.sharedTerrain = null;
    /** Background VRObject */
    this.sharedSkybox = null;

    /** Handy reference to VRSpaceUI 
     * @type { VRSpaceUI }
    */
    this.VRSPACEUI = VRSPACEUI;
    /** Reference to worldManager, set by WorldManager once that user goes online @type { WorldManager } */
    this.worldManager = null;
    /** Reference to AvatarController, set by AvatarController during initialization @type { AvatarController } */
    this.avatarController = null;
    /** Reference to own Avatar or VideoAvatar, set by AvatarController during initialization @type { Avatar } */
    this.avatar = null;

    /** List of world listeners. 
    WorldManager executes enter(Welcome) method once user enters the world, after World.enter() method. 
    Methods added(VRObject) and removed(VRObject) are executed whenever the scene changes.
    Method loaded(VRObject) is called once the asset loads.
    */
    this.worldListeners = [];
    this.floorMeshes = [];
    this.floorEnabled = true;
    this.ground = null;
    // CHECKME: should floors be selectable?
    this.selectionPredicates = [(mesh) => { return this.getFloorMeshes().includes(mesh) }];

    // now override defaults
    if (params) {
      for (var param in params) {
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
    if (name) {
      this.name = name;
    }
    this.scene = scene;
    if (!this.baseUrl && baseUrl) {
      this.baseUrl = baseUrl;
    }
    if (!this.file && file) {
      this.file = file;
    }
    await this.createScene(engine);
    this.registerRenderLoop();
    // make sure it's available for any and all operations
    await VRSPACEUI.init(this.scene);
    if (!this.onProgress) {
      // CHECKME: replacing load progress indicator with custom one may load vrspace logo
      this.indicator = await VRSPACEUI.loadProgressIndicator(this.scene, this.camera);
      this.onProgress = (evt, name) => this.indicator.progress(evt, name)
    }
    const terrain = await this.createTerrain();
    if ( terrain ) {
      this.terrain = terrain;
    }
    if ( this.terrain && typeof this.terrain.added == "function") {
      // trigger when shared terrain is added 
      this.addListener(this.terrain);
    }
    
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
    if (!this.scene) {
      this.scene = new BABYLON.Scene(engine);
    }
    const camera = await this.createCamera();
    if (camera) {
      this.camera = camera;
    }
    if (!this.camera1p) {
      this.camera1p = this.camera;
    }
    this.attachControl();
    const light = await this.createLights();
    if (light) {
      this.light = light;
    }
    const shadowGenerator = await this.createShadows();
    if (shadowGenerator) {
      this.shadowGenerator = shadowGenerator;
    }
    const skyBox = await this.createSkyBox();
    if (skyBox) {
      this.skyBox = skyBox;
    }
    if ( this.skyBox && typeof this.skyBox.added == "function") {
      // trigger when shared terrain is added 
      this.addListener(this.skyBox);
    }
    const ground = await this.createGround();
    if (ground) {
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
    alert('Please override createCamera() method')
  }
  /** Optional, empty implementation, called from createScene. May return a Light */
  async createLights() { }
  /** Optional, empty implementation, called from createScene. Should return a ShadowGenerator. */
  async createShadows() { }
  /** Optional, empty implementation, called from createScene. Should return a sky Box. */
  async createSkyBox() { }
  /** Optional, empty implementation, called from createScene. Should return a mesh. */
  async createGround() { }
  /** Optional, empty implementation, called from createScene */
  async createEffects() { };
  /** Optional, called from createScene. Creates Havok physics engine and plugin, with this.scene.gravity.
   * Generally, to enable physics in the scene, just set gravity and call super.createPhysics().
   * Or to disable gravity, simply do not call super.
  */
  async createPhysics() {
    try {
      const havokInstance = await HavokPhysics();
      this.physicsPlugin = new BABYLON.HavokPlugin(true, havokInstance);
      this.scene.enablePhysics(this.scene.gravity, this.physicsPlugin);
    } catch (err) {
      console.error("Physics initialization error", err);
    }
  };
  /** Optional, empty implementation, called from createScene */
  async createTerrain() { }
  /** Optional, empty implementation, called from createScene */
  async createUI() { }
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
    this.chatLog = ChatLog.getInstance(this.scene);
    this.chatLog.show();
    this.worldManager.addChangeListener((obj, field, node) => this.remoteEvent(obj, field, node));
    this.chatLog.addListener((text, link) => this.write(text, link));
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
   * Creates first person camera and sets this.camera1p.
   * @see CameraHelper.firstPersonCamera
   */
  firstPersonCamera(pos, name = "First Person Camera") {
    this.camera1p = CameraHelper.getInstance(this.scene).firstPersonCamera(pos,name);
    return this.camera1p;
  }

  /** 
   * Utility method, creates 3rd person camera and sets this.camera3p.
   * @see CameraHelper.thirdPersonCamera
   */
  thirdPersonCamera(camera1p = this.camera) {
    this.camera3p = CameraHelper.getInstance(this.scene).thirdPersonCamera(camera1p);
    return this.camera3p;
  }

  /**
  Disposes of all objects returned by createLights, createCamera, createShadows, createSkybox
   */
  async dispose() {
    if (this.camera) {
      this.camera.dispose();
      this.camera = null;
    }
    if (this.camera3p) {
      this.camera3p.dispose();
      this.camera3p = null;
    }
    if (this.skyBox) {
      this.skyBox.dispose();
      this.skyBox = null;
    }
    if (this.light) {
      this.light.dispose();
      this.light = null;
    }
    if (this.shadowGenerator) {
      this.shadowGenerator.dispose();
      this.shadowGenerator = null;
    }
    if (this.renderLoop) {
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
    if (vrHelper) {
      this.vrHelper = vrHelper;
    }
    if (!this.vrHelper) {
      this.vrHelper = VRHelper.getInstance("immersive-vr");
    }
    this.vrHelper.initXR(this);

    if (arHelper) {
      this.arHelper = arHelper;
    }
    if (!this.arHelper) {
      this.arHelper = VRHelper.getInstance("immersive-ar");
    }
    // this flag may not work due to asynchronous calls
    if (VRSPACEUI.canAR) {
      this.arHelper.initXR(this)
    }

    if (activeHelper && activeHelper == arHelper) {
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
    if (this.chatLog) {
      this.chatLog.input.virtualKeyboardEnabled = true;
    }
  }
  /** Called by VR helper after exiting XR. Default implementation turns off ChatLog virtual keyboard.*/
  exitXR() {
    if (this.chatLog) {
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
  Used in mesh selection predicate in XR, for world elements only. 
  Default implementation returns true for members of this.floorMeshes.
   */
  isSelectableMesh(mesh) {
    return this.selectionPredicates.findIndex(p => p(mesh)) > -1;
  }

  /**
  Returns this.floorMeshes or this.ground if exist, or empty array.
  Used for movement in XR.
   */
  getFloorMeshes() {
    if ( this.floorEnabled ) {
      if (this.floorMeshes && this.floorMeshes.length > 0) {
        return this.floorMeshes;
      } else if (this.ground) {
        return [this.ground];
      }      
    }
    return [];
  }
  
  /**
   * Enable/disable floor/ground selection, includes manipulation and teleportation
   * @param {boolean} enable 
   */
  enableFloorSelection(enable) {
    this.floorEnabled = enable;
  }
  
  /**
  Enables or disables collisions in the world. This includes floorMeshes, sceneMeshes, and also applying gravity to camera.
  @param state true or false
   */
  collisions(state) {
    this._collisions(this.floorMeshes, this.collisionsEnabled && state);
    this._collisions(this.sceneMeshes, this.collisionsEnabled && state);
    this.camera.applyGravity = this.gravityEnabled && state;
    this.camera._needMoveForGravity = this.gravityEnabled && state;
  }

  /**
  Utility method, enables or disables collisions on the given set of meshes.
  @param meshes array of meshes
  @param state true or false
   */
  _collisions(meshes, state) {
    if (meshes) {
      for (var i = 0; i < meshes.length; i++) {
        this.setMeshCollisions(meshes[i], state);
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
  loadProgress(evt, name) {
    if (this.onProgress) {
      this.onProgress(evt, name);
    }
  }
  /**
  Called if loading the world fails. Passes the exception to this.onFailure handler if it exists,
  otherwise logs it to the console.
  @param exception whatever caused loading to fail
   */
  loadFailed(exception) {
    if (this.onFailure) {
      this.onFailure(exception);
    } else {
      console.log("Error loading world " + this.name, exception);
    }
    if (this.indicator) {
      this.indicator.remove(this.name);
    }
  }
  /**
  Called when loading starts. Calls this.indicator.add if available.
  @param name
   */
  loadingStart(name) {
    if (this.indicator) {
      this.indicator.add(name);
    }
  }
  /**
  Called when loading finishes. Calls this.indicator.remove if available.
  @param name
   */
  loadingStop(name) {
    if (this.indicator) {
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
    if (this.file) {
      var scenePromise = VRSPACEUI.assetLoader.loadAsset(this.baseUrl + this.file,
        // onSuccess:
        (url, container, info) => {
          this.sceneMeshes = container.meshes;
          this.container = container;

          // Adds all elements to the scene
          var mesh = container.createRootMesh();
          mesh.name = this.name;
          container.addAllToScene();

          this.loaded(this.file, mesh);

        },
        // onError:
        exception => this.loadFailed(exception),
        // onProgress:
        evt => this.loadProgress(evt, this.name)
      );
      promises.push(scenePromise);
    }

    if (this.objectsFile) {
      var response = await fetch(this.baseUrl + this.objectsFile);
      var json = response.json();
      this.worldObjects = JSON.parse(json);
    }

    if (this.worldObjects) {
      this.sceneMeshes = [];
      for (var url in this.worldObjects) {
        var instances = this.worldObjects[url].instances;
        if (!url.startsWith("/")) {
          // relative url, make it relative to world script path
          // CHECKME/FIXME: what about absolute ones starting with https://?
          url = this.baseUrl + url;
        }
        instances.forEach((instance) => {
          var objPromise = VRSPACEUI.assetLoader.loadAsset(url,
            // callback 
            (loadedUrl, container, info, instances) => {
              if (instances) {
                var mesh = obj.instantiatedEntries.rootNodes[0];
                // CHECKME: untested
                var children = mesh.getChildMeshes();
                this.sceneMeshes.push(...children);
              } else {
                // Adds all elements to the scene
                var mesh = container.createRootMesh();
                var pos = loadedUrl.lastIndexOf('/');
                if (pos >= 0) {
                  mesh.name = loadedUrl.substring(pos + 1);
                }
                container.addAllToScene();
                this.sceneMeshes.push(...container.meshes);
              }
              if (instance.position) {
                mesh.position = new BABYLON.Vector3(instance.position.x, instance.position.y, instance.position.z);
              }
              if (instance.rotation) {
                mesh.rotation = new BABYLON.Vector3(instance.rotation.x, instance.rotation.y, instance.rotation.z);
              }
              if (instance.scale) {
                mesh.scaling = new BABYLON.Vector3(instance.scale.x, instance.scale.y, instance.scale.z);
              }
              this.loaded(loadedUrl, mesh);
            },
            // onError:
            exception => this.loadFailed(exception),
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
      if (callback) {
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
  loaded(file, mesh) {
    //FIXME
    //this.initXR();
  }

  /** Register render loop. */
  registerRenderLoop() {
    // Register a render loop to repeatedly render the scene
    this.renderLoop = () => {
      if (this.scene) {
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
    return VRSPACEUI.assetLoader.loadAsset(this.assetPath(relativePath) + file);
  }

  /**
  Utility method, returns baseUrl+relativePath
  @param relativePath path relative to current world directory
   */
  assetPath(relativePath) {
    return this.baseUrl + relativePath;
  }

  /**
  Write some text to world chat. Usually text appears above avatar's head and/or in chat log,
  but this method only sends own 'wrote' event.
  @param text something to say
  @param link optional url to link the text with
   */
  write(text, link) {
    if (this.worldManager && text) {
      let msg = {
        text: text
      }
      if ( link ) {
        msg['link'] = link;
      }
      this.worldManager.write(msg);
    }
  }
  /**
   * Receives a remote event. Default implementation handles only 'wrote' event, and sends it to the ChatLog. 
   * @param obj a VRObject that has changed
   * @param field a field that has changed, obj[field] contains the actual value
   * @param node root node in the scene that has received event, may be null
   */
  remoteEvent(obj, field, node) {
    if ('wrote' === field && this.chatLog) {
      console.log(obj.id + ' wrote ' + obj.wrote);
      var name = obj.name;
      if (!name) {
        name = 'u' + obj.id;
      }
      if ( typeof obj.wrote === 'object' ) {
        this.chatLog.log(name, obj.wrote.text, obj.wrote.link);
      } else if ( typeof obj.wrote === 'string' ) {
        this.chatLog.log(name, obj.wrote);
      } else {
        console.error("Unknown type "+ typeof obj.wrote+": ",obj.wrote)
      }
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
    let pos = this.selectionPredicates.indexOf(p);
    if (pos == -1) {
      this.selectionPredicates.push(p);
    }
  }
  /** Remove a selection predicate function */
  removeSelectionPredicate(p) {
    let pos = this.selectionPredicates.indexOf(p);
    if (pos > -1) {
      this.selectionPredicates.splice(pos, 1);
    }
  }

  /**
   * Activate first person camera (this.camera1p), if available.
   * Makes a call to AvatarController method that applies camera rotation and takes care of everything else.
   */
  firstPerson() {
    if (this.avatarController) {
      this.avatarController.firstPerson();
    }
  }

  /**
   * Activate third person camera  (this.camera3p), if available.
   * Makes a call to AvatarController method that applies camera rotation and takes care of everything else.
   */
  thirdPerson() {
    if (this.avatarController) {
      this.avatarController.thirdPerson();
    }
  }
  
  inThirdPerson() {
    return this.camera3p && this.scene.activeCamera == this.camera3p;
  }
  
  /**
   * Set own avatar, valid only while online. Makes a call to AvatarController method, if available.
   * @param {Avatar} avatar 
   */
  setAvatar(avatar) {
    if (this.avatarController) {
      this.avatarController.setAvatar(avatar);
    }
  }

  /**
   * Quick enter, with avatar url and optionally user name.
   * @param {string} avatarUrl URL to load avatar from
   * @param {string} [userName] login name of the user
   */
  async enterWith(avatarUrl, userName) {
    this.worldManager = new WorldManager(this);
    //this.worldManager.debug = true;
    this.worldManager.enterWith(avatarUrl, userName).then(avatar => {
      avatar.load(() => {
        this.avatarController = new AvatarController(this.worldManager, avatar);
        this.worldManager.addMyChangeListener(changes => this.avatarController.processChanges(changes));
      });
    });
  }

  /**
   * Add a world listener to listen for world events
   * @param {WorldListener} worldListener 
   */
  addListener(worldListener) {
    VRSPACE.addListener(this.worldListeners, worldListener);
  }

  /**
   * Remove a world listener
   */
  removeListener(worldListener) {
    VRSPACE.removeListener(this.worldListeners, worldListener);
  }

}