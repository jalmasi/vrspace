import { Client, VRSPACE, Welcome, VRObject } from '../client/vrspace.js';
import { VRSPACEUI } from '../ui/vrspace-ui.js';
import { Avatar } from '../avatar/avatar.js';
import { World } from '../world/world.js'
import { CameraHelper } from './camera-helper.js';
import { MediaStreams } from './media-streams.js';
import { AvatarLoader } from './avatar-loader.js';
import { MeshLoader } from './mesh-loader.js';
import { SceneEvent } from '../client/vrspace.js';
import { EventRouter } from './event-router.js';
import { MediaHelper } from './media-helper.js';

/**
Manages world events: tracks local user events and sends them to the server, 
and tracks network events and applies them to local scene.
Loads avatars of other users and maps network events to their avatars, 
including user video and audio streams.
 */
export class WorldManager extends EventRouter {
  /** Current WorldManager instance @type {WorldManager} */
  static instance = null;
  /** Creates world manager with default values and connection, scene, camera listeners.
  @param world
  @param fps network framerate, default 5 (send up to 5 events per second)
   */
  constructor(world, fps=5) {
    super();
    if (WorldManager.instance) {
      throw "WorldManager already created";
    }
    /** the world @type {World} */
    this.world = world;
    /** client tokens */
    this.tokens = null;
    /** the scene */
    this.scene = world.scene;
    /** Movement resolution, default 1 cm/3.6 deg. Any movement less than this will be ignored.*/
    this.resolution = 0.01; // 1 cm/3.6 deg
    /** Whether to track user rotation, default true. */
    this.trackRotation = true;
    /** In 3rd person view, we're not tracking and publishing position and orientation camera, but of this mesh*/
    this.trackedMesh = null;
    /** This is set once we connect to streaming server @type {MediaStreams}*/
    this.mediaStreams = null;
    /** Listeners notified after own avatar property (e.g. position) has changed and published */
    this.myChangeListeners = []
    /** Network frames per second, default 5 */
    this.fps = fps;
    /** Avatar loader */
    this.avatarLoader = new AvatarLoader(this.scene, this.fps, (obj, mesh) => this.notifyLoadListeners(obj, mesh), (obj, exception) => this.alertLoadListeners(obj, exception));
    /** Mesh loader */
    this.meshLoader = new MeshLoader((obj, avatar) => this.notifyLoadListeners(obj, avatar), (obj, exception) => this.alertLoadListeners(obj, exception));
    /** Mobile browsers don't have javascript console, and USB debugging is next to useless.
     * Enable to redirect all console output to the server log. Sure, it starts only after connection to the server is established.
     */
    this.remoteLogging = false;
    if (!this.scene.activeCamera) {
      console.log("Undefined camera in WorldManager, tracking disabled")
    } else {
      this.trackCamera();
    }
    CameraHelper.getInstance(this.scene).addCameraListener(() => this.trackCamera());
    this.VRSPACE = VRSPACE;
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
    this.interval = null;
    VRSPACE.addWelcomeListener((welcome) => this.setSessionStatus(true));
    VRSPACE.addSceneListener((e) => this.sceneChanged(e));
    /** Enable debug output */
    this.debug = false;
    this.world.worldManager = this;
    VRSPACEUI.init(this.scene); // to ensure assetLoader is available
    WorldManager.instance = this;
    this.addVRObjectRoutingMethods(this.fps);
  }
  /** 
   * Publish and subscribe
   * @param {Client} user Client object of the local user
   * @param {boolean} autoPublishVideo should webcam video be published as soon as possible
   */
  async pubSub(user, autoPublishVideo) {
    console.log("PubSub autoPublishVideo:"+autoPublishVideo, user);
    // CHECKME: should it be OpenVidu or general streaming service name?
    if (this.mediaStreams && user.tokens && user.tokens.OpenViduMain) {
      this.log("Subscribing as User " + user.id + " with token " + user.tokens.OpenViduMain);
      // ask for webcam access permissions
      const deviceId = await MediaHelper.selectDevice();
      if ( deviceId ) {
        this.mediaStreams.videoSource = deviceId;
      }
      if (autoPublishVideo) {
        this.mediaStreams.startVideo = true;
      }
      try {
        await this.mediaStreams.connect(user.tokens.OpenViduMain)
        this.avatarLoader.mediaStreams = this.mediaStreams;
        this.meshLoader.mediaStreams = this.mediaStreams;
        // we may need to pause/unpause audio publishing during speech input
        // TODO figure out how to use instance
        VRSPACEUI.hud.speechInput.constructor.mediaStreams = this.mediaStreams;
        this.mediaStreams.publish();        
      } catch ( exception ) {
        console.error("Streaming connection failure", exception);
      }
    }
  }

  /** Track a mesh, used in 3rd person view */
  trackMesh(mesh) {
    if (mesh) {
      this.log("Tracking mesh " + mesh.id);
    } else if (this.trackedMesh) {
      this.log("Stopped tracking mesh " + this.trackedMesh.id);
    }
    this.trackedMesh = mesh;
  }

  /** Tracks active camera */
  trackCamera(camera) {
    if (!camera) {
      camera = this.scene.activeCamera;
    }
    if (camera && this.camera != camera) {
      this.log("Tracking camera " + camera.getClassName())
      this.camera = camera;
    }
  }

  /** Called when connection to the server is established (connection listener)*/
  setSessionStatus(active) {
    this.log("Session status: " + active);
    if (active) {
      if (!this.interval) {
        this.interval = setInterval(() => this.trackChanges(), 1000 / this.fps);
      }
    } else if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /** Returns true if connected to the server and session is active*/
  isOnline() {
    return this.interval != null;
  }

  /** Called when scene has changed (scene listener). 
  If an object was added, calls addObject.
  If an object was removed, calls removeObject.
  Any WorldListeners on the world are notified after changes are performed, by calling added and removed methods.
  @param {SceneEvent} e SceneEvent containing the change
  */
  sceneChanged(e) {
    if (e.added != null) {
      this.log("ADDED " + e.objectId + " new size " + e.scene.size);
      this.log(e);
      this.addObject(e.added);
      this.world.worldListeners.forEach(listener => {
        try {
          if (listener.added) {
            listener.added(e.added);
          }
        } catch (error) {
          console.log("Error in world listener", error);
        }
      });
    } else if (e.removed != null) {
      this.log("REMOVED " + e.objectId + " new size " + e.scene.size)
      this.removeObject(e.removed);
      try {
        this.world.worldListeners.forEach(listener => {
          try {
            if (listener.removed) {
              listener.removed(e.removed);
            }
          } catch (error) {
            console.log("Error in world listener", error);
          }
        });
      } catch (error) {
        console.log("Error in scene listener", error);
      }
    } else {
      this.log("ERROR: invalid scene event");
    }
  }

  /**
   * Quick enter, with avatar url and optionally user name.
   * @param {string} avatarUrl URL to load avatar from
   * @param {string} userName login name of the user
   * @returns {Avatar} own Avatar instance
   */
  async enterWith(avatarUrl, userName) {
    let avatar = await this.avatarLoader.createAvatarFromUrl(avatarUrl);
    avatar.name = userName;
    await this.enterAs(avatar);
    return avatar;
  }

  /**
   * Enter the world as avatar.
   * Creates propererties by taking user name, height and avatar url from given Avatar,
   * then calls enter( properties ).
   * @param {Avatar} avatar User's avatar
   * @return {Promise<Welcome>} promise resolved after enter
   */
  async enterAs(avatar) {
    let myProperties = {
      mesh: avatar.getUrl(),
      userHeight: this.userHeight,
      video: avatar.video,
      humanoid: avatar.humanoid
    };
    if (avatar.name) {
      myProperties.name = avatar.name;
    }
    return this.enter(myProperties);
  }

  /**
   * Internal used to notify load listeners: loadCallback, object load listeners, world load listeners
   * @private
   * @param {VRObject} obj
   * @param mesh Root mesh of the loaded object
   */
  notifyLoadListeners(obj, mesh) {
    obj.notifyLoadListeners(); // CHECKME SoC
    this.world.worldListeners.forEach(listener => {
      try {
        if (listener.loaded) {
          listener.loaded(obj, mesh);
        }
      } catch (error) {
        console.log("Error in world listener", error);
      }
    });
  }
  
  /**
   * Internal used to notify load listeners that loading has failed.
   * @private
   * @param {VRObject} obj
   * @param exception
   */
  alertLoadListeners(obj, exception) {
    this.world.worldListeners.forEach(listener => {
      try {
        if (listener.loadError) {
          listener.loadError(obj, exception);
        }
      } catch (error) {
        console.log("Error in world listener", error);
      }
    });
  }

  /** Add a listener to own events */
  addMyChangeListener(listener) {
    VRSPACE.addListener(this.myChangeListeners, listener);
  }

  /** Remove listener to own events */
  removeMyChangeListener(listener) {
    VRSPACE.removeListener(this.myChangeListeners, listener);
  }

  /**
   * Load a script, call it's constructor with the VRObject, then calls init(), and adds the listener.
   * See basic-script.js and web-portal.js.
   */
  loadScript(obj) {
    import(obj.script).then(async module => {
      console.log(module);
      let className = Object.keys(module)[0];
      console.log("TODO: loading script " + className);
      let cls = module[className];
      var instance = new cls(this.world, obj);
      console.log("instance", instance);

      this.notifyLoadListeners(obj, instance);

      var node = await instance.init();
      if (node) {
        node.VRObject = obj;
        if (obj.active) {
          obj.addListener((obj, changes) => this.changeObject(obj, changes, node));
        }
      }
    });
  }
  /**
  Utility method, calculates bounding box for an AssetContainer.
  @returns Vector3 bounding box
   */
  boundingBox(container) {
    var maxSize = new BABYLON.Vector3(0, 0, 0);
    for (var i = 0; i < container.meshes.length; i++) {
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
      maxSize.x = Math.max(maxSize.x, size.x);
      maxSize.y = Math.max(maxSize.y, size.y);
      maxSize.z = Math.max(maxSize.z, size.z);
      //if (shadows) {
      //shadowGenerator.getShadowMap().renderList.push(container.meshes[i]);
      //}
    }
    console.log("BBoxMax: " + maxSize);
    return maxSize;
  }

  // works only for already displayed meshes
  bBox(mesh, maxSize) {
    if (!maxSize) {
      maxSize = new BABYLON.Vector3(0, 0, 0);
    }
    for (var i = 0; i < mesh.getChildren().length; i++) {
      maxSize = this.bBox(mesh.getChildren()[i], maxSize);
    }
    if (!mesh.refreshBoundingInfo) {
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
    maxSize.x = Math.max(maxSize.x, size.x);
    maxSize.y = Math.max(maxSize.y, size.y);
    maxSize.z = Math.max(maxSize.z, size.z);
    console.log("BBoxMax: " + maxSize);
    return maxSize;
  }

  /**
  Utility method, calculates bounding box for an AssetContainer and returns maximum of x,y,z.
  Works only for meshes already rendered
   */
  bBoxMax(mesh) {
    var bbox = this.bBox(mesh);
    console.log("BBox: " + bbox);
    return Math.max(bbox.x, Math.max(bbox.y, bbox.z));
  }

  /**
   * Add an object to the scene - calls the appropriate loader method.
   * @param {VRObject} obj 
   */
  addObject(obj) {
    if (typeof obj.hasAvatar != 'undefined' && obj.hasAvatar) {
      this.avatarLoader.load(obj);
    } else if (obj.mesh) {
      this.meshLoader.loadMesh(obj);
    } else if (obj.script) {
      this.loadScript(obj);
    } else {
      // TODO server needs to ensure that mesh exists
      // in the meantime we define default behavior here
      console.log("WARNING: can't load " + e.objectId + " - no mesh");
    }
  }
  
  /** 
   * Remove an object: remove the mesh from the scene (scene listener), and dispose of everything.
   * @param {VRObject} obj 
   */
  removeObject(obj) {
    if (this.mediaStreams) {
      // CHECKME should remove some time later?
      //this.mediaStreams.removeClient(obj.id);
    }
    if (obj.avatar) {
      obj.avatar.dispose(); // calls unloadObject
      obj.avatar = null;
    } else if (obj.attachedScript) {
      obj.attachedScript.dispose(); // SHOULD unload
    } else {
      VRSPACEUI.assetLoader.unloadObject(obj);
    }
    if (obj.translate) {
      obj.translate.dispose();
      obj.translate = null;
    }
    if (obj.rotate) {
      obj.rotate.dispose();
      obj.rotate = null;
    }
    if (obj.rescale) {
      obj.rescale.dispose();
      obj.rescale = null;
    }
    if (obj.streamToMesh) {
      obj.streamToMesh.dispose();
      obj.streamToMesh = null;
    }
    // CHECKME: introduce dispose method? 
    obj.listeners = [];
    obj.loadListeners = [];
    obj._isLoaded = false;
    // TODO also remove object (avatar) from internal arrays
  }

  /** Local user wrote something - send it over and notify local listener(s) */
  write(text) {
    this.publishChanges([{ field: 'wrote', value: text }]);
  }

  /**
  Periodically executed, as specified by fps. 
  Tracks changes to camera and XR controllers. 
  Calls checkChange, and if anything has changed, changes are sent to server,
  and to myChangeListeners. 
   */
  trackChanges() {
    var changes = [];
    if (this.trackedMesh) {
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
      if (!this.camera) {
        return;
      }

      try {
        var vrHelper = this.world.xrHelper;

        // track camera movements, find out where feet are
        if (vrHelper && this.camera.getClassName() == 'WebXRCamera') {
          // ellipsoid needs to be ignored, we have to use real world height instead
          var height = this.camera.globalPosition.y - vrHelper.realWorldHeight();
          this.checkChange("position", this.pos, new BABYLON.Vector3(this.camera.globalPosition.x, height, this.camera.globalPosition.z), changes);
        } else if (this.camera.ellipsoid) {
          var height = this.camera.globalPosition.y - this.camera.ellipsoid.y * 2;
          if (this.camera.ellipsoidOffset) {
            height += this.camera.ellipsoidOffset.y;
          }
          this.checkChange("position", this.pos, new BABYLON.Vector3(this.camera.globalPosition.x, height, this.camera.globalPosition.z), changes);
        } else {
          this.checkChange("position", this.pos, this.camera.globalPosition, changes);
        }
        if (this.trackRotation) {
          var cameraRotation = this.camera.rotation;
          if (this.camera.getClassName() == 'WebXRCamera') {
            // CHECKME do other cameras require this?
            cameraRotation = this.camera.rotationQuaternion.toEulerAngles();
          }
          this.checkChange("rotation", this.rot, cameraRotation, changes);
        }

        // and now track controllers
        if (vrHelper) {
          if (vrHelper.controller.left) {
            this.checkChange('leftArmPos', this.leftArmPos, vrHelper.leftArmPos(), changes);
            this.checkChange('leftArmRot', this.leftArmRot, vrHelper.leftArmRot(), changes);
          }
          if (vrHelper.controller.right) {
            this.checkChange('rightArmPos', this.rightArmPos, vrHelper.rightArmPos(), changes);
            this.checkChange('rightArmRot', this.rightArmRot, vrHelper.rightArmRot(), changes);
          }
          // track and transmit userHeight in VR
          if (this.isChanged(this.userHeight, vrHelper.realWorldHeight(), this.resolution)) {
            this.userHeight = vrHelper.realWorldHeight();
            changes.push({ field: 'userHeight', value: this.userHeight });
          }
        }
      } catch (err) {
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
    if (changes.length > 0) {
      // CHEKME: do we want this strict or safe?
      if (this.isOnline()) {
        VRSPACE.sendMyChanges(changes);
      }
      // TODO: try/catch
      this.myChangeListeners.forEach((listener) => {
        try {
          listener(changes);
        } catch (e) {
          console.error(e);
        }
      });
    }
  }

  /**
  Check if a value has changed, and update change array if so.
   */
  checkChange(field, obj, pos, changes) {
    if (this.isChanged(obj.x, pos.x, this.resolution) ||
      this.isChanged(obj.y, pos.y, this.resolution) ||
      this.isChanged(obj.z, pos.z, this.resolution)) {
      this.log(Date.now() + ": " + field + " changed, sending " + pos);
      obj.x = pos.x;
      obj.y = pos.y;
      obj.z = pos.z;
      changes.push({ field: field, value: pos });
    }
  }
  /**
  Return true if a value is ouside of given range.
   */
  isChanged(old, val, range) {
    return val < old - range || val > old + range;
  }

  /**
  Enter the world specified by world.name. If not already connected, 
  first connect to world.serverUrl and set own properties, then start the session.
  World and WorldListeners are notified by calling entered methods. 
  @param {Object} properties own properties to set before starting the session
  @return {Promise<Welcome>} promise resolved after enter
   */
  async enter(properties) {
    VRSPACE.addErrorListener((e) => {
      console.log("Server error:" + e);
      this.error = e;
    });
    return new Promise((resolve, reject) => {
      // TODO most of this code needs to go into VRSpace client.
      // TODO it should use async rather than callback functions
      var afterEnter = (welcome) => {
        VRSPACE.removeWelcomeListener(afterEnter);
        this.entered(welcome);
        // CHECKME formalize this as WorldListener interface?
        this.world.worldListeners.forEach(listener => {
          try {
            if (listener.entered) {
              listener.entered(welcome);
            }
          } catch (error) {
            console.log("Error in world listener", error);
          }
        });
        resolve(welcome);
      };
      var afterConnect = async (welcome) => {
        VRSPACE.removeWelcomeListener(afterConnect);
        if (this.remoteLogging) {
          this.enableRemoteLogging();
        }
        if (this.tokens) {
          for (let token in this.tokens) {
            VRSPACE.setToken(token, this.tokens[token]);
          }
        }
        if (properties) {
          for (var prop in properties) {
            // publish own properties
            VRSPACE.sendMy(prop, properties[prop]);
            // and also set their values locally
            VRSPACE.me[prop] = properties[prop];
          }
        }
        // start publishing video only for video avatar currently displaying video
        this.pubSub(welcome.client.User, VRSPACE.me.video);
        // FIXME for the time being, Enter first, then Session
        if (this.world.name) {
          VRSPACE.addWelcomeListener(welcome => {
            VRSPACE.callCommand("Session", () => afterEnter(welcome));
          });
          VRSPACE.sendCommand("Enter", { world: this.world.name });
        } else {
          VRSPACE.callCommand("Session", () => {
            this.entered(welcome)
            resolve(welcome);
          });
        }
      };
      if (!this.isOnline()) {
        VRSPACE.addWelcomeListener(afterConnect);
        VRSPACE.connect(this.world.serverUrl);
        VRSPACE.addConnectionListener((connected) => {
          this.log('connected:' + connected);
          if (!connected) {
            reject(this);
          }
        });
      } else if (this.world.name) {
        VRSPACE.addWelcomeListener(afterEnter);
        VRSPACE.sendCommand("Enter", { world: this.world.name });
      }
    });
  }

  /** Called after user enters a world, calls world.entered() wrapped in try/catch */
  entered(welcome) {
    try {
      this.world.entered(welcome);
    } catch (err) {
      console.log("Error in world entered", err);
    }
  }
  /** 
  Send own event.
  @param obj object containing changes to be sent, i.e. name-value pair(s).
   */
  sendMy(obj) {
    VRSPACE.sendMyEvent(obj);
  }

  /** Returns VRSPACE.me if available, null otherwise */
  static myId() {
    if (VRSPACE.me) {
      return VRSPACE.me.id;
    }
    return null;
  }

  enableRemoteLogging() {
    let oldConsole = window.console;
    let console =
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
    if (str) {
      output(str);
      VRSPACE.sendCommand("Log", { message: str, severity: severity });
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
        } else if (cache.length > 2) {
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
    args.forEach(e => {
      if (typeof (e) === 'object') {
        try {
          ret += this.stringify(e);
        } catch (error) {
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

