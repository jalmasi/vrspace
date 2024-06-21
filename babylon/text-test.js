import { VRSPACEUI, World, TextArea, ChatLog, TextAreaInput } from './js/vrspace-min.js';

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
    textArea.canMinimize = false;
    textArea.show();
    for ( let col = 1; col <= textArea.getMaxCols(); col++ ) {
      textArea.write(col%10);
    }
    for ( let row = 2; row < textArea.getMaxRows(); row++ ) {
      textArea.writeln(row);
    }
    textArea.writeln(textArea.getMaxRows()+" rows "+textArea.getMaxCols()+" cols fontSize "+textArea.fontSize+" offset "+textArea.textBlock.fontOffset.height);
    this.selectables.push(textArea);
    return textArea;
  }

  testAutoscale(pos, text, width = 512, fontSize = 16) {
    let scaling = new TextArea(this.scene);
    scaling.text = text;
    scaling.titleText = "Title";
    scaling.fontSize = fontSize;
    scaling.width = width;
    scaling.size = .1;
    scaling.autoScale = true;
    scaling.addHandles = false;
    scaling.position = pos;
    scaling.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    scaling.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    scaling.show();
    this.selectables.push(scaling);
  }
  
  createUI() {
    this.selectables = [];
    
    // testing different font sizes
    this.testFontSize(new BABYLON.Vector3(0,2,3));
    this.testFontSize(new BABYLON.Vector3(3,2,3), 12);
    this.testFontSize(new BABYLON.Vector3(-3,2,3), 10);
    this.testFontSize(new BABYLON.Vector3(2,2,5), 8);
    this.testFontSize(new BABYLON.Vector3(6,2,5), 24, 1024);
    let capacityTest = this.testFontSize(new BABYLON.Vector3(-6,2,5), 48, 1024);
    // text auto-trimming test
    for ( let i = 0; i < 512*1024/48; i++ ) {
      capacityTest.print(i+" ");
    }
    capacityTest.println("Text length "+capacityTest.textBlock.text.length+" capacity "+capacityTest.capacity);
    
    // text wrapping test
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
    this.selectables.push(textWrap);

    // window scaling test
    this.testAutoscale(new BABYLON.Vector3(-10,1,5), "This is autoscaling test");
    this.testAutoscale(new BABYLON.Vector3(-10,2,5), "This is autoscaling test", 256);
    this.testAutoscale(new BABYLON.Vector3(-10,3,5), "This is autoscaling test", 128);
    
    // chatlog test
    let chatLog = new ChatLog(this.scene);
    chatLog.show();
    this.selectables.push(chatLog);
    
    // detach/attach to hud/camera test
    let state = 0;
    let hudText = new TextArea(this.scene, "TouchTextArea");
    hudText.text = "An example of a TextArea\nattached to camera";
    hudText.attachToCamera();
    hudText.size = .1;
    hudText.position = new BABYLON.Vector3(.1, 0, .2);
    hudText.show();
    hudText.writeln("\nclick to attach to HUD");
    this.selectables.push(hudText);

    let form = new TextAreaInput(hudText, "Chat", "A Label attached to TextArea");
    form.inputPrefix = "ME";
    form.addListener(text=>console.log(text));
    form.init();
    this.selectables.push(form);

    hudText.onClick(e=>{
      if ( hudText.handles ) {
        hudText.removeHandles();
        hudText.println("handles removed");
        hudText.title.setBackground("rgba(200,200,50,0.5)");
        hudText.title.setColor("black");
      } else {
        hudText.createHandles();
        hudText.println("handles created");
        hudText.title.setBackground("transparent");
        hudText.title.setColor("white");
      }
      let text;
      if ( state%3 == 0 ) {
        hudText.attachToHud();
        text = "attached to HUD, click to attach to camera"
      } else if (state%3 == 1) {
        hudText.attachToCamera();
        text = "attached to camera, click to detach";
        chatLog.leftSide();
      } else if (state%3 == 2) {
        hudText.detach();
        chatLog.rightSide();
        text = "detached, click to take";
      }
      hudText.writeln(text);
      hudText.title.setText(text);
      state ++;
    });
    
    this.initXR();
    this.hudText = hudText;
  }
  
  enterXR() {
    if ( this.hudText.attachedToCamera ) {
      this.hudText.attachToCamera();
    }
  }
  exitXR() {
    if ( this.hudText.attachedToCamera ) {
      this.hudText.attachToCamera();
    }
  }
  isSelectableMesh(mesh) {
    let ret = super.isSelectableMesh(mesh);
    this.selectables.forEach( o => ret |= o.isSelectableMesh(mesh));
    return ret;
  }  
}

export { VRSPACEUI };
export const WORLD = new TextWorld();
