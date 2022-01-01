import {VRSPACEUI} from './vrspace-ui.js';
import {VRHelper} from './vr-helper.js';

/**
Basic world, intended to be overridden.
Provides function placeholders for implementations, and safe implementation of basic functions, 
like loading of world file(s) and XR support.
There is no constructor, so subclasses are free to add any world specifics to their own constructors.
A world can also define defaults in the constructor, like baseUrl or file.
@abstract
 */
export class World {
  constructor() {
    this.VRSPACEUI = VRSPACEUI;
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
    this.name = name;
    this.scene = scene;
    this.vrHelper = null;
    if ( !this.file ) {
      if ( file ) {
        this.file = file;
      } else {
        this.file = "scene.gltf";
      }
    }
    if ( !this.baseUrl ){
      if ( baseUrl ) {
        this.baseUrl = baseUrl;
      } else {
        this.baseUrl = "";
      }
    }
    this.gravityEnabled = true;
    this.collisionsEnabled = true;
    await this.createScene(engine);
    if ( ! this.onProgress ) {
      this.indicator = VRSPACEUI.loadProgressIndicator(this.scene, this.camera);
      this.onProgress = (evt, name) => this.indicator.progress( evt, name )
    }
    this.registerRenderLoop();
    this.createTerrain();
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
  /** An implementation must override this method and define at least one camera */
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
  /** Optional, empty implementation, called from createScene */
  async createPhysics() {};
  /** Optional, empty implementation, called from createScene */
  async createTerrain() {}
  /** Attach the control to the camera, called from createScene. */
  attachControl() {
    this.camera.attachControl(this.canvas, true);
  }
  /**
  Optional, empty implementation, notification that the user has entered a multiuser world.
   */
  async entered(welcome) {
  }
  /**  */
  /**
  Utility method, creates a UniversalCamera and sets defaults: gravity, collisions, ellipsoid, keys.
  @param pos Vector3 to position camera at
  @param name optional camera name, default UniversalCamera
   */
  universalCamera(pos, name) {
    if ( !name ) {
      name = "UniversalCamera";
    } 
    var camera = new BABYLON.UniversalCamera(name, pos, this.scene);
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
    
    camera.touchAngularSensitivity = 5000;
    
    return camera;    
  }
  
  /**
  Disposes of all objects returned by createLights, createCamera, createShadows, createSkybox
   */
  async dispose() {
    if ( this.camera ) {
      this.camera.dispose();
      this.camera = null;    
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
  }

  /** Creates a VRHelper if needed, and initializes it with the current world.
  Normally called after world is loaded.
  @param vrHelper optional existing vrHelper
   */
  initXR(vrHelper) {
    if ( vrHelper ) {
      this.vrHelper = vrHelper;
    }
    if ( ! this.vrHelper ) {
      this.vrHelper = new VRHelper();
    }
    this.vrHelper.initXR(this);
  }
  trackXrDevices() {
  }
  
  /**
  Used in mesh selection predicate. Default implementation returns true for members of this.floorMeshes.
   */
  isSelectableMesh(mesh) {
    return this.floorMeshes && this.floorMeshes.includes(mesh);
  }

  /**
  Returns this.floorMeshes or this.ground if exist, or empty array.
   */
  getFloorMeshes() {
    if ( this.floorMeshes ) {
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
  Loads an AssetContainer, and adds it to the scene. Takes care of loading progress.
  Calls loadingStart, loaded, loadingStop, collisions - each may be overridden.
  @param callback to execute after the content has loaded
   */
  load(callback) {
    this.loadingStart(this.name);

    // TODO: use asset loader
    BABYLON.SceneLoader.LoadAssetContainer(this.baseUrl,
      this.file,
      this.scene,
      // onSuccess:
      (container) => {
        this.sceneMeshes = container.meshes;
        this.container = container;

        // Adds all elements to the scene
        var mesh = container.createRootMesh();
        mesh.name = this.name;
        container.addAllToScene();
      
        this.loaded( this.file, mesh );
        
        // do something with the scene
        VRSPACEUI.log("World loaded");
        this.loadingStop(this.name);
        this.collisions(this.collisionsEnabled);
        if ( callback ) {
          callback(this);
        }
      },
      // onProgress:
      (evt) => { this.loadProgress(evt, name) }
    );
    
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
    this.initXR();
  }
  
  /** Register render loop. */
  registerRenderLoop() {
    // Register a render loop to repeatedly render the scene
    var loop = () => {
      if ( this.scene ) {
        this.scene.render();
      } else {
        this.engine.stopRenderLoop(loop);
      }
    }
    this.engine.runRenderLoop(loop);
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
  
}

