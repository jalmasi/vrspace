import { World, VRSPACEUI, WorldEditor } from '../../../babylon/js/vrspace-min.js';

export class WorldEditorExample extends World {
  async load(callback) {
    // we're not loading any models, only ones sent by the server
    // but we do need to init SEARCH UI
    this.makeUI();
    // now proceed with normal loading sequence
    if ( callback ) {
      callback(this);
    }
  }
  
  async createCamera() {
    this.camera = this.universalCamera(new BABYLON.Vector3(0, 2, -2));
    this.camera.setTarget(new BABYLON.Vector3(0,2,0));
    this.camera.speed = .2;
    this.camera.applyGravity = false;
    return this.camera;
  }

  async createGround() {
    this.ground = BABYLON.MeshBuilder.CreateDisc("ground", {radius:1000}, this.scene);
    this.ground.rotation = new BABYLON.Vector3( Math.PI/2, 0, 0 );
    this.ground.position = new BABYLON.Vector3( 0, -0.05, 0 );
    this.ground.parent = this.floorGroup;
    //this.ground.isVisible = false;
    this.ground.checkCollisions = false;
    
    // handy material
    this.ground.material = new BABYLON.GridMaterial("groundMaterial", this.scene);
    this.ground.material.opacity = 0.999;
    this.ground.material.backFaceCulling = false;
    this.ground.material.alphaMode = BABYLON.Constants.ALPHA_PREMULTIPLIED;
    //this.ground.material.alphaMode = BABYLON.Constants.ALPHA_ONEONE; // also fine
    return this.ground;
  }
  
  async createLights() {
    var light = new BABYLON.DirectionalLight("light", new BABYLON.Vector3(-1, -1, 0), this.scene);
    light.intensity = 2;
    var light1 = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 1, 0), this.scene);
    return light1;
  }
  
  async createSkyBox() {
    var skybox = BABYLON.Mesh.CreateBox("skyBox", 10000, this.scene);
    var skyboxMaterial = new BABYLON.StandardMaterial("skyBox", this.scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.disableLighting = true;
    skybox.material = skyboxMaterial;
    skybox.infiniteDistance = true;
    skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("/content/skybox/eso_milkyway/milkyway", this.scene);
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
    return skybox;
  }
  
  entered(welcome) {
    console.log("Entered the world, starting world manager", welcome);
    this.worldEditor = new WorldEditor(this, this.fileInputElement);
  }

  // this shouldn't be here, but in HTML file
  makeUI() {
    var div = document.createElement("div");
    div.id = "searchForm";
    div.style = "position:absolute;bottom:80px;right:40%;color:white;";
    // CHECKME: sketchfab link?
    var html =
      `<label for="searchText">Search Sketchfab:</label>
      <input id="searchText" type="text">
      <label for="animated">Animated:</label>
      <input id="animated" type="checkbox">
      <label for="rigged">Rigged:</label>
      <input id="rigged" type="checkbox">
      <input type="file" id="fileInput" accept=".json" style="display:none;">`;
    
    div.innerHTML = html;
    document.body.appendChild(div);
    
    this.fileInputElement = document.getElementById('fileInput');

    var search = () => {
      canvas.focus();
      var text = document.getElementById('searchText').value;
      console.log('search: '+text);
      var args = {};
      if (document.getElementById('animated').checked) {
        args.animated = true;
      }
      if (document.getElementById('rigged').checked) {
        args.rigged = true;
      }
      this.search(text, args);
    }
    document.getElementById('searchText').addEventListener('change', () => search() );
    document.getElementById('animated').addEventListener('change', () => search() );
    document.getElementById('rigged').addEventListener('change', () => search() );
  }
  
  search( what, flags ) {
    this.worldEditor.search( what, flags );
  }
  
}

export const WORLD = new WorldEditorExample();