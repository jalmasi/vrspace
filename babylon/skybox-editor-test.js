import { World, WorldManager, VRSPACEUI } from './js/vrspace-min.js';

export class SkyboxEditorExample extends World {
  async load() {
    // we're not loading any models
    // but we're displaying UI instead
    this.connect();
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

  makeSkyBox( dir,name ) {
    var skybox = BABYLON.Mesh.CreateBox("skyBox-"+name, 1, this.scene);
    var skyboxMaterial = new BABYLON.StandardMaterial("skyBox-"+name, this.scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.disableLighting = true;
    skybox.material = skyboxMaterial;
    //skybox.infiniteDistance = true;
    skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture(dir, this.scene);
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
    return skybox;
  }
  
  isSelectableMesh(mesh) {
    return this.boxes.includes(mesh) || super.isSelectableMesh();
  }
  
  connect() {
    this.initXR(this.vrHelper);
    
    this.boxes=[];
    var skyboxes = new Set();
    var anchor = new BABYLON.TransformNode("anchor");
    anchor.position.y = 2;
    var panel = new BABYLON.GUI.CylinderPanel();
    panel.margin = .2;
    var manager = VRSPACEUI.guiManager;
    manager.addControl(panel);
    panel.linkToTransformNode(anchor);

    VRSPACEUI.listMatchingFiles("/content/skybox/", list => {
      // list is ServerFolder array
      list.forEach( sf => {
        // sf is ServerFolder object
        VRSPACEUI.listDirectory(sf.url(), skyboxDir => {
          console.log(sf.url(), skyboxDir);
          skyboxDir.forEach( f => {
            // f is an individual file
            // name is directoryUrl+skyboxName+_axis+.jpg
            var skyboxName = f.substring( f.lastIndexOf("/")+1, f.lastIndexOf("_") );
            // and this is what we need to create cubeTexture:
            var skyboxDir = f.substring( 0, f.lastIndexOf("_") );
            console.log(f, skyboxName, skyboxDir);
            if ( ! skyboxes.has(skyboxDir)) {
              skyboxes.add(skyboxDir);
              var box = this.makeSkyBox(skyboxDir,skyboxName);
              //box.position = new BABYLON.Vector3(skyboxes.size*2, 1, 0);
              var button = new BABYLON.GUI.MeshButton3D(box, "pushButton-"+skyboxName);
              button.onPointerDownObservable.add(() => {
                console.log(box);
                this.skyBox.material.reflectionTexture = box.material.reflectionTexture;

              });
              this.boxes.push(box);
              panel.addControl(button);
            }
          });
        }, ".jpg");
      }); 
    });
    new WorldManager(this);
    //this.worldManager.debug = true; // multi-user debug info
    //this.worldManager.VRSPACE.debug = true; // network debug info
  }
  
}

export const WORLD = new SkyboxEditorExample();