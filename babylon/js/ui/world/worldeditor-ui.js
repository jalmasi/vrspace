import { VRSPACEUI } from '../vrspace-ui.js';
import { VRSpaceAPI } from '../../client/rest-api.js';
import { World } from '../../world/world.js';
import { WorldEditor } from './world-editor.js';
import { TerrainEditor } from './terrain-editor.js';
import { SkyboxSelector } from './skybox-selector.js';

export class WorldEditorUI {
  constructor(scene) {
    this.scene = scene;
    this.hud = VRSPACEUI.hud;
    this.contentBase = VRSPACEUI.contentBase;
    /** @type {VRSpaceAPI} */
    this.api = VRSpaceAPI.getInstance();
    /** TODO appropriate API calls 
     * @type {GroupsApi} */
    this.groupApi = this.api.endpoint.groups;
    this.terrainEdit = null;
    this.skyboxEdit = null;
    this.terrainEditor = null;
    this.skyboxSelector = null;
    this.editing = false;
  }
  
  show(button) {
    VRSPACEUI.hud.showButtons(false, button);
    VRSPACEUI.hud.newRow();
    
    this.worldEdit = VRSPACEUI.hud.addButton("World", this.contentBase+"/content/icons/world.png", (b,i)=>this.editWorld(b,i), false);
    this.terrainEdit = VRSPACEUI.hud.addButton("Terrain", this.contentBase+"/content/icons/terrain.png", (b,i)=>this.editTerrain(b,i), false);
    this.skyboxEdit = VRSPACEUI.hud.addButton("Skybox", this.contentBase+"/content/icons/sky.png", (b,i)=>this.editSkybox(b,i), false);
    if (!World.lastInstance.terrain || World.lastInstance.inAR) {
      this.hud.markDisabled(this.terrainEdit);
    }
    if (!World.lastInstance.skyBox || World.lastInstance.inAR) {
      this.hud.markDisabled(this.skyboxEdit);
    } else {
      this.skyboxSelector = new SkyboxSelector(World.lastInstance);
    }
    
    VRSPACEUI.hud.enableSpeech(true);
  }
  
  hide() {
    VRSPACEUI.hud.clearRow();
    VRSPACEUI.hud.showButtons(true);
    this.dispose();
  }

  dispose() {
    this.worldEdit.dispose();
    this.terrainEdit.dispose();
    this.skyboxEdit.dispose();
    if ( this.worldEditor ) {
      this.worldEditor.dispose();
    }
    if ( this.terrainEditor ) {
      this.terrainEditor.dispose();      
    }
    if ( this.skyboxSelector ) {
      this.skyboxSelector.dispose();
    }
  }
  
  editWorld(button, vector3WithInfo) {
    this.editing = !this.editing;
    console.log("World editor active:"+this.editing);
    if ( this.editing ) {
      VRSPACEUI.hud.showButtons(!this.editing, button);
      VRSPACEUI.hud.newRow();
      this.worldEditor = new WorldEditor(World.lastInstance, this.fileInputElement);
    } else {
      //while ( VRSPACEUI.hud.rows.length > 1 ) {
        VRSPACEUI.hud.clearRow();
      //}
      this.worldEditor.dispose();
      VRSPACEUI.hud.showButtons(!this.editing, button);
    }
  }

  editTerrain(button, vector3WithInfo) {
    this.editing = !this.editing;
    console.log("Terrain editor active:"+this.editing);
    if ( this.editing ) {
      this.terrainEditor = new TerrainEditor(World.lastInstance);      
      World.lastInstance.terrain.mesh().setEnabled(true);
      VRSPACEUI.hud.showButtons(!this.editing, button);
      VRSPACEUI.hud.newRow();
      this.terrainEditor.edit();
      // ground is not selectable while editing terrain, but otherwise must be to allow teleportation
      World.lastInstance.enableFloorSelection(false);
    } else {
      VRSPACEUI.hud.clearRow();
      this.terrainEditor.dispose();
      VRSPACEUI.hud.showButtons(!this.editing, button);
      // ground is not selectable while editing terrain, but otherwise must be to allow teleportation
      World.lastInstance.enableFloorSelection(true);      
    }
  }

  editSkybox(button, vector3WithInfo) {
    this.editing = !this.editing;
    console.log("Skybox editor active:"+this.editing);
    if ( this.editing ) {
      VRSPACEUI.hud.showButtons(!this.editing, button);
      VRSPACEUI.hud.newRow();
      this.skyboxSelector.show();
      VRSPACEUI.hud.enableSpeech(true);
    } else {
      VRSPACEUI.hud.clearRow();
      this.skyboxSelector.hide();
      VRSPACEUI.hud.showButtons(!this.editing, button);
    }
  }
  
}