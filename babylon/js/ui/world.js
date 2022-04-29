import {VRSPACEUI} from './vrspace-ui.js';
import {VRHelper} from './vr-helper.js';

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
    /** Progress indicator */
    this.indicator = null;
    /** Progress indicator functon */
    this.onProgress = null;
    
    /** Handy reference to VRSpaceUI */
    this.VRSPACEUI = VRSPACEUI;
    /** Reference to worldManager, set by WorldManager once that user goes online */
    this.worldManager = null;
    
    // now override defaults
    if ( params ) {
      for ( var param in params ) {
        this[param] = params[param];
      }
    }
    
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
    if ( name ) {
      this.name = name;
    }
    this.scene = scene;
    this.vrHelper = null;
    if ( !this.baseUrl && baseUrl ) {
      this.baseUrl = baseUrl;
    }
    if ( !this.file && file ) {
      this.file = file;
    }
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
  
  /**
  Write some text to world chat. Usually text appears above avatar's head and/or in chat log,
  but this method only sends own 'wrote' event.
  @param text something to say
   */
  write(text) {
    if ( this.worldManager && text ) {
      this.worldManager.sendMy({wrote:text});
    }
  }
  
}

