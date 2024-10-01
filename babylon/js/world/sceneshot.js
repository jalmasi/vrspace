import { World } from './world.js';
import { VRSPACEUI } from '../ui/vrspace-ui.js';
import { Portal } from '../ui/world/portal.js';
import { ServerFolder } from '../core/server-folder.js';
import { LogoRoom } from '../ui/world/logo-room.js';
import { HumanoidAvatar } from '../avatar/humanoid-avatar.js';
import { VideoAvatar } from '../avatar/video-avatar.js';
import { MeshAvatar } from '../avatar/mesh-avatar.js';

export class Sceneshot {
  /**
   * Save the world:
   * - all dynamically loaded assets
   * - skybox
   * - ground
   * - camera(s)
   * - light(s)
   * - terrain
   * - shadow generator
   * - physics
   * - portal(s)
   * - TODO: UI?
   */
  static async serializeWorld(world = World.lastInstance) {
    let worldInfo = {
      name: world.name,
      baseUrl: world.baseUrl,
      file: world.file,
      worldObjects: world.worldObjects,
      objectsFile: world.objectsFile,
      physics: {
        gravityEnabled: world.gravityEnabled,
        physicsPlugin: world.physicsPlugin?.name
      },
      portals: {},
      avatars: {
      },
      videoAvatars: [],
      meshAvatars: {},
      scriptedObjects: [],
      buttons: []
    };
    worldInfo.assets = VRSPACEUI.assetLoader.dump(true); // CHECKME include avatars or no?
    worldInfo.sceneMeshes = [];
    if (world.skyBox) {
      worldInfo.skyBox = BABYLON.SceneSerializer.SerializeMesh(world.skyBox);
    }
    if (world.room) {
      worldInfo.room = true;
    }
    if (world.ground) { // CHECKME: elseif?
      worldInfo.ground = BABYLON.SceneSerializer.SerializeMesh(world.ground);
    }
    if (world.camera1p) {
      worldInfo.camera1p = BABYLON.SceneSerializer.SerializeMesh(world.camera1p);
    }
    if (world.camera3p) {
      worldInfo.camera3p = BABYLON.SceneSerializer.SerializeMesh(world.camera3p);
    }
    worldInfo.lights = [];
    for ( let i = 0; i < world.scene.lights.length; i++ ) {
      let light = world.scene.lights[i];
      worldInfo.lights.push(BABYLON.SceneSerializer.SerializeMesh(light));
      if ( world.light === light ) {
        worldInfo.light == i;
      }
    }
    if (world.shadowGenerator) {
      worldInfo.shadowGenerator = {
        mapSize: world.shadowGenerator.mapSize,
        useExponentialShadowMap: world.shadowGenerator.useExponentialShadowMap,
        transparencyShadow: world.shadowGenerator.transparencyShadow
        // blur etc?
      }
      for ( let i = 0; i < world.scene.lights.length; i++ ) {
        let light = world.scene.lights[i];
        if ( world.shadowGenerator.getLight() === light ) {
          worldInfo.shadowGenerator.light = i;
          break;
        }
      }
    }
    if (world.sceneMeshes) {
      world.sceneMeshes.forEach(mesh => {
        if (!mesh.parent) {
          worldInfo.sceneMeshes.push(BABYLON.SceneSerializer.SerializeMesh(mesh, false, true));
        }
      });
    }
    for ( let node of world.scene.rootNodes ) {
      try {
        if (node.isEnabled()) {
          if (node.name.startsWith('Portal:')) {
            let portal = node.Portal;
            //let name = node.name.substring(node.name.indexOf(':')+1);
            let name = portal.name;
            worldInfo.portals[name] = {
              serverFolder: portal.serverFolder,
              x: node.position.x,
              y: node.position.y,
              z: node.position.z,
              angle: portal.angle,
              enabled: portal.isEnabled
            }
          } else if (node.name.startsWith('ButtonGroup:')) {
            worldInfo.buttons.push(BABYLON.SceneSerializer.SerializeMesh(node, false, true));
          } else if (typeof node.avatar != 'undefined') {
            let url = node.avatar.getUrl();
            console.log("Avatar: " + url);
            if (node.avatar.video) {
              let pos = node.avatar.basePosition();
              let obj = {
                name: node.avatar.name,
                autoStart: node.avatar.autoStart,
                autoAttach: node.avatar.autoAttach,
                position: { x: pos.x, y: pos.y, z: pos.z },
                displaying: node.avatar.displaying,
                altText: node.avatar.altText,
                altImage: node.avatar.altImage
              };
              worldInfo.videoAvatars.push(obj);
            } else if (node.avatar.humanoid) {
              if (!worldInfo.avatars[url]) {
                worldInfo.avatars[url] = {
                  info: VRSPACEUI.assetLoader.containers[url].info,
                  numberOfInstances: VRSPACEUI.assetLoader.containers[url].numberOfInstances,
                  animations: node.avatar.animations,
                  instances: []
                };
              }
              let pos = node.avatar.basePosition();
              let rot = node.avatar.baseMesh().rotationQuaternion;
              let scale = node.avatar.baseMesh().getChildren()[0].scaling;
              let obj = {
                name: node.avatar.name,
                position: { x: pos.x, y: pos.y, z: pos.z },
                rotationQuaternion: { x: rot.x, y: rot.y, z: rot.z, w: rot.w },
                scale: { x: scale.x, y: scale.y, z: scale.z },
                turnAround: node.avatar.turnAround,
                activeAnimation: node.avatar.activeAnimation,
                userHeight: node.avatar.userHeight
              };
              worldInfo.avatars[url].instances.push(obj);
            } else {
              // mesh avatar - TODO not tested
              if (!worldInfo.meshAvatars[url]) {
                worldInfo.meshAvatars[url] = {
                  info: VRSPACEUI.assetLoader.containers[url].info,
                  numberOfInstances: VRSPACEUI.assetLoader.containers[url].numberOfInstances,
                  instances: []
                };
              }
              let pos = node.avatar.basePosition();
              let rot = node.avatar.baseMesh.rotation;
              let obj = {
                name: node.avatar.name,
                position: { x: pos.x, y: pos.y, z: pos.z },
                rotation: { x: rot.x, y: rot.y, z: rot.z}
              };
              worldInfo.meshAvatars[url].instances.push(obj);
            }
          } else if (typeof node.VRObject != 'undefined' && typeof node.VRObject.script != 'undefined') {
            // scripts: 
            console.log("Saving script: ", node);
            worldInfo.scriptedObjects.push(BABYLON.SceneSerializer.SerializeMesh(node, false, true));
          }
        }
      } catch (exception) {
        console.log("Error serializing node", node, exception);
      }
      
    }
    
    if (world.terrain) {
      worldInfo.terrain = {
        mesh: BABYLON.SceneSerializer.SerializeMesh(world.terrain.mesh())
      }
      if (world.terrain.sps) {
        worldInfo.terrain.sps = BABYLON.SceneSerializer.SerializeMesh(world.terrain.sps.mesh);
      }
    }
    return worldInfo;
  }

  static async saveJson(world) {
    let worldInfo = await this.serializeWorld(world); 
    VRSPACEUI.saveFile(worldInfo.name + ".json", JSON.stringify(worldInfo));
  }

  static async saveHtml(world) {
    let worldInfo = await this.serializeWorld(world); 
    let json = JSON.stringify(worldInfo);
    let html = `
<html xmlns="http://www.w3.org/1999/xhtml">

    <head>
      <meta content="text/html;charset=utf-8" http-equiv="Content-Type">
      <meta content="utf-8" http-equiv="encoding">
    <title>VRSpace:Sceneshot</title>
    <style type="text/css">
    html, body {
      width: 100%;
      height:100%;
      margin: 0px;
      padding: 0px;
    }
    canvas {
      width: 100%;
      height:96%;
      padding-left: 0;
      padding-right: 0;
      margin-left: auto;
      margin-right: auto;
    }
    </style>
    <script src="https://cdn.babylonjs.com/v6.49.0/babylon.js"></script>
    <script src="https://cdn.babylonjs.com/v6.49.0/loaders/babylonjs.loaders.min.js"></script>
    <script src="https://cdn.babylonjs.com/v6.49.0/gui/babylon.gui.min.js"></script>
    <script src="https://cdn.babylonjs.com/v6.49.0/materialsLibrary/babylonjs.materials.min.js"></script>
    <script src="https://cdn.babylonjs.com/v6.49.0/proceduralTexturesLibrary/babylonjs.proceduralTextures.min.js"></script>
    </head>
  <body>

  <!-- canvas is not focusable by default, tabIndex does that -->
  <canvas id="renderCanvas" touch-action="none" tabIndex=0></canvas>
<script>

var canvas = document.getElementById("renderCanvas"); // Get the canvas element
// focus canvas so we get keyboard events, otherwise need to click on it first
canvas.focus();
var engine = new BABYLON.Engine(canvas, true); // Generate the BABYLON 3D engine
var scene;
`
    html += 'var json =`';
    html += json;
    html += '`';
    let scriptSrc = '/babylon/js/vrspace-min.js';
    if ( window.location.href.indexOf('localhost') >= 0 ) {
      console.warn('This document can not be loaded from filesystem, only from web server');
    } else {
      scriptSrc = window.location.origin + scriptSrc;
    }
    html += "\nimport('"+scriptSrc+"').then( (module) =>{";
    html += "\n  module.VRSPACEUI.contentBase='"+window.location.origin+"';";
    html += `
  module.Sceneshot.loadString(engine, json).then(world=>scene=world.scene);
});


function debugOnOff() {
  console.log("Debug: "+scene.debugLayer.isVisible());
  if ( scene.debugLayer.isVisible() ) {
    scene.debugLayer.hide();
  } else {
    scene.debugLayer.show();
  }
}

</script>
<div style="position:absolute;bottom:10px;right:50%;">
  <button onClick="debugOnOff()">Debug</button>
</div>

</body>
</html>
`    
    VRSPACEUI.saveFile(worldInfo.name + ".html", html);
  }

  static loadComponent(component, scene) {
    try {
      if (component) {
        // skybox is serialized with relative urls
        // CHECKME this is likely to be the case with all textures
        // CHECKME better way to find content path?
        let text = JSON.stringify(component);
        let replaced = text.replaceAll('"/content/', '"'+VRSPACEUI.contentBase+'/content/');
        BABYLON.SceneLoader.Append("", 'data:' + replaced, scene);
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
  
  static async loadAvatar(url, asset, instance, scene, shadowGenerator) {
    let avatar = await HumanoidAvatar.createFromUrl(scene, url, shadowGenerator);
    avatar.userHeight = instance.userHeight;
    avatar.turnAround = instance.turnAround
    avatar.animations = asset.animations;
    // load
    avatar.load(()=>{
      avatar.baseMesh().position = new BABYLON.Vector3(instance.position.x, instance.position.y, instance.position.z);
      avatar.baseMesh().rotationQuaternion = new BABYLON.Quaternion(instance.rotationQuaternion.x, instance.rotationQuaternion.y, instance.rotationQuaternion.z, instance.rotationQuaternion.w);
      if (instance.scale) {
        avatar.rootMesh.scaling = new BABYLON.Vector3(instance.scale.x, instance.scale.y, instance.scale.z);
      }
      avatar.setName(instance.name);
      if ( instance.activeAnimation ) {
        avatar.startAnimation(instance.activeAnimation, true);
      }
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
      let asset = assets[url];
      let instances = asset.instances;
      if (url.startsWith("/")) {
        // relative url, make it relative to world script path
        url = VRSPACEUI.contentBase + url;
      }
      instances.forEach(instance => loadFunc(url, asset, instance));
    }
  }

  static async loadFile(engine, file = "scene.json") {
    let response = await fetch(file);
    let worldInfo = await response.json();
    let world = await this.loadWorld(engine,worldInfo); 
    return world;
  }
  
  static async loadString(engine, text) {
    let worldInfo = JSON.parse(text);
    let world = await this.loadWorld(engine,worldInfo); 
    return world;
  }

  static async loadWorld(engine, worldInfo) {
    let world = new World();
    world.engine = engine;
    world.scene = new BABYLON.Scene(engine);
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
    for ( let i = 0; i < worldInfo.lights.length; i++ ) {
      this.loadComponent(worldInfo.lights[i], world.scene);
      if ( i == worldInfo.light ) {
        world.light = world.scene.lights[world.scene.lights.length-1];
      }
    }
    if ( worldInfo.shadowGenerator ) {
      world.shadowGenerator = new BABYLON.ShadowGenerator(worldInfo.shadowGenerator.mapSize, world.scene.lights[worldInfo.shadowGenerator.light]);
      world.shadowGenerator.useExponentialShadowMap = worldInfo.shadowGenerator.useExponentialShadowMap;
      world.shadowGenerator.transparencyShadow = worldInfo.shadowGenerator.useExponentialShadowMap;
    }
    worldInfo.sceneMeshes.forEach(mesh => {
      this.loadComponent(mesh, world.scene);
    });
    worldInfo.buttons.forEach(mesh => {
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
        // CHECKME: should we rather save this VRSPACEUI.contentBase with each portal url?
        let serverFolder = new ServerFolder(VRSPACEUI.contentBase+portalInfo.serverFolder.baseUrl, portalInfo.serverFolder.name, portalInfo.serverFolder.related);
        let portal = new Portal(world.scene, serverFolder);
        portal.loadAt(portalInfo.x, portalInfo.y, portalInfo.z, portalInfo.angle).then(p => p.enabled(portalInfo.enabled));
      }
      this.loadAssets(worldInfo.assets, (url,asset,instance) => this.loadAsset(url, instance));
      this.loadAssets(worldInfo.avatars, (url,avatar,instance) => this.loadAvatar(url, avatar, instance, world.scene, world.shadowGenerator));
      this.loadAssets(worldInfo.meshAvatars, (url,asset,instance) => this.loadMesh(url, instance, world.scene));
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
      world.initXR();
    });
    
    return world;
  }
}