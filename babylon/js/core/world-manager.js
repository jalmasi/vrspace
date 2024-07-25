import {VRSPACE} from '../client/vrspace.js';
import {VRSPACEUI} from '../ui/vrspace-ui.js';
import {HumanoidAvatar} from '../avatar/humanoid-avatar.js';
import {VideoAvatar} from '../avatar/video-avatar.js';
import {ServerFolder} from './server-folder.js';
import {MeshAvatar} from '../avatar/mesh-avatar.js';
import { BotController } from '../avatar/bot-controller.js';

/**
Manages world events: tracks local user events and sends them to the server, 
and tracks network events and applies them to local scene.
Loads avatars of other users and maps network events to their avatars, 
including user video and audio streams.
 */
export class WorldManager {
  static instance = null;
  /** Creates world manager with default values and connection, scene, camera listeners.
  @param world
  @param fps network framerate, default 5 (send up to 5 events per second)
   */
  constructor(world, fps) {
    if ( WorldManager.instance ) {
      throw "WorldManager already created";
    }
    /** the world */
    this.world = world;
    /** client tokens */
    this.tokens = null;
    /** the scene */
    this.scene = world.scene;
    /** Movement resolution, default 1 cm/3.6 deg. Any movement less than this will be ignored.*/
    this.resolution = 0.01; // 1 cm/3.6 deg
    /** Create animations for movement of avatars, default true. Recommended for low fps.*/
    this.createAnimations = true;
    /** Custom avatar options, applied to avatars after loading. Currently video avatars only */
    this.customOptions = null;
    /** Custom avatar animations */
    this.customAnimations = null;
    /** Whether to track user rotation, default true. */
    this.trackRotation = true;
    /** In 3rd person view, we're not tracking and publishing position and orientation camera, but of this mesh*/
    this.trackedMesh = null;
    /** This is set once we connect to streaming server */
    this.mediaStreams = null;
    /** Listeners notified after own avatar property (e.g. position) has changed and published */
    this.myChangeListeners = []
    /** Change listeners receive changes applied to all shared objects */
    this.changeListeners = [];
    /** Optionally called after an avatar has loaded. Callback is passed VRObject and avatar object as parameters.
    Avatar object can be either Avatar or VideoAvatar instance, or an AssetContainer.
    */
    this.loadCallback = null;
    /** Avatar factory, default this.createAvatar */
    this.avatarFactory = this.createAvatar;
    /** Default position applied after an avatar loads */
    this.defaultPosition = new BABYLON.Vector3( 1000, 1000, 1000 );
    /** Default rotation applied after an avatar loads */
    this.defaultRotation = new BABYLON.Vector3( 0, 0, 0 );
    /** Mobile browsers don't have javascript console, and USB debugging is next to useless.
    Enable to redirect all console output to the server log. Sure, it starts only after connection to the server is established.
     */
    this.remoteLogging = false;
    if ( ! this.scene.activeCamera ) {
      console.log("Undefined camera in WorldManager, tracking disabled")
    } else {
      this.trackCamera();
    }
    this.scene.onActiveCameraChanged.add( () => { this.trackCamera() } );
    this.VRSPACE = VRSPACE;
    /** Network frames per second, default 5 */
    this.fps = 5;
    if ( fps ) {
      this.fps = fps
    }
    /** Current position */
    this.pos = { x: null, y: null, z: null };
    /** Current rotation */
    this.rot = { x: null, y: null, z: null };
    /** Current left arm position */
    this.leftArmPos = { x: null, y: null, z: null };
    /** Current right arm position */
    this.rightArmPos = { x: null, y: null, z: null };
    /** Current left arm rotation */
    this.leftArmRot = { x: null, y: null, z: null, w: null };
    /** Current right arm rotation */
    this.rightArmRot = { x: null, y: null, z: null, w: null };
    /** User height in real world, default 1.8 */
    this.userHeight = 1.8;
    /** Called when loading fails, default null. */
    this.loadErrorHandler = null;
    this.interval = null;
    VRSPACE.addWelcomeListener((welcome) => this.setSessionStatus(true));
    VRSPACE.addSceneListener((e) => this.sceneChanged(e));
    /** Enable debug output */
    this.debug = false;
    this.world.worldManager = this;
    this.notFound = []; // 404 cache used for avatar fix files
    VRSPACEUI.init(this.scene); // to ensure assetLoader is available
    WorldManager.instance = this;
  }
  /** Publish and subscribe */
  pubSub( user, autoPublishVideo ) {
    // CHECKME: should it be OpenVidu or general streaming service name?
    if ( this.mediaStreams && user.tokens && user.tokens.OpenVidu ) {
      this.log("Subscribing as User "+user.id+" with token "+user.tokens.OpenVidu);
      // obtain token and start pub/sub voices
      if ( autoPublishVideo ) {
        this.mediaStreams.startVideo = true;
        this.mediaStreams.videoSource = undefined;
      }
      this.mediaStreams.connect(user.tokens.OpenVidu).then(() => this.mediaStreams.publish());
    }
    // we may need to pause/unpause audio publishing during speech input
    VRSPACEUI.hud.speechInput.constructor.mediaStreams = this.mediaStreams;
  }

  /** Optionally log something */
  log( what ) {
    if (this.debug) {
      console.log(what);
    }
  }
  
  /** Track a mesh, used in 3rd person view */
  trackMesh(mesh) {
    if ( mesh ) {
      this.log("Tracking mesh "+mesh.id);
    } else if ( this.trackedMesh ) {
      this.log("Stopped tracking mesh "+this.trackedMesh.id);
    }
    this.trackedMesh = mesh;
  }
  
  /** Tracks active camera */
  trackCamera(camera) {
    if ( ! camera ) {
      camera = this.scene.activeCamera;
    }
    if ( camera ) {
      this.log("Tracking camera "+camera.getClassName())
      this.camera = camera;
    }
  }
  
  /** Called when connection to the server is established (connection listener)*/
  setSessionStatus(active) {
    this.log("Session status: "+active);
    if ( active ) {
      if ( ! this.interval ) {
        this.interval = setInterval(() => this.trackChanges(), 1000/this.fps);        
      }
    } else if ( this.interval ) {
      clearInterval( this.interval );
      this.interval = null;
    }
  }
  
  /** Returns true if connected to the server and session is active*/
  isOnline() {
    return this.interval != null;
  }

  /** Called when scene has changed (scene listener). 
  If an object was added, calls either loadAvatar, loadStream or loadMesh, as appropriate.
  If an object was removed, calls removeObject.
  Any WorldListeners on the world are notified after changes are performed, by calling added and removed methods.
  @param e SceneEvent containing the change
  */
  sceneChanged(e) {
    if (e.added != null) {
      this.log("ADDED " + e.objectId + " new size " + e.scene.size);
      this.log(e);

      if (typeof e.added.hasAvatar != 'undefined' && e.added.hasAvatar) {
        if (e.added.humanoid) {
          this.loadAvatar(e.added);
        } else if (e.added.video) {
          this.loadStream(e.added);
        } else {
          this.loadMeshAvatar(e.added);
        }
      } else if (e.added.mesh) {
        this.loadMesh(e.added);
      } else if (e.added.script) {
        this.loadScript(e.added);
      } else {
        // TODO server needs to ensure that mesh exists
        // in the meantime we define default behavior here
        console.log("WARNING: can't load "+e.objectId+" - no mesh");
      }
      this.world.worldListeners.forEach(listener => {
        try {
          if ( listener.added ) {
            listener.added(e.added);
          }
        } catch ( error ) {
          console.log("Error in world listener", error);
        }
      });
    } else if (e.removed != null) {
      this.log("REMOVED " + e.objectId + " new size " + e.scene.size)
      this.removeObject( e.removed );
      try {
        this.world.worldListeners.forEach(listener => {
          try {
            if ( listener.removed ) {
              listener.removed(e.removed);
            }
          } catch ( error ) {
            console.log("Error in world listener", error);
          }
        });
      } catch ( error ) {
        console.log("Error in scene listener",error);
      }
    } else {
      this.log("ERROR: invalid scene event");
    }
  }

  /** Default video avatar factory method */
  createAvatar(obj) {
    return new VideoAvatar(this.scene, null, this.customOptions);
  }
  
  /**
  Load a video avatar, attach a listener to it.
   */
  loadStream( obj ) {
    this.log("loading stream for "+obj.id);
    
    var video = this.avatarFactory(obj);
    video.autoStart = false;
    video.autoAttach = false;
    if ( obj.name ) {
      video.altText = obj.name;    
    } else {
      video.altText = "u"+obj.id;
    }
    video.show();
    video.mesh.name = obj.mesh;
    // obfuscators get in the way 
    //video.mesh.id = obj.constructor.name+" "+obj.id;
    video.mesh.id = obj.className+" "+obj.id;
    obj.avatar = video;
    
    var parent = new BABYLON.TransformNode("Root of "+video.mesh.id, this.scene);
    video.mesh.parent = parent;
    parent.VRObject = obj;
          
    this.log("Added stream "+obj.id);
    
    if ( obj.position.x == 0 && obj.position.y == 0 && obj.position.z == 0) {
      // avatar position has not yet been initialized, use default
      parent.position = new BABYLON.Vector3(this.defaultPosition.x,this.defaultPosition.y,this.defaultPosition.z); 
      obj.position = this.defaultPosition;
      var initialPosition = { position: {} };
      this.changeObject( obj, initialPosition, parent );
    } else {
      // apply known position
      parent.position = new BABYLON.Vector3(obj.position.x, obj.position.y, obj.position.z)
    }
    
    if ( obj.rotation ) {
      if ( obj.rotation.x == 0 && obj.rotation.y == 0 && obj.rotation.z == 0) {
        // avatar rotation has not yet been initialized, use default
        parent.rotation = new BABYLON.Vector3(this.defaultRotation.x,this.defaultRotation.y,this.defaultRotation.z); 
        obj.rotation = this.defaultRotation;
        var initialRotation = { rotation: {} };
        this.changeObject( obj, initialRotation, parent );
      } else {
        // apply known rotation
        parent.rotation = new BABYLON.Vector3(obj.rotation.x, obj.rotation.y, obj.rotation.z)
      }
    }
    
    obj.addListener((obj, changes) => this.changeObject(obj, changes, parent));
    if ( this.mediaStreams ) {
      this.mediaStreams.streamToMesh(obj, video.mesh);
    } else {
      console.log("WARNING: unable to stream to "+obj.id+" - no MediaStreams")
    }
    this.notifyLoadListeners(obj,video);
  }
  
  /**
   * Quick enter, with avatar url and optionally user name.
   * @param avatarUrl URL to load avatar from
   * @param userName login name of the user
   * @returns own Avatar instance
   */
  async enterWith(avatarUrl, userName) {
    let avatar = await this.createAvatarFromUrl(avatarUrl);
    avatar.name = userName;
    await this.enterAs(avatar);
    return avatar;
  }
  
  /**
   * Enter the world as avatar.
   * Creates propererties by taking user name, height and avatar url from given Avatar,
   * then calls enter( properties ).
   */
  async enterAs( avatar ) {
    let myProperties = {
      mesh:avatar.getUrl(),
      userHeight:this.userHeight,
      video:avatar.video,
      humanoid:avatar.humanoid
    };
    if ( avatar.name ) {
      myProperties.name = avatar.name;
    }
    return this.enter( myProperties );
  }

  /**
   * Creates new Avatar instance from the URL
   * @param url URL to load avatar from 
   */  
  async createAvatarFromUrl(url) {
    // CHECKME: move this to asset loader?
    if ( url.startsWith('/') && VRSPACEUI.contentBase ) {
      url = VRSPACEUI.contentBase+url;
    }
    var pos = url.lastIndexOf('/');
    var path = url.substring(0,pos);
    var file = url.substring(pos+1);
    // FIXME really bad way to parse path and create ServerFolder
    pos = path.lastIndexOf('/');
    var baseUrl = path.substring(0,pos+1);
    var dir = path.substring(pos+1);
    
    //find if fix file exist
    var fix = baseUrl+dir+"-fixes.json"; // gltf fix - expected in top-level directory
    if ( file.toLowerCase().endsWith('.glb')) {
      // glb fixes - expected in the same directory
      fix = url.substring(0,url.lastIndexOf('.'))+'-fixes.json';
    }
    if ( ! this.notFound.includes(fix)) {
      // FIXME this await has to go away
      await fetch(fix, {cache: 'no-cache'}).then(response => {
        if ( ! response.ok ) {
          this.notFound.push( fix );
          fix = null;
        }
      }).catch(err=>{
        // rather than not found we can get CORS error
        this.notFound.push(fix);
        fix = null;
        console.log(err);
      });
    } else {
      fix = null;
    }
    var folder = new ServerFolder( baseUrl, dir, fix );
    var avatar = new HumanoidAvatar(this.scene, folder);
    avatar.animations = this.customAnimations;
    avatar.file = file;
    avatar.fps = this.fps;
    avatar.generateAnimations = this.createAnimations;
    // GLTF characters are facing the user when loaded, turn it around
    // this doesn't do anything for cloned characters, affects only first one that loads
    avatar.turnAround = true;

    //avatar.debug = false; // or this.debug?
    return avatar;
  }
  
  /** 
   * Load a 3D avatar, attach a listener to it
   * @param obj VRObject that represents the user 
   */
  async loadAvatar(obj) {
    this.log("loading avatar "+obj.mesh);
    var avatar = await this.createAvatarFromUrl(obj.mesh);
    avatar.userHeight = obj.userHeight;
    avatar.load( (avatar) => {
      obj.avatar = avatar;
      obj.instantiatedEntries = avatar.instantiatedEntries;
      avatar.VRObject = obj;
      // apply current name, position and rotation
      this.changeAvatar(obj, { name: obj.name, position: obj.position });
      if ( obj.rotation ) {
        // FIXME rotation can be null sometimes (offline users?)
        this.changeAvatar(obj, { rotation: obj.rotation });
      }
      // TODO also apply other non-null properties here
      if ( obj.animation ) {
        this.changeAvatar( obj, {animation: obj.animation});
      }
      // add listener to process changes
      obj.addListener((obj, changes) => this.changeAvatar(obj, changes));
      // subscribe to media stream here if available
      if ( this.mediaStreams ) {
        this.mediaStreams.streamToMesh(obj, obj.avatar.baseMesh());        
      }
      if ( obj.className.indexOf("Bot") >= 0 ) {
        console.log("Bot loaded");
        // TODO bot controller
        obj.avatarController = new BotController(this, avatar);
      }
      this.notifyLoadListeners(obj, avatar);
    }, (error) => {
      console.log("Failed to load humanoid avatar, loading as mesh");
      obj.humanoid = false;
      this.loadMeshAvatar(obj);
    }
    );
  }
  
  notifyLoadListeners(obj, avatar) {
    if ( this.loadCallback ) {
      this.loadCallback(obj, avatar);
    }
    this.world.worldListeners.forEach(listener => {
      try {
        if ( listener.loaded) {
          listener.loaded(obj);
        }
      } catch ( error ) {
        console.log("Error in world listener", error);
      }
    });
  }
  
  /** Apply remote changes to an avatar (VRObject listener) */
  changeAvatar(obj,changes) {
    this.log( 'Processing changes on avatar' );
    this.log(changes);
    var avatar = obj.avatar;
    for ( var field in changes ) {
      var node = avatar.baseMesh();
      // TODO introduce event handler functions in Avatar class, use only routeEvent here
      if ( 'position' === field ) {
        if ( ! obj.translate ) {
          obj.translate = VRSPACEUI.createAnimation(node, "position", this.fps);
        }
        VRSPACEUI.updateAnimation(obj.translate, node.position, obj.position);
      } else if ( 'rotation' === field ) {
        if ( ! obj.rotate ) {
          obj.rotate = VRSPACEUI.createQuaternionAnimation(node, "rotationQuaternion", this.fps);
        }
        VRSPACEUI.updateQuaternionAnimationFromVec(obj.rotate, node.rotationQuaternion, obj.rotation);
      } else if ( 'animation' === field ) {
        avatar.startAnimation(obj.animation.name, obj.animation.loop, obj.animation.speed);
      } else if ( 'leftArmPos' === field ) {
        var pos = new BABYLON.Vector3(obj.leftArmPos.x, obj.leftArmPos.y, obj.leftArmPos.z);
        avatar.reachFor(avatar.body.rightArm, pos);
      } else if ( 'rightArmPos' === field ) {
        var pos = new BABYLON.Vector3(obj.rightArmPos.x, obj.rightArmPos.y, obj.rightArmPos.z);
        avatar.reachFor(avatar.body.leftArm, pos);
      } else if ( 'leftArmRot' === field ) {
        avatar.body.leftArm.pointerQuat = new BABYLON.Quaternion(obj.rightArmRot.x, obj.rightArmRot.y, obj.rightArmRot.z, obj.rightArmRot.w)
      } else if ( 'rightArmRot' === field ) {
        avatar.body.rightArm.pointerQuat = new BABYLON.Quaternion(obj.leftArmRot.x, obj.leftArmRot.y, obj.leftArmRot.z, obj.leftArmRot.w)
      } else if ( 'name' === field ) {
        avatar.setName(obj.name);
      } else if ( 'userHeight' === field ) {
        avatar.trackHeight(obj.userHeight);
      } else {
        this.routeEvent(obj,field,node);
      }
      this.notifyListeners( obj, field, node);
    }
  }

  /** Notify listeners of remote changes */
  notifyListeners(obj, field, node) {
    this.changeListeners.forEach( (l) => l(obj,field,node) );
  }
  
  /** Add a listener to own events */
  addMyChangeListener( listener ) {
    VRSPACE.addListener( this.myChangeListeners, listener );
  }
  
  /** Remove listener to own events */
  removeMyChangeListener( listener ) {
    VRSPACE.removeListener( this.myChangeListeners, listener );
  }

  /** Add a listener to remote events */
  addChangeListener( listener ) {
    VRSPACE.addListener( this.changeListeners, listener );
  }
  
  /** Remove listener to remote events */
  removeChangeListener( listener ) {
    VRSPACE.removeListener( this.changeListeners, listener );
  }

  /** Any 3d object can be an avatar */
  loadMeshAvatar(obj) {
    let avatar = new MeshAvatar(this.scene, obj);
    this.loadMesh(obj, mesh=>{
      avatar.mesh = mesh;
      obj.avatar = avatar;
      var bbox = avatar.baseMesh().getHierarchyBoundingVectors();
      this.log("Bounding box:");
      this.log(bbox);
      avatar.userHeight = bbox.max.y-bbox.min.y;
      avatar.setName(obj.name);
    });
  }
  /**
  Load an object and attach a listener.
   */
  async loadMesh(obj, callback) {
    this.log("Loading object "+obj.mesh);
    if ( ! obj.mesh ) {
      console.log("Null mesh of client "+obj.id);
      return;
    }
    // CHECKME: do this in AssetLoader?
    if ( obj.mesh.startsWith('/') && VRSPACEUI.contentBase ) {
      obj.mesh = VRSPACEUI.contentBase+obj.mesh;
    }
    VRSPACEUI.assetLoader.loadObject(obj, (mesh) => {
      this.log("loaded "+obj.mesh);
      
      var initialPosition = { position: {} };
      this.changeObject( obj, initialPosition );
      if ( obj.scale ) {
        this.changeObject( obj, {scale: {x:obj.scale.x, y:obj.scale.y, z:obj.scale.z}});
      }
      if ( obj.rotation ) {
        // CHECKME: quaternion?
        this.changeObject( obj, {rotation: {x:obj.rotation.x, y:obj.rotation.y, z:obj.rotation.z}});
      }

      // add listener to process changes - active objects only
      if ( obj.active ) {
        obj.addListener((obj, changes) => this.changeObject(obj, changes));
        // subscribe to media stream here if available
        if ( this.mediaStreams ) {
          this.mediaStreams.streamToMesh(obj, mesh);        
        }
      }
      this.notifyLoadListeners(obj, mesh);
      if ( callback ) {
        callback(mesh);
      }
    }, this.loadErrorHandler);
  }

  /**
   * Load a script, call it's constructor with the VRObject, then calls init(), and adds the listener.
   * See basic-script.js and web-portal.js.
   */
  loadScript(obj) {
    import(obj.script).then(module=>{
      console.log(module);
      let className = Object.keys(module)[0];
      console.log("TODO: loading script "+className);
      let cls = module[className];
      var instance = new cls(this.world, obj);
      console.log("instance", instance);
      
      this.notifyLoadListeners(obj, instance);
      
      var node = instance.init();
      if ( node && obj.active ) {
        obj.addListener((obj, changes) => this.changeObject(obj, changes, node));
      }
    });
  }
  /**
  Utility method, calculates bounding box for an AssetContainer.
  @returns Vector3 bounding box
   */
  boundingBox(container) {
    var maxSize = new BABYLON.Vector3(0,0,0);
    for ( var i = 0; i < container.meshes.length; i++ ) {
      // have to recompute after scaling
      //container.meshes[i].computeWorldMatrix(true);
      container.meshes[i].refreshBoundingInfo();
      var boundingInfo = container.meshes[i].getBoundingInfo().boundingBox;
      //console.log("max: "+boundingInfo.maximumWorld+" min: "+boundingInfo.minimumWorld);
      var size = new BABYLON.Vector3(
        boundingInfo.maximumWorld.x - boundingInfo.minimumWorld.x,
        boundingInfo.maximumWorld.y - boundingInfo.minimumWorld.y,
        boundingInfo.maximumWorld.z - boundingInfo.minimumWorld.z
      );
      maxSize.x = Math.max(maxSize.x,size.x);
      maxSize.y = Math.max(maxSize.y,size.y);
      maxSize.z = Math.max(maxSize.z,size.z);
      //if (shadows) {
        //shadowGenerator.getShadowMap().renderList.push(container.meshes[i]);
      //}
    }
    console.log("BBoxMax: "+maxSize);
    return maxSize;
  }

  // works only for already displayed meshes
  bBox(mesh, maxSize) {
    if ( !maxSize ) {
      maxSize = new BABYLON.Vector3(0,0,0);
    }
    for ( var i = 0; i < mesh.getChildren().length; i++ ) {
      maxSize = this.bBox(mesh.getChildren()[i], maxSize);
    }
    if ( ! mesh.refreshBoundingInfo ) {
      // TypeError: mesh.refreshBoundingInfo is not a function
      return maxSize;
    }
    mesh.computeWorldMatrix(true);
    console.log(mesh.id);
    var boundingInfo = mesh.getBoundingInfo().boundingBox;
    var size = new BABYLON.Vector3(
      boundingInfo.maximumWorld.x - boundingInfo.minimumWorld.x,
      boundingInfo.maximumWorld.y - boundingInfo.minimumWorld.y,
      boundingInfo.maximumWorld.z - boundingInfo.minimumWorld.z
    );
    maxSize.x = Math.max(maxSize.x,size.x);
    maxSize.y = Math.max(maxSize.y,size.y);
    maxSize.z = Math.max(maxSize.z,size.z);
    console.log("BBoxMax: "+maxSize);
    return maxSize;
  }

  /**
  Utility method, calculates bounding box for an AssetContainer and returns maximum of x,y,z.
  Works only for meshes already rendered
   */
  bBoxMax(mesh) {
    var bbox = this.bBox( mesh );
    console.log("BBox: "+bbox);
    return Math.max( bbox.x, Math.max(bbox.y, bbox.z));
  }
  
  getRootNode( obj ) {
    if ( obj.avatar ) {
      return obj.avatar.baseMesh();
    } else if ( obj.container ) {
      return obj.container.meshes[0];
    } else if ( obj.instantiatedEntries ) {
      return obj.instantiatedEntries.rootNodes[0];
    }
    console.log("ERROR: unknown root for "+obj);
  }
  
  /** Apply remote changes to an object. */
  changeObject(obj,changes, node) {
    this.log("Changes on "+obj.id+": "+JSON.stringify(changes));
    if ( ! node ) {
      node = this.getRootNode(obj);
    }
    for ( var field in changes ) {
      if ( 'position' === field ) {
        if ( ! obj.translate ) {
          obj.translate = VRSPACEUI.createAnimation(node, "position", this.fps);
        }
        VRSPACEUI.updateAnimation(obj.translate, node.position, obj.position);
      } else if ( 'rotation' === field ) {
        if ( ! obj.rotate ) {
          obj.rotate = VRSPACEUI.createAnimation(node, "rotation", this.fps);
        }
        VRSPACEUI.updateAnimation(obj.rotate, node.rotation, obj.rotation);
      } else if ( 'scale' === field ) {
        if ( ! obj.rescale ) {
          obj.rescale = VRSPACEUI.createAnimation(node, "scaling", this.fps);
        }
        VRSPACEUI.updateAnimation(obj.rescale, node.scaling, obj.scale);
      } else {
        this.routeEvent( obj, field, node );
      }
      this.notifyListeners( obj, field, node);
    }
  }
  
  /** Called when applying changes other than rotation and translation:
  executes a method if such a method exists, passing it a current instance of associated VRObject.
  @param obj VRObject to apply change to
  @param field member field to set or method to execute 
   */
  routeEvent(obj, field, node) {
    var object = obj;
    if ( obj.avatar ) {
      object = obj.avatar;
    } else if ( obj.container ) {
      object = obj.container;
    } else if ( obj.instantiatedEntries ) {
      object = obj.instantiatedEntries;
    } else {
      //this.log("Ignoring unknown event "+field+" to object "+obj.id);
      return;      
    }
    if (typeof object[field] === 'function') {
      object[field](obj);
    } else if (typeof obj[field+'Changed'] === 'function') {
      obj[field+'Changed'](obj);
    //} else if (object.hasOwnProperty(field)) {
    } else {
      //console.log("Ignoring unknown event to "+obj+": "+field);
    }
  }

  /** 
   * Remove an object: remove the mesh from the scene (scene listener), and dispose of everything.
  */
  removeObject(obj) {
    if ( this.mediaStreams ) {
      this.mediaStreams.removeClient(obj);
    }
    VRSPACEUI.assetLoader.unloadObject(obj);
    if ( obj.attachedScript ) {
      obj.attachedScript.dispose();
    }
    if ( obj.avatar ) {
      obj.avatar.dispose();
      obj.avatar = null;
    }
    if ( obj.translate ) {
      obj.translate.dispose();
      obj.translate = null;
    }
    if ( obj.rotate ) {
      obj.rotate.dispose();
      obj.rotate = null;
    }
    if ( obj.rescale ) {
      obj.rescale.dispose();
      obj.rescale = null;
    }
    if ( obj.streamToMesh ) {
      obj.streamToMesh.dispose();
      obj.streamToMesh = null;
    }
    // TODO also remove object (avatar) from internal arrays
  }

  /** Local user wrote something - send it over and notify local listener(s) */
  write( text ) {
    this.publishChanges( [{field:'wrote',value:text}] );
  }
  
  /**
  Periodically executed, as specified by fps. 
  Tracks changes to camera and XR controllers. 
  Calls checkChange, and if anything has changed, changes are sent to server,
  and to myChangeListeners. 
   */
  trackChanges() {
    var changes = [];
    if ( this.trackedMesh ) {
      // tracking mesh (3rd person view)
      var pos = this.trackedMesh.position;
      // CHECKME/FIXME: meshes seem to have ellipsoids by default
      /*
      if ( this.trackedMesh.ellipsoid ) {
        var height = this.trackedMesh.position.y - this.trackedMesh.ellipsoid.y;
        pos = new BABYLON.Vector3(this.trackedMesh.position.x, height, this.trackedMesh.position.z);
      }
      */
      this.checkChange("position", this.pos, pos, changes);
      this.checkChange("rotation", this.rot, this.trackedMesh.rotation, changes);
    } else {
      // tracking camera (1st person view)
      if ( ! this.camera ) {
        return;
      }
      
      try {
        var vrHelper = this.world.xrHelper;
  
        // track camera movements, find out where feet are
        if ( vrHelper && this.camera.getClassName() == 'WebXRCamera' ) {
          // ellipsoid needs to be ignored, we have to use real world height instead
          var height = this.camera.globalPosition.y - vrHelper.realWorldHeight();
          this.checkChange("position", this.pos, new BABYLON.Vector3(this.camera.globalPosition.x, height, this.camera.globalPosition.z), changes);
        } else if ( this.camera.ellipsoid ) {
          var height = this.camera.globalPosition.y - this.camera.ellipsoid.y*2;
          if ( this.camera.ellipsoidOffset ) {
            height += this.camera.ellipsoidOffset.y;
          }
          this.checkChange("position", this.pos, new BABYLON.Vector3(this.camera.globalPosition.x, height, this.camera.globalPosition.z), changes);
        } else {
          this.checkChange("position", this.pos, this.camera.globalPosition, changes);
        }
        if ( this.trackRotation ) {
          var cameraRotation = this.camera.rotation;
          if ( this.camera.getClassName() == 'WebXRCamera' ) {
            // CHECKME do other cameras require this?
            cameraRotation = this.camera.rotationQuaternion.toEulerAngles();
          }
          this.checkChange("rotation", this.rot, cameraRotation, changes);
        }
        
        // and now track controllers
        if ( vrHelper ) {
          if ( vrHelper.controller.left) {
            this.checkChange( 'leftArmPos', this.leftArmPos, vrHelper.leftArmPos(), changes );
            this.checkChange( 'leftArmRot', this.leftArmRot, vrHelper.leftArmRot(), changes );
          }
          if ( vrHelper.controller.right ) {
            this.checkChange( 'rightArmPos', this.rightArmPos, vrHelper.rightArmPos(), changes );
            this.checkChange( 'rightArmRot', this.rightArmRot, vrHelper.rightArmRot(), changes );
          }
          // track and transmit userHeight in VR
          if ( this.isChanged( this.userHeight, vrHelper.realWorldHeight(), this.resolution)) {
            this.userHeight = vrHelper.realWorldHeight();
            changes.push({field: 'userHeight', value: this.userHeight});
          }
        }
      } catch ( err ) {
        console.error(err);
      }
    
    }
    this.publishChanges(changes);

  }
  
  /**
   *  Publish changes to the server (if online) and local change listeners 
   *  @param changes array of objects with field-value pairs
   */
  publishChanges(changes) {
    if ( changes.length > 0 ) {
      // CHEKME: do we want this strict or safe?
      if ( this.isOnline() ) {
        VRSPACE.sendMyChanges(changes);
      }
      // TODO: try/catch
      this.myChangeListeners.forEach( (listener) => listener(changes));
    }
  }
  
  /**
  Check if a value has changed, and update change array if so.
   */
  checkChange( field, obj, pos, changes ) {
    if ( this.isChanged(obj.x, pos.x, this.resolution) || 
        this.isChanged(obj.y, pos.y, this.resolution) || 
        this.isChanged(obj.z, pos.z, this.resolution) ) {
      this.log( Date.now()+": "+field + " changed, sending "+pos);
      obj.x = pos.x;
      obj.y = pos.y;
      obj.z = pos.z;
      changes.push({ field: field, value: pos});
    }
  }
  /**
  Return true if a value is ouside of given range.
   */
  isChanged( old, val, range ) {
    return val < old - range || val > old + range;
  }
  
  /**
  Enter the world specified by world.name. If not already connected, 
  first connect to world.serverUrl and set own properties, then start the session.
  World and WorldListeners are notified by calling entered methods. 
  @param properties own properties to set before starting the session
  @return Welcome promise
   */
  async enter( properties ) {
    VRSPACE.addErrorListener((e)=>{
      console.log("Server error:"+e);
      this.error = e;
    });
    return new Promise( (resolve, reject) => {
      var afterEnter = (welcome) => {
        VRSPACE.removeWelcomeListener(afterEnter);
        this.entered(welcome);
        // CHECKME formalize this as WorldListener interface?
        this.world.worldListeners.forEach(listener => {
          try {
            if ( listener.entered ) {
              listener.entered(welcome);
            }
          } catch ( error ) {
            console.log("Error in world listener", error);
          }
        });
        resolve(welcome);
      };
      var afterConnect = (welcome) => {
        VRSPACE.removeWelcomeListener(afterConnect);
        if ( this.remoteLogging ) {
          this.enableRemoteLogging();
        }
        if ( this.tokens ) {
          for ( let token in this.tokens ) {
            VRSPACE.setToken(token, this.tokens[token]);
          } 
        }
        if ( properties ) {
          for ( var prop in properties ) {
            // publish own properties
            VRSPACE.sendMy(prop, properties[prop]);
            // and also set their values locally
            VRSPACE.me[prop] = properties[prop];
          }
        }
        // FIXME for the time being, Enter first, then Session
        if ( this.world.name ) {
          VRSPACE.addWelcomeListener(afterEnter);
          VRSPACE.sendCommand("Enter",{world:this.world.name});
          VRSPACE.sendCommand("Session");
        } else {
          VRSPACE.sendCommand("Session");
          this.entered(welcome)
          resolve(welcome);
        }
      };
      if ( ! this.isOnline() ) {
        VRSPACE.addWelcomeListener(afterConnect);
        VRSPACE.connect(this.world.serverUrl);
        VRSPACE.addConnectionListener((connected)=>{
          this.log('connected:'+connected);
          if ( ! connected ) {
            reject(this);
          }
        });
      } else if ( this.world.name ){
        VRSPACE.addWelcomeListener(afterEnter);
        VRSPACE.sendCommand("Enter",{world:this.world.name});
      }
    });
  }
  
  /** Called after user enters a world, calls world.entered() wrapped in try/catch */
  entered(welcome) {
    try {
      this.world.entered(welcome);
    } catch ( err ) {
      console.log("Error in world entered", err);
    }
  }
  /** 
  Send own event.
  @param obj object containing changes to be sent, i.e. name-value pair(s).
   */
  sendMy( obj ) {
    VRSPACE.sendMyEvent(obj);
  }
  
  /** Returns VRSPACE.me if available, null otherwise */
  static myId() {
    if ( VRSPACE.me ) {
      return VRSPACE.me.id;
    }
    return null;
  }
  
  enableRemoteLogging() {
    let oldConsole = window.console;
    let console=
    { 
      log: (...args) => {
        this.concatAndSend(oldConsole.log, "debug", args);
      },
      debug: (...args) => {
        this.concatAndSend(oldConsole.debug, "debug", args);
      },
      info: (...args) => {
        this.concatAndSend(oldConsole.info, "info", args);
      },
      warn: (...args) => {
        this.concatAndSend(oldConsole.warn, "warn", args);
      },
      error: (...args) => {
        this.concatAndSend(oldConsole.error, "error", args);
      }
    };
    
    window.console = console;
    /*
    console.log('log test');
    console.info('info test');
    console.warn('warn test');
    console.error('error test');
    */
  }
  concatAndSend(output, severity, ...args) {
    let str = this.concat(args)
    if ( str ) {
      output(str);
      VRSPACE.sendCommand("Log", {message:str, severity:severity});
    }
  }
  // based on
  // https://codedamn.com/news/javascript/how-to-fix-typeerror-converting-circular-structure-to-json-in-js
  // thanks!
  stringify(obj) {
    let cache = [];
    let str = JSON.stringify(obj, (key, value) => {
      if (typeof value === "object" && value !== null) {
        if (cache.indexOf(value) !== -1) {
          // Circular reference found, discard key
          return;
        } else if ( cache.length > 2 ) {
          // everything below top-level object
          return "[obj]";
        }
        // Store value in our collection
        cache.push(value);
      }
      return value;
    });
    cache = null; // reset the cache
    return str;
  }
  
  concat(...args) {
    let ret = "";
      args.forEach(e=>{
        if ( typeof(e) === 'object') {
          try {
            ret += this.stringify(e);
          } catch ( error ) {
            window.console.error(error);
            ret += error;
            //return "";
          }
        } else {
          ret += e;
        }
        ret += " ";
      });
      return ret;
      
  }
}

