import { World } from './world.js';
import { VRSPACEUI } from '../ui/vrspace-ui.js';
import { Portal } from '../ui/world/portal.js';
import { ServerFolder } from '../core/server-folder.js';
import { LogoRoom } from '../vrspace-min.js';

export class WorldLoader {
  static loadComponent(component, scene) {
    if (component) {
      BABYLON.SceneLoader.Append("", 'data:' + JSON.stringify(component), scene);
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

        // TODO: https://doc.babylonjs.com/typedoc/classes/BABYLON.SceneLoader#ImportMesh
        this.loadComponent(worldInfo.skyBox, world.scene);
        this.loadComponent(worldInfo.ground, world.scene);
        this.loadComponent(worldInfo.camera1p, world.scene);
        this.loadComponent(worldInfo.camera3p, world.scene);
        worldInfo.lights.forEach(light => {
          this.loadComponent(light, world.scene);
        });
        world.registerRenderLoop();
        
        VRSPACEUI.init(world.scene).then(()=>{
          world.scene.activeCamera.attachControl();
          world.camera = world.scene.activeCamera;
          world.load();
          

          if (worldInfo.room) {
            new LogoRoom(world.scene).load();
          }

          for (let portalName in worldInfo.portals) {
            let portalInfo = worldInfo.portals[portalName];
            console.log('Portal ' + portalName, portalInfo);
            let serverFolder = new ServerFolder(portalInfo.serverFolder.baseUrl, portalInfo.serverFolder.name, portalInfo.serverFolder.related);
            let portal = new Portal(world.scene, serverFolder);
            portal.loadAt(portalInfo.x, portalInfo.y, portalInfo.z, portalInfo.angle).then(p=>p.enabled(portalInfo.enabled));
          }
          for (let url in worldInfo.assets) {
            let instances = worldInfo.assets[url].instances;
            if (!url.startsWith("/")) {
              // relative url, make it relative to world script path
              url = this.baseUrl + url;
            }
            instances.forEach(instance => {
              var vrObject = {
                mesh: url,
                position: instance.position,
                rotation: instance.rotation,
                scale: instance.scale
              };
              VRSPACEUI.assetLoader.loadObject(vrObject, mesh => {
                mesh.position = new BABYLON.Vector3(instance.position.x, instance.position.y, instance.position.z);
                mesh.rotation = new BABYLON.Vector3(instance.rotation.x, instance.rotation.y, instance.rotation.z);
                if ( instance.scale ) {
                  mesh.scaling = new BABYLON.Vector3(instance.scale.x, instance.scale.y, instance.scale.z);
                } else {
                  // TODO avatar size is dynamic
                }
              });
            });
          }
          
        });
        
        
      });
    });
    return world.scene;
  }

}