import { VRObject } from '../client/vrspace.js';
import { HumanoidAvatar } from '../avatar/humanoid-avatar.js';
import { MeshAvatar } from '../avatar/mesh-avatar.js';
import { VideoAvatar } from '../avatar/video-avatar.js';
import { BotController } from '../avatar/bot-controller.js';
import { MeshLoader } from './mesh-loader.js';
import { MediaStreams } from './media-streams.js';

export class AvatarLoader extends MeshLoader {
  constructor(scene, fps, loadCallback, loadErrorHandler){
    super(loadCallback,loadErrorHandler);
    this.scene = scene;
    this.fps = fps;
    /** Create animations for movement of avatars, default true. Recommended for low fps.*/
    this.createAnimations = true;
    /** Custom avatar options, applied to avatars after loading. Currently video avatars only */
    this.customOptions = null;
    /** Custom avatar animations */
    this.customAnimations = null;
    /** Avatar factory, default this.createAvatar */
    this.avatarFactory = this.createAvatar;
    /** Default position applied after an avatar loads */
    this.defaultPosition = new BABYLON.Vector3(1000, 1000, 1000);
    /** Default rotation applied after an avatar loads */
    this.defaultRotation = new BABYLON.Vector3(0, 0, 0);
  }
  
  /** @param {VRObject} obj  */
  load(obj) {
    // CHECKME: order matters, but consequence of this order is that humanoid avatar can't have video
    if (obj.video) {
      this.loadStream(obj);
    } else if (obj.humanoid) {
      this.loadAvatar(obj);
    } else {
      this.loadMeshAvatar(obj);
    }
  }
  
  /**
  Load a video avatar, attach a listener to it.
  @param {Client} obj 
   */
  loadStream(obj) {
    this.log("loading stream for " + obj.id);

    var video = this.avatarFactory(obj);
    video.mesh.name = obj.mesh;
    // obfuscators get in the way 
    //video.mesh.id = obj.constructor.name+" "+obj.id;
    video.mesh.id = obj.className + " " + obj.id;
    obj.avatar = video;

    var parent = new BABYLON.TransformNode("Root of " + video.mesh.id, this.scene);
    video.mesh.parent = parent;
    parent.VRObject = obj;
    parent.avatar = video; // CHECKME

    this.log("Added stream " + obj.id);

    if (obj.position.x == 0 && obj.position.y == 0 && obj.position.z == 0) {
      // avatar position has not yet been initialized, use default
      parent.position = new BABYLON.Vector3(this.defaultPosition.x, this.defaultPosition.y, this.defaultPosition.z);
      obj.position = this.defaultPosition;
      var initialPosition = { position: {} };
      this.changeObject(obj, initialPosition, parent);
    } else {
      // apply known position
      parent.position = new BABYLON.Vector3(obj.position.x, obj.position.y, obj.position.z)
    }

    if (obj.rotation) {
      if (obj.rotation.x == 0 && obj.rotation.y == 0 && obj.rotation.z == 0) {
        // avatar rotation has not yet been initialized, use default
        parent.rotation = new BABYLON.Vector3(this.defaultRotation.x, this.defaultRotation.y, this.defaultRotation.z);
        obj.rotation = this.defaultRotation;
        var initialRotation = { rotation: {} };
        this.changeObject(obj, initialRotation, parent);
      } else {
        // apply known rotation
        parent.rotation = new BABYLON.Vector3(obj.rotation.x, obj.rotation.y, obj.rotation.z)
      }
    }

    obj.addListener((obj, changes) => this.changeObject(obj, changes, parent));
    if (this.mediaStreams) {
      this.mediaStreams.streamToMesh(obj, video.mesh);
    } else {
      console.log("WARNING: unable to stream to " + obj.id + " - no MediaStreams")
    }
    this.notifyLoadListeners(obj, video);
  }

  /** 
   * Load a 3D avatar, attach a listener to it
   * @param {VRObject} obj VRObject that represents the user 
   */
  async loadAvatar(obj) {
    this.log("loading avatar " + obj.mesh);
    let avatar = await this.createAvatarFromUrl(obj.mesh);
    avatar.userHeight = obj.userHeight;
    avatar.load((avatar) => {
      obj.avatar = avatar;
      obj.instantiatedEntries = avatar.instantiatedEntries;
      avatar.VRObject = obj;
      avatar.parentMesh.VRObject = obj;
      // apply current name, position and rotation
      this.changeAvatar(obj, { name: obj.name, position: obj.position });
      if (obj.rotation) {
        // FIXME rotation can be null sometimes (offline users?)
        this.changeAvatar(obj, { rotation: obj.rotation });
      }
      // TODO also apply other non-null properties here
      if (obj.animation) {
        this.changeAvatar(obj, { animation: obj.animation });
      }
      // add listener to process changes
      obj.addListener((obj, changes) => this.changeAvatar(obj, changes));
      // subscribe to media stream here if available
      if (this.mediaStreams) {
        this.mediaStreams.streamToMesh(obj, obj.avatar.baseMesh());
      }
      if (obj.className.indexOf("Bot") >= 0) {
        console.log("Bot loaded");
        // TODO bot controller
        obj.avatarController = new BotController(avatar);
      }
      this.notifyLoadListeners(obj, avatar);
    }, (error) => {
      // FIXME - this fallback is not safe when loading multiple instances at once
      console.log("Failed to load humanoid avatar, loading as mesh", error);
      obj.humanoid = false;
      this.loadMeshAvatar(obj);
    });
  }

  /** 
   * Any 3d object can be an avatar 
   * @param {VRObject} obj VRObject that represents the user 
   */
  loadMeshAvatar(obj) {
    let avatar = new MeshAvatar(this.scene, obj);
    obj.avatar = avatar;
    this.loadMesh(obj, mesh => {
      avatar.mesh = mesh;
      mesh.avatar = avatar;
      var bbox = avatar.baseMesh().getHierarchyBoundingVectors();
      this.log("Bounding box:");
      this.log(bbox);
      avatar.userHeight = bbox.max.y - bbox.min.y;
      avatar.setName(obj.name);
    });
  }
 
  /** Apply remote changes to an avatar (VRObject listener) */
  changeAvatar(obj, changes) {
    this.log('Processing changes on avatar');
    this.log(changes);
    var avatar = obj.avatar;
    for (var field in changes) {
      var node = avatar.baseMesh();
      this.routeEvent(obj, field, node);
      this.notifyListeners(obj, field, node);
    }
  }
 
  routeEvent(obj, field, node) {
    if (obj.avatar) {
      let object = obj.avatar;
      if (typeof object[field] === 'function') {
        // execute a change on avatars - e.g. wrote
        object[field](obj, node);
      } else if (typeof object[field + 'Changed'] === 'function') {
        // execute callback after changes are applied
        object[field + 'Changed'](obj, node);
      } else {
        console.log("Ignoring unknown event to "+obj+": "+field);
      }
    } else {
      console.log("Ignoring unknown event "+field+" to object "+obj.id);
    }
  }

  
  /**
   * Creates new Avatar instance from the URL
   * @param url URL to load avatar from 
   */
  async createAvatarFromUrl(url) {
    let avatar = await HumanoidAvatar.createFromUrl(this.scene, url);
    avatar.animations = this.customAnimations;
    avatar.fps = this.fps;
    avatar.generateAnimations = this.createAnimations;
    // GLTF characters are facing the user when loaded, turn it around
    // this doesn't do anything for cloned characters, affects only first one that loads
    avatar.turnAround = true;

    //avatar.debug = false; // or this.debug?
    return avatar;
  }

  /** 
   * Default video avatar factory method
   * @param {Client} obj 
   */
  createAvatar(obj) {
    let avatar = new VideoAvatar(this.scene, null, this.customOptions);
    avatar.autoStart = false;
    avatar.autoAttach = false;
    if (obj.picture) {
      avatar.altImage = obj.picture;
    }
    avatar.show();
    if (obj.name) {
      avatar.setName(obj.name);
    } else {
      avatar.setName("u" + obj.id);
    }
    return avatar;
  }

}