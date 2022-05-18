import {VRSPACEUI} from './vrspace-ui.js';
import {TextWriter} from './text-writer.js'

export class WorldEditor {
  constructor( world, fileInput ) {
    if ( ! world.worldManager ) {
      throw "World editor requires connection to the server - enter a world first";
    }
    this.world = world;
    this.scene = world.scene;
    if ( fileInput ) {
      this.setFileInput( fileInput );
    }
    this.contentBase=VRSPACEUI.contentBase;
    this.worldManager = world.worldManager;
    this.defaultErrorHandler = world.worldManager.loadErrorHandler;
    this.defaultloadCallback = world.worldManager.loadCallback;
    this.makeUI();
    this.installClickHandler();
    this.createButtons();
    this.worldManager.loadCallback = (object, rootMesh) => this.objectLoaded(object, rootMesh);
    this.worldManager.loadErrorHandler= (object, exception) => this.loadingFailed(object, exception);
    this.writer = new TextWriter(this.scene);
    
    this.worldPickPredicate = world.isSelectableMesh;
    // override world method to make every VRObject selectable
    world.isSelectableMesh = (mesh) => {
      return this.worldPickPredicate(mesh) || VRSPACEUI.findRootNode(mesh).VRObject;
    }
  }
  
  makeUI() {
    this.uiRoot = new BABYLON.TransformNode("SearchUI");

    this.uiRoot.position = new BABYLON.Vector3(0,2,0);
    this.uiRoot.rotation = new BABYLON.Vector3(0,0,0);
    //this.guiManager = new BABYLON.GUI.GUI3DManager(this.scene); // causes transparency issues
    this.guiManager = VRSPACEUI.guiManager;
    this.panel = new BABYLON.GUI.CylinderPanel();
    this.panel.blocklayout = true; // optimization, requires updateLayout() call
    this.panel.margin = 0.05;
    this.panel.columns = 6;
    this.guiManager.addControl(this.panel);
    this.panel.linkToTransformNode(this.uiRoot);

    this.buttonPrev = new BABYLON.GUI.HolographicButton("prev");
    this.buttonPrev.imageUrl = "https://www.babylonjs-playground.com/textures/icons/Upload.png";
    this.guiManager.addControl(this.buttonPrev);
    this.buttonPrev.linkToTransformNode(this.uiRoot);
    this.buttonPrev.position = new BABYLON.Vector3(-4,0,4);
    this.buttonPrev.mesh.rotation = new BABYLON.Vector3(0,0,Math.PI/2);
    this.buttonPrev.tooltipText = "Previous";
    this.buttonPrev.isVisible = false;

    this.buttonNext = new BABYLON.GUI.HolographicButton("next");
    this.buttonNext.imageUrl = "https://www.babylonjs-playground.com/textures/icons/Upload.png";
    this.guiManager.addControl(this.buttonNext);
    this.buttonNext.linkToTransformNode(this.uiRoot);
    this.buttonNext.position = new BABYLON.Vector3(4,0,4);
    this.buttonNext.mesh.rotation = new BABYLON.Vector3(0,0,-Math.PI/2);
    this.buttonNext.tooltipText = "Next";
    this.buttonNext.isVisible = false;
    
    // same material used for all buttons in this UI:
    this.buttonNext.backMaterial.alpha = .5;

  }
  
  createButtons() {
    this.moveButton = this.makeAButton( "Move", this.contentBase+"/content/icons/move.png", (o)=>this.take(o.VRObject, o.position));
    this.moveButton.onPointerUpObservable.add(()=>this.dropObject());
    this.rotateButton = this.makeAButton( "Rotate", "https://www.babylonjs-playground.com/textures/icons/Refresh.png", (o)=>this.rotateObject(o));  
    this.scaleButton = this.makeAButton("Resize", this.contentBase+"/content/icons/resize.png", (o)=>this.resizeObject(o));
    this.alignButton = this.makeAButton("Align", "https://www.babylonjs-playground.com/textures/icons/Download.png", (o)=>this.alignObject(o));
    this.alignButton = this.makeAButton("Upright", "https://www.babylonjs-playground.com/textures/icons/Upload.png", (o)=>this.upright(o));
    this.copyButton = this.makeAButton("Copy", this.contentBase+"/content/icons/copy.png", (o)=>this.copyObject(o));
    this.deleteButton = this.makeAButton("Remove", "https://www.babylonjs-playground.com/textures/icons/Delete.png", (o)=>this.removeObject(o));
    this.searchButton = this.makeAButton("Search", "https://www.babylonjs-playground.com/textures/icons/Zoom.png");
    this.saveButton = this.makeAButton("Save", "https://www.babylonjs-playground.com/textures/icons/Save.png");
    this.loadButton = this.makeAButton("Load", "https://www.babylonjs-playground.com/textures/icons/Open.png");
    
    this.searchButton.onPointerDownObservable.add( () => this.relocatePanel());
    this.saveButton.onPointerDownObservable.add( () => {this.save()});
    this.loadButton.onPointerDownObservable.add( () => {this.load()});
  }

  makeAButton(text, imageUrl, action) {
    var button = VRSPACEUI.hud.addButton(text,imageUrl);
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
    return button;
  }
  
  objectLoaded( vrObject, rootMesh ) {
    console.log("Loaded:");
    console.log(vrObject);
    if ( vrObject.properties && vrObject.properties.editing == this.worldManager.VRSPACE.me.id ) {
      VRSPACEUI.indicator.remove("Download");
      console.log("Loaded my object "+vrObject.id)
      if ( ! vrObject.scale ) {
        this.takeObject(vrObject);
        setTimeout( () => {
          var scale = 1/this.worldManager.bBoxMax(rootMesh);
          //var scale = 1/this.worldManager.bBoxMax(this.worldManager.getRootNode(vrObject));
          this.worldManager.VRSPACE.sendEvent(vrObject, {scale: { x:scale, y:scale, z:scale }} );
        }, 100 );
      } else {
        this.takeObject(vrObject, new BABYLON.Vector3(vrObject.position.x, vrObject.position.y, vrObject.position.z));
      }
    } else if ( this.defaultloadCallback ) {
      this.defaultloadCallback(vrObject, rootMesh);
    }
  }

  loadingFailed( obj, exception ) {
    VRSPACEUI.indicator.remove("Download");
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
          //var diff = pointerInfo.pickInfo.pickedPoint.y - point.y;
          var sign = Math.sign(pointerInfo.pickInfo.pickedPoint.y - point.y);
          var diff = pointerInfo.pickInfo.pickedPoint.subtract(point).length() * sign;
          var bbox = this.worldManager.bBoxMax(obj);
          console.log("bBoxMax:"+bbox+" diff:"+diff+" scaling:"+obj.scaling.y);
          //var scale = obj.scaling.y + diff;
          var scale = obj.scaling.y*(bbox+diff)/bbox;
          scale = Math.max(scale, obj.scaling.y * .2);
          scale = Math.min(scale, obj.scaling.y * 5);
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
          var dest = pointerInfo.pickInfo.pickedPoint;

          //var center = obj.position;
          var center = new BABYLON.Vector3(obj.position.x, (dest.y+point.y)/2, obj.position.z);
          var vFrom = point.subtract(center).normalize();
          var vTo = dest.subtract(center).normalize();
           
          var rotationMatrix = new BABYLON.Matrix();
          BABYLON.Matrix.RotationAlignToRef(vFrom, vTo, rotationMatrix);
          var quat = BABYLON.Quaternion.FromRotationMatrix(rotationMatrix);
          var result = BABYLON.Quaternion.FromEulerVector(obj.rotation).multiply(quat).toEulerAngles();

          console.log( obj.rotation+"->"+result);

          // vertical pointer movement:
          var dy = dest.y - point.y;
          // horizontal pointer movement:
          var dxz = new BABYLON.Vector3(dest.x,0,dest.z).subtract(new BABYLON.Vector3(point.x,0,point.z)).length();
          if ( Math.abs(dxz) > Math.abs(dy*3) ) {
            // mostly horizontal movement, rotation only around y
            console.log("Y rotation")
            this.worldManager.VRSPACE.sendEvent(obj.VRObject, {rotation: { x:obj.rotation.x, y:result.y, z:obj.rotation.z}} );
          } else {
            // rotating around all axes
            this.worldManager.VRSPACE.sendEvent(obj.VRObject, {rotation: { x:result.x, y:result.y, z:result.z}} );
          }

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
    this.worldManager.VRSPACE.sendEvent(obj.VRObject, {rotation: { x:0, y:obj.rotation.y, z:0 }} );
  }

  removeObject(obj) {
    this.worldManager.VRSPACE.deleteSharedObject(obj.VRObject);
  }

  copyObject(obj) {
    var vrObject = obj.VRObject;
    console.log(vrObject);
    this.activeButton = null;
    this.displayButtons(true);
    this.createSharedObject(vrObject.mesh, {position:vrObject.position, rotation:vrObject.rotation, scale:vrObject.scale});
  }
  
  displayButtons(show) {
    VRSPACEUI.hud.showButtons(show);
    if ( show ) {
      this.activeButton = null;
    }
  }
  
  relocatePanel() {
    //this.panel.linkToTransformNode();
    var forwardDirection = VRSPACEUI.hud.camera.getForwardRay(6).direction;
    this.uiRoot.position = VRSPACEUI.hud.camera.position.add(forwardDirection);
    this.uiRoot.rotation = new BABYLON.Vector3(VRSPACEUI.hud.camera.rotation.x,VRSPACEUI.hud.camera.rotation.y,VRSPACEUI.hud.camera.rotation.z);
    //this.panel.linkToTransformNode(this.uiRoot);
    this.displayButtons(true);
  }
  
  installClickHandler() {
    this.clickHandler = this.scene.onPointerObservable.add((pointerInfo) => {
      if ( pointerInfo.pickInfo.pickedMesh ) {
        var pickedRoot = VRSPACEUI.findRootNode(pointerInfo.pickInfo.pickedMesh);
        switch (pointerInfo.type) {
          case BABYLON.PointerEventTypes.POINTERDOWN:
            if ( this.activeButton ) {
              console.log("pickedMesh", pointerInfo.pickInfo.pickedMesh);
              console.log("pickedRoot", pickedRoot);
              if ( pickedRoot.VRObject && this.activeButton.isVisible) {
                // make an action on the object
                console.log("Manipulating shared object "+pickedRoot.VRObject.id+" "+pickedRoot.name);
                this.manipulateObject(pickedRoot, this.activeButton.customAction);
              }
            }
            break;
          case BABYLON.PointerEventTypes.POINTERUP:
            break;
        }
      }
    });
  }
  
  dropObject() {
    if ( ! this.activeButton && this.carrying ) {
      console.log("dropping");
      this.drop(this.carrying);
      this.carrying = null;
    }
  }
  
  takeObject(vrObject, position) {
    this.activeButton = this.moveButton;
    this.displayButtons(false);
    this.moveButton.isVisible = true;
    this.take(vrObject, position);
  }
  
  take(vrObject, position) {
    if ( vrObject.changeListener || this.carrying ) {
      // already tracking
      return;
    }

    this.carrying = vrObject;
    this.editObject( vrObject, true );
        
    // default position
    if ( ! position ) {
      var forwardDirection = VRSPACEUI.hud.camera.getForwardRay(2).direction;
      var forwardLower = forwardDirection.add(new BABYLON.Vector3(0,-.5,0));
      position = VRSPACEUI.hud.camera.position.add(forwardLower);
      vrObject.position.x = position.x;
      vrObject.position.y = position.y;
      vrObject.position.z = position.z;
      this.sendPos(vrObject);
    }

    // create an object and bind it to camera to track the position
    var targetDirection = position.subtract(VRSPACEUI.hud.camera.position);
    var forwardDirection = VRSPACEUI.hud.camera.getForwardRay(targetDirection.length()).direction;

    var rotationMatrix = new BABYLON.Matrix();
    BABYLON.Matrix.RotationAlignToRef(forwardDirection.normalizeToNew(), targetDirection.normalizeToNew(), rotationMatrix);
    var quat = BABYLON.Quaternion.FromRotationMatrix(rotationMatrix);

    var pos = new BABYLON.Vector3(0,0,targetDirection.length());
    pos.rotateByQuaternionToRef(quat, pos);
    
    var target = BABYLON.MeshBuilder.CreateBox("Position of "+vrObject.id, {size: .5}, this.scene);
    target.isPickable = false;
    target.isVisible = false;
    target.position = pos;
    if ( vrObject.rotation ) {
      var rot = new BABYLON.Vector3(vrObject.rotation.x, vrObject.rotation.y, vrObject.rotation.z);
      var quat = BABYLON.Quaternion.FromEulerVector(rot);
      quat = BABYLON.Quaternion.Inverse(VRSPACEUI.hud.camera.absoluteRotation).multiply(quat);
      target.rotation = quat.toEulerAngles()
    }
    target.parent = VRSPACEUI.hud.camera;
    vrObject.target = target;
    
    vrObject.changeListener = () => this.sendPos(vrObject);
    this.worldManager.addMyChangeListener( vrObject.changeListener );
    console.log("took "+vrObject.id);
  }

  sendPos(obj) {
    var rot = VRSPACEUI.hud.camera.rotation;
    var pos = obj.position;
    if ( obj.target ) {
      pos = obj.target.absolutePosition;
      rot = obj.target.absoluteRotationQuaternion.toEulerAngles();
    }
    this.worldManager.VRSPACE.sendEvent(obj, {position: { x:pos.x, y:pos.y, z:pos.z }, rotation: {x:rot.x, y:rot.y, z:rot.z}} );
  }
  
  drop(obj) {
    console.log("Dropping "+obj.target);
    this.editObject(obj, false);
        
    this.scene.onPointerObservable.remove(obj.clickHandler);
    this.worldManager.removeMyChangeListener( obj.changeListener );
    delete obj.clickHandler;
    delete obj.changeListener;
    this.sendPos(obj);

    if ( obj.target ) {
      obj.target.parent = null;
      obj.target.dispose();
      obj.target = null;
    }
    this.worldManager.changeCallback = null;
    console.log("dropped "+obj.id);
    this.displayButtons(true);
  }
  
  editObject(obj, editing) {
    if ( editing ) {
      obj.properties.editing = this.worldManager.VRSPACE.me.id;
    } else {
      obj.properties.editing = null;
    }
    this.worldManager.VRSPACE.sendEvent(obj, {properties: obj.properties} );
  }

  search(text, args) {
      var url = new URL('https://api.sketchfab.com/v3/search');
      /*
      interesting params:
        categories - dropdown, radio? Array[string]
        downloadable
        animated
        rigged
        license: by = CC-BY, sketchfab default
      */
      var params = { 
          q:text,
          type:'models',
          downloadable:true
      };
      if ( args ) {
        for ( var arg in args ) {
          params[arg] = args[arg];
        }
      }
      url.search = new URLSearchParams(params).toString();

      this.doFetch(url, true);
  }

  save() {
    this.displayButtons(true);
    var dump = VRSPACEUI.assetLoader.dump();
    if ( Object.keys(dump).length > 0 ) {
      VRSPACEUI.saveFile(this.world.name+".json", JSON.stringify(dump));
    }
  }

  setFileInput(fileInput) {
    this.fileInput = fileInput;
    fileInput.addEventListener('change', ()=>{
      const selectedFile = fileInput.files[0];
      if ( selectedFile ) {
        console.log(selectedFile);
        const reader = new FileReader();
        reader.onload = e => {
          var objects = JSON.parse(e.target.result);
          console.log(objects);
          this.publish(objects);
        }
        reader.readAsText(selectedFile);
      }
    }, false );
  }  
  
  load() {
    this.displayButtons(true);
    if ( this.fileInput ) {
      this.fileInput.click();
    } else {
      console.log("WARNING no file input element");
    }
  }
  
  publish( objects ) {
    for ( var url in objects) {
      var instances = objects[url].instances;
      if ( !url.startsWith("/") ) {
        // relative url, make it relative to world script path
        url = this.baseUrl+url;
      }
      instances.forEach( (instance) => {
        var mesh = { 
          mesh: url,
          active: true,
          position: instance.position,
          rotation: instance.rotation,
          scale: instance.scale 
        };
        this.worldManager.VRSPACE.createSharedObject(mesh, (obj)=>{
          console.log("Created new VRObject", obj);
        });
      });
    }
  }
  
  doFetch(url, relocate) {
      fetch(url).then(response => {
          response.json().then( obj=> {
              console.log(obj);
              // workaround for panel buttons all messed up
              var previous = { pos:this.uiRoot.position, rot:this.uiRoot.rotation };
              this.uiRoot.position = new BABYLON.Vector3(0,2,0);
              this.uiRoot.rotation = new BABYLON.Vector3(0,0,0);
              this.panel.linkToTransformNode();
              
              this.panel.children.forEach( (button) => {button.dispose()} );
              
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

                  button.content.scaleX = 2;
                  button.content.scaleY = 2;
                  
                  button.onPointerEnterObservable.add( () => {
                      this.writer.writeArray(button.node,
                        [result.name, 
                        'by '+result.user.displayName,
                        (result.archives.gltf.size/1024/1024).toFixed(2)+"MB"
                        //'Faces: '+result.faceCount,
                        //'Vertices: '+result.vertexCount
                        ]
                      );
                  });
                  button.onPointerOutObservable.add( () => {
                      this.writer.clear(button.node);
                  });
                  button.onPointerDownObservable.add( () => this.download(result));
              });
              // ending workaround:
              this.panel.linkToTransformNode(this.uiRoot);
              this.panel.updateLayout();
              if ( relocate ) {
                this.relocatePanel();
              } else {
                this.uiRoot.position = previous.pos;
                this.uiRoot.rotation = previous.rot;
              }
          });
      }).catch( err => console.log(err));
  }
  
  download(result) {
    if ( this.fetching || this.activeButton ) {
      return;
    }
    this.fetching = result;
    VRSPACEUI.indicator.animate();
    VRSPACEUI.indicator.add("Download");
    fetch("/sketchfab/download?uid="+result.uid)
      .then(response => {
          this.fetching = null;
          console.log(response);
          if ( response.status == 401 ) {
            console.log("Redirecting to login form")
            this.sketchfabLogin();
            return;
          }
          response.json().then(res => {
            console.log(res);
            this.createSharedObject(res.mesh);
          });
      }).catch( err => {
        this.fetching = null;
        console.log(err);
        VRSPACEUI.indicator.remove("Download");
      });
  }
  createSharedObject( mesh, properties ) {
    var object = {
      mesh: mesh,
      properties: {editing: this.worldManager.VRSPACE.me.id},
      position:{x:0, y:0, z:0},
      active:true
    };
    if ( properties ) {
      for ( var p in properties ) {
        object[p] = properties[p];
      }
    }
    this.worldManager.VRSPACE.createSharedObject(object, (obj)=>{
      console.log("Created new VRObject", obj);
    });
  }

  sketchfabLogin() {
    fetch("/sketchfab/login").then(response => {
        console.log(response);
        response.json().then(login => {
          window.open( login.url, "_self" );
        });
    });
  }
}
