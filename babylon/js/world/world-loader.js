import { World } from './world.js';
import { VRSPACEUI } from '../ui/vrspace-ui.js';
import { Portal } from '../ui/world/portal.js';
import { ServerFolder } from '../core/server-folder.js';
import { LogoRoom } from '../ui/world/logo-room.js';
import { HumanoidAvatar } from '../avatar/humanoid-avatar.js';
import { VideoAvatar } from '../avatar/video-avatar.js';
import { MeshAvatar } from '../avatar/mesh-avatar.js';

export class WorldLoader {
  static loadComponent(component, scene) {
    try {
      if (component) {
        BABYLON.SceneLoader.Append("", 'data:' + JSON.stringify(component), scene);
      }
    } catch (ex) {
      console.error("Error loading component ", component);
    }
  }

  static async loadMesh(url, instance, scene) {
    var vrObject = {
      mesh: url,
      name: instance.name,
      position: instance.position,
      rotation: instance.rotation
    };
    let avatar = new MeshAvatar(scene, vrObject);
    VRSPACEUI.assetLoader.loadObject(vrObject, mesh => {
      mesh.position = new BABYLON.Vector3(instance.position.x, instance.position.y, instance.position.z);
      mesh.rotation = new BABYLON.Vector3(instance.rotation.x, instance.rotation.y, instance.rotation.z);
      avatar.setName(instance.name);
    });
  }
  
  static async loadAvatar(url, instance, scene) {
    let avatar = await HumanoidAvatar.createFromUrl(scene, url);
    avatar.userHeight = instance.userHeight;
    avatar.turnAround = instance.turnAround
    // load
    avatar.load(()=>{
      avatar.baseMesh().position = new BABYLON.Vector3(instance.position.x, instance.position.y, instance.position.z);
      avatar.baseMesh().rotationQuaternion = new BABYLON.Quaternion(instance.rotationQuaternion.x, instance.rotationQuaternion.y, instance.rotationQuaternion.z, instance.rotationQuaternion.w);
      if (instance.scale) {
        avatar.rootMesh.scaling = new BABYLON.Vector3(instance.scale.x, instance.scale.y, instance.scale.z);
      }
      avatar.setName(instance.name);
      // TODO play animation
    });
  }

  static loadAsset(url, instance) {
    var vrObject = {
      mesh: url,
      position: instance.position,
      rotation: instance.rotation,
      scale: instance.scale
    };
    VRSPACEUI.assetLoader.loadObject(vrObject, mesh => {
      mesh.position = new BABYLON.Vector3(instance.position.x, instance.position.y, instance.position.z);
      mesh.rotation = new BABYLON.Vector3(instance.rotation.x, instance.rotation.y, instance.rotation.z);
      if (instance.scale) {
        mesh.scaling = new BABYLON.Vector3(instance.scale.x, instance.scale.y, instance.scale.z);
      }
    });
  }

  static loadAssets(assets, loadFunc) {
    for (let url in assets) {
      let instances = assets[url].instances;
      if (!url.startsWith("/")) {
        // relative url, make it relative to world script path
        url = this.baseUrl + url;
      }
      instances.forEach(instance => loadFunc(url, instance));
    }
  }

  static async loadFile(engine, file = "scene.json") {
    let world = new World();
    world.engine = engine;
    world.scene = new BABYLON.Scene(engine);
    fetch(file).then(response => {
      response.json().then(worldInfo => {
        console.log(worldInfo);
        world.name = worldInfo.name;
        world.baseUrl = worldInfo.baseUrl;
        world.file = worldInfo.file;
        world.worldObjects = worldInfo.worldObjects;
        world.objectsFile = worldInfo.objectsFile;
        world.gravityEnabled = worldInfo.gravityEnabled;

        this.loadComponent(worldInfo.skyBox, world.scene);
        this.loadComponent(worldInfo.ground, world.scene);
        this.loadComponent(worldInfo.camera1p, world.scene);
        this.loadComponent(worldInfo.camera3p, world.scene);
        worldInfo.lights.forEach(light => {
          this.loadComponent(light, world.scene);
        });
        worldInfo.sceneMeshes.forEach(mesh => {
          this.loadComponent(mesh, world.scene);
        });
        world.registerRenderLoop();

        VRSPACEUI.init(world.scene).then(() => {
          world.scene.activeCamera.attachControl();
          world.camera = world.scene.activeCamera;

          if (worldInfo.room) {
            new LogoRoom(world.scene).load();
          }

          if (worldInfo.terrain) {
            this.loadComponent(worldInfo.terrain.mesh, world.scene);
            this.loadComponent(worldInfo.terrain.sps, world.scene);
          }

          for (let portalName in worldInfo.portals) {
            let portalInfo = worldInfo.portals[portalName];
            console.log('Portal ' + portalName, portalInfo);
            let serverFolder = new ServerFolder(portalInfo.serverFolder.baseUrl, portalInfo.serverFolder.name, portalInfo.serverFolder.related);
            let portal = new Portal(world.scene, serverFolder);
            portal.loadAt(portalInfo.x, portalInfo.y, portalInfo.z, portalInfo.angle).then(p => p.enabled(portalInfo.enabled));
          }
          this.loadAssets(worldInfo.assets, (url,asset) => this.loadAsset(url, asset));
          this.loadAssets(worldInfo.avatars, (url,avatar) => this.loadAvatar(url, avatar, world.scene));
          this.loadAssets(worldInfo.meshAvatars, (url,asset) => this.loadMesh(url, asset, world.scene));
          worldInfo.videoAvatars.forEach( videoAvatar => {
            let video = new VideoAvatar(world.scene);
            video.autoStart = videoAvatar.autoStart;
            video.autoAttach = videoAvatar.autoAttach;
            video.altText = videoAvatar.altText;
            video.altImage = videoAvatar.altImage;
            video.show();
            video.mesh.parent = new BABYLON.TransformNode("Root of "+video.mesh.id, world.scene);
            video.mesh.parent.position = new BABYLON.Vector3(videoAvatar.position.x,videoAvatar.position.y,videoAvatar.position.z);
          });
          
          worldInfo.scriptedObjects.forEach(o=>this.loadComponent(o, world.scene));
        });


      });
    });
    return world.scene;
  }

}