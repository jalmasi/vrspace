import { VRSPACEUI, World, TextArea } from './js/vrspace-min.js';
export class TextWorld extends World {
  async load(callback) {
    // we're not loading any models
    // but we're displaying UI instead
    if ( callback ) {
      // make sure to notify avatar-selection
      callback(this);
    }
  }
  async createCamera() {
    this.camera = this.universalCamera(new BABYLON.Vector3(0, 2, -2));
    this.camera.ellipsoid = new BABYLON.Vector3(.1, .1, .1); // dolphins are not humans
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
  
  testFontSize(pos, fontSize = 16, width = 512) {
    let textArea = new TextArea(this.scene);
    textArea.size = 2;
    textArea.fontSize = fontSize;
    textArea.position = pos;
    textArea.width = width;
    textArea.show();
    for ( let col = 1; col <= textArea.getMaxCols(); col++ ) {
      textArea.write(col%10);
    }
    for ( let row = 2; row < textArea.getMaxRows(); row++ ) {
      textArea.writeln(row);
    }
    textArea.writeln(textArea.getMaxRows()+" rows "+textArea.getMaxCols()+" cols fontSize "+textArea.fontSize+" offset "+textArea.textBlock.fontOffset.height);
  }
  
  createUI() {
    this.testFontSize(new BABYLON.Vector3(0,2,3));
    this.testFontSize(new BABYLON.Vector3(3,2,3), 12);
    this.testFontSize(new BABYLON.Vector3(-3,2,3), 10);
    this.testFontSize(new BABYLON.Vector3(2,2,5), 8);
    this.testFontSize(new BABYLON.Vector3(6,2,5), 24, 1024);
    
    let textWrap = new TextArea(this.scene);
    textWrap.size = 2;
    textWrap.addHandles = false;
    textWrap.position = new BABYLON.Vector3(-2,2,5);
    textWrap.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    textWrap.show();
    for ( let i = 0; i < 10; i++ ) {
      textWrap.write("word wrap test ");
    }
    for ( let i = 0; i < 10; i++ ) {
      textWrap.write("testing 1 2 3... ");
    }
    textWrap.writeln("\nclick to clear");
    textWrap.onClick(e=>textWrap.clear());
    
    let state = 0;
    let hudText = new TextArea(this.scene);
    hudText.text = "An example of a TextArea\nattached to camera";
    hudText.attachToCamera();
    hudText.size = .1;
    hudText.receivePointer = true;
    hudText.position = new BABYLON.Vector3(-.1, 0, .2);
    hudText.show();
    hudText.writeln("\nclick to attach to HUD");
    hudText.onClick(e=>{
      if ( hudText.handles ) {
        hudText.removeHandles();
        hudText.println("handles removed");
      } else { 
        hudText.createHandles(); 
        hudText.println("handles created");
      }
      if ( state%3 == 0 ) {
        hudText.attachToHud();
        hudText.writeln("state: "+state+" - attached to HUD, click to attach to camera");
      } else if (state%3 == 1) {
        hudText.attachToCamera();
        hudText.writeln("state: "+state+" - attached to camera, click to detach");
      } else if (state%3 == 2) {
        hudText.detach();
        hudText.writeln("state: "+state+" - detached, click to take");
      }
      state ++;
    });
  }
  

}

export { VRSPACEUI };
export const WORLD = new TextWorld();
