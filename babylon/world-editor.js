import { World, VRSPACEUI, WorldManager } from './js/vrspace-min.js';

export class WorldTemplate extends World {
  async load() {
    // we're not loading any models
    // but we're displaying UI instead
    this.makeUI();
    this.connect();
    this.editingObjects=[];
    this.installClickHandler();
    this.createButtons();
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
    this.uiRoot = new BABYLON.TransformNode("SearchUI");

    this.uiRoot.position.y = 2;
    this.guiManager = new BABYLON.GUI.GUI3DManager(this.scene);
    this.panel = new BABYLON.GUI.CylinderPanel();
    this.panel.margin = 0.05;
    this.panel.columns = 6;
    this.guiManager.addControl(this.panel);
    this.panel.linkToTransformNode(this.uiRoot);
    //panel.position.z = -1.5;

    this.buttonPrev = new BABYLON.GUI.HolographicButton("prev");
    this.buttonPrev.imageUrl = "//www.babylonjs-playground.com/textures/icons/Upload.png";
    this.guiManager.addControl(this.buttonPrev);
    this.buttonPrev.linkToTransformNode(this.uiRoot);
    this.buttonPrev.position = new BABYLON.Vector3(-4,0,4);
    this.buttonPrev.mesh.rotation = new BABYLON.Vector3(0,0,Math.PI/2);
    this.buttonPrev.tooltipText = "Previous";
    this.buttonPrev.isVisible = false;

    this.buttonNext = new BABYLON.GUI.HolographicButton("next");
    this.buttonNext.imageUrl = "//www.babylonjs-playground.com/textures/icons/Upload.png";
    this.guiManager.addControl(this.buttonNext);
    this.buttonNext.linkToTransformNode(this.uiRoot);
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
    
    this.worldManager.loadCallback = (object, rootMesh) => this.objectLoaded(object, rootMesh);    
  }
  
  objectLoaded( vrObject, rootMesh ) {
    VRSPACEUI.indicator.remove("Download");
    console.log("Loaded:");
    console.log(vrObject);
    if ( vrObject.properties && vrObject.properties.editing == this.worldManager.VRSPACE.me.id ) {
      this.editingObjects.push(vrObject.id);
      console.log("Loaded my object "+vrObject.id)
      this.take(vrObject);
      // CHECKME: in case of instancing existing container, it may not be displayed yet, does not resize
      setTimeout( () => {
        var scale = 1/this.worldManager.bBoxMax(rootMesh);
        //var scale = 1/this.worldManager.bBoxMax(this.worldManager.getRootNode(vrObject));
        this.worldManager.VRSPACE.sendEvent(vrObject, {scale: { x:scale, y:scale, z:scale }} );
      }, 100 );
    }
  }

  makeAButton(text, imageUrl, action) {
    var button = new BABYLON.GUI.HolographicButton(text+"Button");
    this.guiManager.addControl(button);
    button.imageUrl = imageUrl;
    button.text=text;
    button.position = new BABYLON.Vector3(this.buttonLeft,-0.1,.5);
    button.scaling = new BABYLON.Vector3( .05, .05, .05 );
    button.mesh.parent = this.camera;
    button.onPointerDownObservable.add( () => {
      if ( this.activeButton == button ) {
        // already pressed, turn it off
        this.activeButton = null;
        this.displayButtons(true);
      } else {
        this.displayButtons(false);
        button.isVisible = true;
        this.activeButton = button;
      }
    });
    button.customAction = action;
    this.buttons.push( button );
    this.buttonLeft += .075;
    return button;
  }
  
  createButtons() {
    this.buttons = [];
    this.buttonLeft = -.2+0.025/2;
  
    this.rotateButton = this.makeAButton( "Rotate", "//www.babylonjs-playground.com/textures/icons/Refresh.png", (o)=>this.rotateObject(o));  
    this.scaleButton = this.makeAButton("Resize", "/content/icons/resize.png", (o)=>this.resizeObject(o));
    this.alignButton = this.makeAButton("Align", "//www.babylonjs-playground.com/textures/icons/Download.png", (o)=>this.alignObject(o));
    this.alignButton = this.makeAButton("Upright", "//www.babylonjs-playground.com/textures/icons/Upload.png", (o)=>this.upright(o));
    this.deleteButton = this.makeAButton("Remove", "//www.babylonjs-playground.com/textures/icons/Delete.png", (o)=>this.removeObject(o));
    this.searchButton = this.makeAButton("Search", "//www.babylonjs-playground.com/textures/icons/Zoom.png");
    
    this.searchButton.onPointerDownObservable.add( () => this.relocatePanel());
    this.displayButtons(false);
  }
  
  manipulateObject(obj, action) {
    if ( ! action ) {
      this.displayButtons(true);
      return;
    }
    action(obj);
  }
  
  resizeObject(obj) {
    var point;
    var resizeHandler = this.scene.onPointerObservable.add((pointerInfo) => {
      if ( pointerInfo.type == BABYLON.PointerEventTypes.POINTERDOWN ) {
        point = pointerInfo.pickInfo.pickedPoint;
      }
      if ( pointerInfo.type == BABYLON.PointerEventTypes.POINTERUP ) {
        this.scene.onPointerObservable.remove(resizeHandler);
        if ( pointerInfo.pickInfo.hit && VRSPACEUI.findRootNode(pointerInfo.pickInfo.pickedMesh) == obj ) {
          var diff = pointerInfo.pickInfo.pickedPoint.y - point.y; 
          var scale = obj.scaling.y + diff;
          scale = Math.max(scale, obj.scaling.y * .1);
          console.log("Scaling: "+obj.scaling.y+" to "+scale); 
          this.worldManager.VRSPACE.sendEvent(obj.VRObject, {scale: { x:scale, y:scale, z:scale }} );
        }
      }
    });
  }
  rotateObject(obj) {
    var point;
    var rotateHandler = this.scene.onPointerObservable.add((pointerInfo) => {
      if ( pointerInfo.type == BABYLON.PointerEventTypes.POINTERDOWN ) {
        point = pointerInfo.pickInfo.pickedPoint;
      }
      if ( pointerInfo.type == BABYLON.PointerEventTypes.POINTERUP ) {
        this.scene.onPointerObservable.remove(rotateHandler);
        if ( pointerInfo.pickInfo.hit && VRSPACEUI.findRootNode(pointerInfo.pickInfo.pickedMesh) == obj ) {
          var diff = pointerInfo.pickInfo.pickedPoint.subtract(point).normalize();
          console.log(diff);
          var ax = Math.abs(diff.x);
          var ay = Math.abs(diff.y);
          var az = Math.abs(diff.z);
          // TODO spatial transformations
          var rot = new BABYLON.Vector3(obj.rotation.x, obj.rotation.y, obj.rotation.z); 
          console.log(rot);
          if ( ax > ay && ax > az ) {
            rot.y += diff.y;
          } else if ( ay > ax && ay > az ) {
            rot.z += diff.z;
          } else if ( az > ay && az > ax ) {
            rot.x += diff.x;
          } else {
            console.log("CHECKME - zero?")
            return;
          }
          console.log(rot);
          this.worldManager.VRSPACE.sendEvent(obj.VRObject, {rotation: { x:rot.x, y:rot.y, z:rot.z}} );
        }
      }
    });
  }
  
  
  alignObject(obj) {
    var origin = obj.position;
    var direction = new BABYLON.Vector3(0,-1,0);
    var length = 100;
    var ray = new BABYLON.Ray(origin, direction, length);
    var pickInfo = this.scene.pickWithRay(ray, (mesh) => {
      var pickedRoot = VRSPACEUI.findRootNode(mesh);
      return pickedRoot != obj;
    });
    console.log(pickInfo);
    var y = obj.position.y - pickInfo.distance;
    this.worldManager.VRSPACE.sendEvent(obj.VRObject, {position: { x:obj.position.x, y:y, z:obj.position.z }} );
  }
  
  upright(obj) {
    this.worldManager.VRSPACE.sendEvent(obj.VRObject, {rotation: { x:0, y:0, z:0 }} );
  }

  removeObject(obj) {
    this.worldManager.VRSPACE.deleteSharedObject(obj.VRObject);
  }

  displayButtons(show) {
    this.buttons.forEach( button => button.isVisible = show);
    this.displayingButtons = show;
    if ( show ) {
      this.activeButton = null;
    }
  }  
  
  relocatePanel() {
    var forwardDirection = this.scene.activeCamera.getForwardRay(6).direction;
    this.uiRoot.position = this.scene.activeCamera.position.add(forwardDirection);
    //this.uiRoot.rotation = new BABYLON.Vector3(0,this.scene.activeCamera.rotation.y,0);
    this.uiRoot.rotation = new BABYLON.Vector3(this.scene.activeCamera.rotation.x,this.scene.activeCamera.rotation.y,this.scene.activeCamera.rotation.z);
    this.displayButtons(true);
  }
  
  installClickHandler() {
    this.clickHandler = this.scene.onPointerObservable.add((pointerInfo) => {
      var pickedRoot = VRSPACEUI.findRootNode(pointerInfo.pickInfo.pickedMesh);
      switch (pointerInfo.type) {
        case BABYLON.PointerEventTypes.POINTERDOWN:
          if ( this.activeButton ) {
            if ( pickedRoot.VRObject ) {
              // make an action on the object
              console.log("Manipulating shared object "+pickedRoot.VRObject.id+" "+pickedRoot.name);
              this.manipulateObject(pickedRoot, this.activeButton.customAction);
            }
          } else {
            this.taking = pickedRoot;
          }
          break;
        case BABYLON.PointerEventTypes.POINTERUP:
          if ( this.taking == pickedRoot && pickedRoot.VRObject ) {
            var vrObject = pickedRoot.VRObject;
            console.log("Picked shared object "+vrObject.id+" "+pickedRoot.name);
            console.log(this.editingObjects);
            if ( ! this.editingObjects.includes(vrObject.id)) {
              this.editingObjects.push(vrObject.id);
              this.take(vrObject);
            }
          }
          break;
      }
    });
  }
  
  take(obj) {
    this.taking = null;
    if ( obj.changeListener ) {
      // already tracking
      return;
    }
    var root = this.worldManager.getRootNode(obj);
    this.sendPos(obj);
    obj.changeListener = () => this.sendPos(obj);
    this.worldManager.addMyChangeListener( obj.changeListener );
    setTimeout( () => {
      obj.clickHandler = this.scene.onPointerObservable.add((pointerInfo) => {
        var pickedRoot = VRSPACEUI.findRootNode(pointerInfo.pickInfo.pickedMesh);
        switch (pointerInfo.type) {
          case BABYLON.PointerEventTypes.POINTERDOWN:
            if(pointerInfo.pickInfo.hit && pickedRoot == root) {
              this.dropping = root;
            }
            break;
          case BABYLON.PointerEventTypes.POINTERUP:
            if(pointerInfo.pickInfo.hit && pickedRoot == root && this.dropping == root) {
              this.drop(obj);
            }
            break;
        }
      }),
      100
    });
    console.log("took "+obj.id);
    this.displayButtons(false);
  }

  sendPos(obj) {
    var forwardDirection = this.scene.activeCamera.getForwardRay(2).direction;
    var pos = this.scene.activeCamera.position.add(forwardDirection).add(new BABYLON.Vector3(0,-.5,0));
    var rot = this.scene.activeCamera.rotation;
    this.worldManager.VRSPACE.sendEvent(obj, {position: { x:pos.x, y:pos.y, z:pos.z }, rotation: { x:rot.x, y:rot.y, z:rot.z }} );
  }
  
  drop(obj) {
    this.dropping = null;
    var pos = this.editingObjects.indexOf(obj.id);
    if ( pos > -1 ) {
      this.editingObjects.splice(pos,1);
    }

    this.scene.onPointerObservable.remove(obj.clickHandler);
    this.worldManager.removeMyChangeListener( obj.changeListener );
    delete obj.clickHandler;
    delete obj.changeListener;
    this.sendPos(obj);
    this.worldManager.changeCallback = null;
    console.log("dropped "+obj.id);
    this.displayButtons(true);
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
                    VRSPACEUI.indicator.add("Download");
                    console.log(result);
                    console.log("TODO: Download "+result.uri+" as "+result.uid);
                    //this.sketchfabLogin();
                    fetch("/download?uid="+result.uid)
                      .then(res => res.json())
                      .then(res => {
                        console.log(res);
                        this.worldManager.VRSPACE.createSharedObject({
                          mesh: res.mesh,
                          properties: {editing: this.worldManager.VRSPACE.me.id},
                          position:{x:0, y:0, z:0},
                          active:true
                        }, (obj)=>{
                          console.log("Created new VRObject", obj);
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