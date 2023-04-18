import {VRSPACEUI} from './vrspace-ui.js';
import {ScrollablePanel} from "./scrollable-panel.js";
import {Form} from './form.js';

class SearchForm extends Form {
  constructor(callback) {
    super();
    this.callback = callback;
    this.verticalPanel = false;
  }
  init() {
    this.panel = new BABYLON.GUI.StackPanel();
    this.panel.isVertical = this.verticalPanel;
    this.panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.panel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    this.panel.width = 1;
    this.panel.height = 1;

    this.panel.addControl(this.textBlock("Search Sketchfab:"));    

    this.input = this.inputText('search');
    this.panel.addControl(this.input);

    var text2 = this.textBlock("Animated:");
    text2.paddingLeft = "10px";
    this.panel.addControl(text2);

    this.animated = this.checkbox("animated");
    this.panel.addControl(this.animated);

    var text3 = this.textBlock("Rigged:");
    text3.paddingLeft = "10px";
    this.panel.addControl(text3);
    
    this.rigged = this.checkbox("rigged");
    this.panel.addControl(this.rigged);

    var enter = this.submitButton("submit", () => this.callback(this.input.text));
    this.panel.addControl(enter);
    
    //input.focus(); // not available in babylon 4
    this.speechInput.addNoMatch((phrases)=>console.log('no match:',phrases));
    this.speechInput.start();
  }
  dispose() {
    super.dispose();
    this.panel.dispose();
    delete this.input;
    delete this.animated;
    delete this.rigged;
    delete this.panel;
    delete this.speechInput;
  }
}

export class WorldEditor {
  constructor( world, fileInput ) {
    console.log(world);
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
    this.buttons=[];
    this.makeUI();
    this.installClickHandler();
    this.createButtons();
    this.worldManager.loadCallback = (object, rootMesh) => this.objectLoaded(object, rootMesh);
    this.worldManager.loadErrorHandler= (object, exception) => this.loadingFailed(object, exception);
    
    this.worldPickPredicate = world.isSelectableMesh;
    // override world method to make every VRObject selectable
    world.isSelectableMesh = (mesh) => {
      return this.worldPickPredicate(mesh) || this.isSelectableMesh(mesh);
    }
    
  }
  
  makeUI() {
    this.searchPanel = new ScrollablePanel(this.scene, "SearchUI");
  }
  
  createButtons() {
    this.moveButton = this.makeAButton( "Move", this.contentBase+"/content/icons/move.png", (o)=>this.take(o.VRObject, o.position));
    this.moveButton.onPointerUpObservable.add(()=>this.dropObject());
    this.rotateButton = this.makeAButton( "Rotate", this.contentBase+"/content/icons/refresh.png", (o)=>this.rotateObject(o));  
    this.scaleButton = this.makeAButton("Resize", this.contentBase+"/content/icons/resize.png", (o)=>this.resizeObject(o));
    this.alignButton = this.makeAButton("Align", this.contentBase+"/content/icons/download.png", (o)=>this.alignObject(o));
    this.alignButton = this.makeAButton("Upright", this.contentBase+"/content/icons/upload.png", (o)=>this.upright(o));
    this.copyButton = this.makeAButton("Copy", this.contentBase+"/content/icons/copy.png", (o)=>this.copyObject(o));
    this.deleteButton = this.makeAButton("Remove", this.contentBase+"/content/icons/delete.png", (o)=>this.removeObject(o));
    this.searchButton = this.makeAButton("Search", this.contentBase+"/content/icons/zoom.png");
    this.saveButton = this.makeAButton("Save", this.contentBase+"/content/icons/save.png");
    this.loadButton = this.makeAButton("Load", this.contentBase+"/content/icons/open.png");
    
    this.searchButton.onPointerDownObservable.add( () => {
      this.searchPanel.relocatePanel();
      this.searchForm();
    });
    this.saveButton.onPointerDownObservable.add( () => {this.save()});
    this.loadButton.onPointerDownObservable.add( () => {this.load()});
    VRSPACEUI.hud.enableSpeech(true);
  }

  searchForm() {
    if ( this.form ) {
      this.clearForm();
    } else {
      VRSPACEUI.hud.newRow(); // stops speech recognition
      this.form = new SearchForm((text)=>this.doSearch(text));
      this.form.init(); // starts speech recognition
      if ( VRSPACEUI.hud.inXR() ) {
        let texture = VRSPACEUI.hud.addForm(this.form,1536,512);
        this.form.keyboard(texture);
      } else {
        VRSPACEUI.hud.addForm(this.form,1536,64);
      }
    }
  }
  clearForm() {
    this.form.dispose(); // stops speech recognition
    delete this.form;
    VRSPACEUI.hud.clearRow(); // (re)starts speech recognition
    this.displayButtons(true);
  }
  doSearch(text) {
    if ( text ) {
      var args = {};
      if (this.form.animated.isChecked) {
        args.animated = true;
      }
      if (this.form.rigged.isChecked) {
        args.rigged = true;
      }
      this.search(text, args);
    }
    this.clearForm();
  }
  
  makeAButton(text, imageUrl, action) {
    var button = VRSPACEUI.hud.addButton(text,imageUrl);
    button.onPointerDownObservable.add( () => {
      if ( this.activeButton == button ) {
        // already pressed, turn it off
        this.activeButton = null;
        this.displayButtons(true);
      } else {
        this.displayButtons(false, button);
        this.activeButton = button;
      }
    });
    button.customAction = action;
    this.buttons.push(button);
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
    // TODO: do this elsewhere
    /*
    this.world.vrHelper.trackThumbsticks((pos, side)=>{
      console.log(side+' thumbstick  x='+pos.x+' y='+pos.y+' squeeze '+this.world.vrHelper.squeeze[side].pressed);
    });
    */
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
    var pickInfo = this.pick(obj, new BABYLON.Vector3(0,-1,0));
    var newPos = { x:obj.position.x, y:obj.position.y, z:obj.position.z };
    if ( pickInfo.hit ) {
      // there was something below
      newPos.y = obj.position.y - pickInfo.distance;
    } else {
      // nothing below, let's try to move up
      pickInfo = this.pick(obj, new BABYLON.Vector3(0,1,0));      
      newPos.y = obj.position.y + pickInfo.distance;
    }
    if ( pickInfo.hit ) {
      this.worldManager.VRSPACE.sendEvent(obj.VRObject, {position: newPos} );
    }
  }

  pick( obj, direction ) {
    // CHECKME: we may need to compute world matrix or something to make sure this works
    var bbox = obj.getHierarchyBoundingVectors();
    //var origin = obj.position;
    var origin = new BABYLON.Vector3((bbox.max.x-bbox.min.x)/2, bbox.min.y, (bbox.max.z-bbox.min.z)/2)
    var length = 100;
    var ray = new BABYLON.Ray(origin, direction, length);
    var pickInfo = this.scene.pickWithRay(ray, (mesh) => {
      var pickedRoot = VRSPACEUI.findRootNode(mesh);
      return pickedRoot != obj;
    });
    //console.log(pickInfo);
    return pickInfo;
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
  
  displayButtons(show, except) {
    VRSPACEUI.hud.showButtons(show, except);
    if ( show ) {
      this.activeButton = null;
    }
  }
  
  installClickHandler() {
    this.clickHandler = this.scene.onPointerObservable.add((pointerInfo) => {
      if ( pointerInfo.pickInfo.pickedMesh ) {
        var pickedRoot = VRSPACEUI.findRootNode(pointerInfo.pickInfo.pickedMesh);
        switch (pointerInfo.type) {
          case BABYLON.PointerEventTypes.POINTERDOWN:
            if ( this.activeButton ) {
              //console.log("pickedMesh", pointerInfo.pickInfo.pickedMesh);
              //console.log("pickedRoot", pickedRoot);
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
    //if ( ! this.activeButton && this.carrying ) {
    if ( this.carrying ) {
      console.log("dropping");
      this.drop(this.carrying);
      this.carrying = null;
    }
  }
  
  takeObject(vrObject, position) {
    this.activeButton = this.moveButton;
    this.displayButtons(false, this.moveButton);
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
    if ( VRSPACEUI.hud.inXR() ) {
      if (VRSPACEUI.hud.otherController()) {
        target.parent = VRSPACEUI.hud.otherController().pointer;
      } else if (VRSPACEUI.hud.attachedController()) {
        target.parent = VRSPACEUI.hud.attachedController().pointer;
      } else {
        target.parent = VRSPACEUI.hud.camera;
      }
    } else {
      target.parent = VRSPACEUI.hud.camera;
    }
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
    // FIXME: fails for objects not created with world editor with
    // Uncaught TypeError: Cannot set properties of null (setting 'editing')
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
              this.searchPanel.beginUpdate(
                obj.previous != null, 
                obj.next != null, 
                () => this.doFetch(obj.previous),
                () => this.doFetch(obj.next)
              );
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
                  
                  this.searchPanel.addButton(
                    [ result.name, 
                      'by '+result.user.displayName,
                      (result.archives.gltf.size/1024/1024).toFixed(2)+"MB"
                      //'Faces: '+result.faceCount,
                      //'Vertices: '+result.vertexCount
                    ],
                    thumbnail.url,
                    () => this.download(result)
                  );
                  
              });
              // ending workaround:
              this.searchPanel.endUpdate(relocate);
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
  
  dispose() {
    this.dropObject(); // just in case
    this.searchPanel.dispose();
    this.buttons.forEach((b)=>b.dispose());
    this.world.isSelectableMesh = this.worldPickPredicate;    
  }
  
  // XR selection support
  isSelectableMesh(mesh) {
    return VRSPACEUI.hud.isSelectableMesh(mesh) || VRSPACEUI.findRootNode(mesh).VRObject;
  }
}
