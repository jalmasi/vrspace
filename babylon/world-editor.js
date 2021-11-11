import { World, VRSPACEUI, WorldManager } from './js/vrspace-min.js';

export class WorldTemplate extends World {
  async load() {
    // we're not loading any models
    // but we're displaying UI instead
    this.makeUI();
    this.connect();
    this.editingObjects=[];
  }
  async createCamera() {
    // utility function to create UniversalCamera:
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
    
    // handy function for dynamic script loading
    await VRSPACEUI.loadScriptsToDocument([ 
      //"//www.vrspace.org/babylon/babylon.gridMaterial.min.js"
      "/babylon/js/lib/babylon.gridMaterial.min.js"
    ]);
    // handy material
    this.ground.material = new BABYLON.GridMaterial("groundMaterial", this.scene);
    this.ground.material.opacity = 0.999;
    this.ground.material.backFaceCulling = false;
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
    skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture(this.assetPath("/content/skybox/eso_milkyway/milkyway"), this.scene);
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
    return skybox;
  }
  
  makeUI() {
    var anchor = new BABYLON.TransformNode("SearchAnchor");

    anchor.position.y = 2;
    var manager = new BABYLON.GUI.GUI3DManager(this.scene);
    this.panel = new BABYLON.GUI.CylinderPanel();
    this.panel.margin = 0.05;
    this.panel.columns = 6;
    manager.addControl(this.panel);
    this.panel.linkToTransformNode(anchor);
    //panel.position.z = -1.5;

    this.buttonPrev = new BABYLON.GUI.HolographicButton("prev");
    this.buttonPrev.imageUrl = "//www.babylonjs-playground.com/textures/icons/Upload.png";
    manager.addControl(this.buttonPrev);
    this.buttonPrev.linkToTransformNode(anchor);
    this.buttonPrev.position = new BABYLON.Vector3(-4,0,4);
    this.buttonPrev.mesh.rotation = new BABYLON.Vector3(0,0,Math.PI/2);
    this.buttonPrev.tooltipText = "Previous";
    this.buttonPrev.isVisible = false;

    this.buttonNext = new BABYLON.GUI.HolographicButton("next");
    this.buttonNext.imageUrl = "//www.babylonjs-playground.com/textures/icons/Upload.png";
    manager.addControl(this.buttonNext);
    this.buttonNext.linkToTransformNode(anchor);
    this.buttonNext.position = new BABYLON.Vector3(4,0,4);
    this.buttonNext.mesh.rotation = new BABYLON.Vector3(0,0,-Math.PI/2);
    this.buttonNext.tooltipText = "Next";
    this.buttonNext.isVisible = false;
  }
  
  async _initWriter() {
    if ( ! this.Writer ) {
      await VRSPACEUI.loadScriptsToDocument([ 
        "https://cdn.rawgit.com/BabylonJS/Extensions/master/MeshWriter/meshwriter.min.js"
      ]);
      this.Writer = BABYLON.MeshWriter(this.scene, {scale:.02,defaultFont:"Arial"});
    }
  }
  
  async write(button, text) {
    await this._initWriter();
    if ( button.textMesh ) {
      button.textMesh.dispose();
      button.textParent.dispose();
      delete button.textMesh;
      delete button.textParent;
    }
    if ( text && text.length > 0 ) {
      button.textMesh = new this.Writer(
                          text,
                          {
                              anchor: "center",
                              "letter-height": 8,
                              color: "#1C3870",
                          }
                      );
      button.textParent = new BABYLON.TransformNode('textParent');
      button.textParent.parent = button.node;
      button.textParent.position.z = -1;
      
      button.textMesh.getMesh().rotation.x = -Math.PI/2;
      button.textMesh.getMesh().parent = button.textParent;
    }
  }
  
  connect() {
    new WorldManager(this);
    //this.worldManager.debug = true; // multi-user debug info
    //this.worldManager.VRSPACE.debug = true; // network debug info

    this.worldManager.enter({mesh:'//www.vrspace.org/babylon/dolphin.glb'});
    
    this.worldManager.loadCallback = (object, container) => this.objectLoaded(object,container);    
  }
  
  objectLoaded( vrObject, assetContainer ) {
    console.log("Loaded:");
    console.log(vrObject);
    if ( this.editingObjects.includes(vrObject.id)) {
      console.log("Loaded my object "+vrObject.id)
      var scale = 1/this.worldManager.bBoxMax(assetContainer);
      this.worldManager.VRSPACE.sendEvent(vrObject, {scale: { x:scale, y:scale, z:scale }} );
      this.take(vrObject);
    }
  }

  take(obj) {
    if ( obj.changeListener ) {
      // already tracking
      return;
    }
    var root = obj.container.meshes[0];
    this.sendPos(obj);
    obj.changeListener = () => this.sendPos(obj);
    this.worldManager.addMyChangeListener( obj.changeListener );
    obj.clickHandler = this.scene.onPointerObservable.add((pointerInfo) => {
      switch (pointerInfo.type) {
        case BABYLON.PointerEventTypes.POINTERDOWN:
          break;
        case BABYLON.PointerEventTypes.POINTERUP:
          var pickedRoot = VRSPACEUI.findRootNode(pointerInfo.pickInfo.pickedMesh);
          console.log(pickedRoot.name);
          if(pointerInfo.pickInfo.hit && pickedRoot == root) {
            this.drop(obj);
          }
          break;
      }
    });
  }

  sendPos(obj) {
    var forwardDirection = this.scene.activeCamera.getForwardRay(2).direction;
    var pos = this.scene.activeCamera.position.add(forwardDirection).add(new BABYLON.Vector3(0,-.5,0));
    var rot = this.scene.activeCamera.rotation;
    this.worldManager.VRSPACE.sendEvent(obj, {position: { x:pos.x, y:pos.y, z:pos.z }, rotation: { x:rot.x, y:rot.y, z:rot.z }} );
  }
  
  drop(obj) {
    var pos = this.editingObjects.indexOf(obj.id);
    if ( pos > -1 ) {
      this.editingObjects.splice(pos,1);
    }

    this.scene.onPointerObservable.remove(obj.clickHandler);
    this.worldManager.removeMyChangeListener( obj.changeListener );
    delete obj.clickHandler;
    this.sendPos(obj);
    this.worldManager.changeCallback = null;
  }

  doFetch(url) {
      fetch(url).then(response => {
          response.json().then( obj=> {
              console.log(obj);
              this.panel.children.forEach( (button) => button.dispose() );

              this.buttonNext.isVisible = (obj.next != null);
              this.buttonNext.onPointerDownObservable.clear();
              this.buttonNext.onPointerDownObservable.add( () => {this.doFetch(obj.next)});
              this.buttonPrev.isVisible = (obj.previous != null);
              this.buttonPrev.onPointerDownObservable.clear();
              this.buttonPrev.onPointerDownObservable.add( () => {this.doFetch(obj.previous)});
                            
              obj.results.forEach(  result => {
                  // interesting result fields:
                  // next - url of next result page
                  // previous - url of previous page
                  //   for thumbnails.images, pick largest size, use url
                  //  archives.gltf.size
                  //  name
                  //  description
                  //  user.displayname
                  //  isAgeRestricted
                  //  categories.name
                  //console.log( result.description );
                  var thumbnail = result.thumbnails.images[0];
                  result.thumbnails.images.forEach( img => {
                    if ( img.size > thumbnail.size ) {
                      thumbnail = img;
                    }
                  });
                  //console.log(thumbnail);
                  
                  var button = new BABYLON.GUI.HolographicButton(result.name);
                  this.panel.addControl(button);

                  button.imageUrl = thumbnail.url;
                  
                  button.plateMaterial.disableLighting = true;
                  button.backMaterial.alpha = .5;

                  button.content.scaleX = 2;
                  button.content.scaleY = 2;
                  
                  button.onPointerEnterObservable.add( () => {
                      if ( ! button.textMesh ) {
                        this.write(button,result.name);
                      }
                  });
                  button.onPointerOutObservable.add( () => {
                      if ( button.textMesh ) {
                        this.write(button);
                      }
                  });
                  button.onPointerDownObservable.add( () => {
                    console.log(result);
                    console.log("TODO: Download "+result.uri+" as "+result.uid);
                    //this.sketchfabLogin();
                    fetch("/download?uid="+result.uid)
                      .then(res => res.json())
                      .then(res => {
                        console.log(res);
                        this.worldManager.VRSPACE.createSharedObject({
                          mesh: res.mesh,
                          position:{x:0, y:0, z:0},
                          active:true
                        }, (obj)=>{
                          console.log("Created new VRObject", obj);
                          this.editingObjects.push(obj.id);
                        });
                      });
                  });
                  
              });
          });
      });
      
  }
  sketchfabLogin() {
    var clientId = "u9ILgUMHeTRX77rbxPR6OYseVUQrYRD9CoIbNHbK";
    var redirectUri = "http://localhost:8080/callback";
    window.open(
      "https://sketchfab.com/oauth2/authorize/?response_type=code"+
      "&client_id="+clientId+
      "&redirect_uri="+redirectUri,
      "Sketchfab Login"
    );
  }
}

export const WORLD = new WorldTemplate();