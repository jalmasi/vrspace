import { VRSPACE } from '../../client/vrspace.js';
import { VRSPACEUI } from '../vrspace-ui.js';
import { World } from '../../world/world.js';

export class WorldPersistence {
  /**
   * @param {World} world 
   * @param {HTMLInputElement} [fileInput] 
   */
  constructor(world, fileInput) {
    /** @type {World} */
    this.world = world;
    this.autoCreateFileInput = true;
    /** @type {HTMLInputElement} */
    this.fileInput = null;
    if (fileInput) {
      this.setFileInput(fileInput);
      this.autoCreateFileInput = false;
    }
  }
  /**
   * Save current scene: dumps everything using AssetLoader.dump(), and calls VRSPACEUI.saveFile(). 
   */
  save() {
    VRSPACEUI.progressStart("saveFile");
    let scene = {
      terrain:null,
      skybox:null,
      objects:VRSPACEUI.assetLoader.dump()
    }
    if (this.world.sharedSkybox) {
      scene.skybox = {
        texture: this.world.sharedSkybox.texture,
        amibentIntensity: this.world.sharedSkybox.amibentIntensity
      }
    }
    if (this.world.sharedTerrain) {
      console.log(this.world.sharedTerrain);
      scene.terrain = {
        diffuseColor:this.world.sharedTerrain.diffuseColor,
        diffuseTexture:this.world.sharedTerrain.diffuseTexture,
        emissiveColor:this.world.sharedTerrain.emissiveColor,
        specularColor:this.world.sharedTerrain.specularColor,
        points:this.world.sharedTerrain.points
      }
    }
    if (Object.keys(scene.objects).length > 0) {
      VRSPACEUI.saveFile(this.world.name + ".json", JSON.stringify(scene));
    }
    VRSPACEUI.progressEnd("saveFile");
  }

  /**
   * Implements load by adding change listener to file input html element. Called from constructor.
   * @param fileInput html file input element
   */
  setFileInput(fileInput) {
    this.fileInput = fileInput;
    fileInput.addEventListener('change', () => {
      const selectedFile = fileInput.files[0];
      if (selectedFile) {
        VRSPACEUI.progressStart("loadFile");
        console.log("Loading from ", selectedFile);
        const reader = new FileReader();
        reader.onload = async e => {
          const scene = JSON.parse(e.target.result);
          console.log("Loaded scene", scene);
          await this.publish(scene);
          VRSPACEUI.progressEnd("loadFile");
        }
        reader.readAsText(selectedFile);
      }
    }, false);
  }

  /**
   * Create a hidden file input.
   */
  createFileInput() {
    const input = document.createElement('input');
    input.type = 'file';
    input.id = 'VRSpace-fileInput';
    input.style = 'display:none';
    input.accept = '.json';
    this.setFileInput(input);
  }

  /**
   * Load saved scene, requires file input html element
   */
  load() {
    if (!this.fileInput && this.autoCreateFileInput) {
      console.log("WARNING no file input element, creating one");
      this.createFileInput();
    }
    this.fileInput.click();
  }

  /**
   * Publish all loaded object to the server
   * @param scene scene object, containing world objects, terrain, skybox
   */
  async publish(scene) {
    for (let url in scene.objects) {
      let instances = scene.objects[url].instances;
      if (!url.startsWith("/")) {
        // relative url, make it relative to world script path
        url = this.baseUrl + url;
      }
      instances.forEach(async instance => {
        let mesh = {
          mesh: url,
          active: true,
          position: instance.position,
          rotation: instance.rotation,
          scale: instance.scale
        };
        let obj = await VRSPACE.createSharedObject(mesh);
        console.log("Created new VRObject", obj);
      });
    }
    if (scene.skybox) {
      // CHECKME: this hangs, why?
      //this.world.skyBox.setTexture(scene.skybox.texture);
      await this.world.createSharedSkybox();
      this.world.worldManager.VRSPACE.sendEvent(this.world.sharedSkybox, { texture: scene.skybox.texture });
    }
    if (scene.terrain) {
      if ( !this.world.terrain ) {
        this.world.terrain = new Terrain(this.world);
        this.world.terrain.terrainMaterial = new BABYLON.StandardMaterial("terrainMaterial", this.world.scene);
        this.world.terrain.init(this.world.scene);
      }
      this.world.terrain.material().specularColor = new BABYLON.Color3(scene.terrain.specularColor.r, scene.terrain.specularColor.g, scene.terrain.specularColor.b);
      this.world.terrain.material().diffuseColor = new BABYLON.Color3(scene.terrain.diffuseColor.r, scene.terrain.diffuseColor.g, scene.terrain.diffuseColor.b);
      this.world.terrain.material().emissiveColor = new BABYLON.Color3(scene.terrain.emissiveColor.r, scene.terrain.emissiveColor.g, scene.terrain.emissiveColor.b);
      this.world.terrain.setTexture(scene.terrain.diffuseTexture);

      await this.world.createSharedTerrain();
      this.terrain?.points?.forEach(point=>{
        this.worldManager.VRSPACE.sendEvent(World.lastInstance.sharedTerrain, { change: { index: point.index, point: {x:point.x, y:point.y, z:point.z} } });
      });
    }
  }
  
  
}