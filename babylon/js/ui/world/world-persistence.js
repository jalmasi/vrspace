import { VRSPACE } from '../../client/vrspace.js';
import { VRSPACEUI } from '../vrspace-ui.js';
import { World } from '../../world/world.js';

export class WorldPersistence {
  /**
   * @param {World} world 
   * @param {HTMLInputElement} [fileInput] 
   */
  constructor(world, fileInput) {
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
    const dump = VRSPACEUI.assetLoader.dump();
    if (Object.keys(dump).length > 0) {
      VRSPACEUI.saveFile(this.world.name + ".json", JSON.stringify(dump));
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
        reader.onload = e => {
          var objects = JSON.parse(e.target.result);
          console.log(objects);
          this.publish(objects);
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
   * @param objects VRObject array
   */
  publish(objects) {
    for (var url in objects) {
      var instances = objects[url].instances;
      if (!url.startsWith("/")) {
        // relative url, make it relative to world script path
        url = this.baseUrl + url;
      }
      instances.forEach((instance) => {
        var mesh = {
          mesh: url,
          active: true,
          position: instance.position,
          rotation: instance.rotation,
          scale: instance.scale
        };
        VRSPACE.createSharedObject(mesh).then(obj => {
          console.log("Created new VRObject", obj);
        });
      });
    }
  }
  
}