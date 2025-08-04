import { VRSPACEUI } from '../vrspace-ui.js';
import { ScrollablePanel } from "./scrollable-panel.js";
import { Form } from '../widget/form.js';
import { World } from '../../world/world.js';
import { WorldListener } from '../../world/world-listener.js';
import { VRSpaceAPI } from '../../client/rest-api.js';
import { ModelSearchRequest } from '../../client/openapi/model/ModelSearchRequest.js';
import { VRObject } from '../../vrspace-min.js';

class SearchForm extends Form {
  constructor(callback) {
    super();
    this.callback = callback;
  }
  init() {
    this.createPanel();
    this.panel.addControl(this.textBlock("Search Sketchfab:"));

    this.input = this.inputText('search');
    //this.input.text = 'test'; // skip typing in VR
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
    this.speechInput.addNoMatch((phrases) => console.log('no match:', phrases));
    this.speechInput.start();
  }
}

/**
 * World editor can be constructed after the world has worldManager attached.
 * Allows for searching through 600,000+ free objects on sketchfab, adding them to the scene,
 * and manipulating own objects.
 * Works on PC, VR devices and mobiles, including mobile VR+gamepad. Or at least it's supposed to;)
 */
export class WorldEditor extends WorldListener {
  /**
   * @param {World} world mandatory world to edit
   * @param fileInput optional html file input component, required for load
   * @throws when world doesn't have WorldManager associated
   */
  constructor(world, fileInput) {
    super();
    if (!world.worldManager) {
      throw "World editor requires connection to the server - enter a world first";
    }
    /** @type {World} */
    this.world = world;
    this.scene = world.scene;
    this.autoCreateFileInput = true; 
    if (fileInput) {
      this.setFileInput(fileInput);
      this.autoCreateFileInput = false;
    }
    this.contentBase = VRSPACEUI.contentBase;
    this.worldManager = world.worldManager;
    this.buttons = [];
    this.makeUI();
    this.installClickHandler();
    this.createButtons();

    // add own selection predicate to the world
    this.selectionPredicate = (mesh) => this.isSelectableMesh(mesh);
    world.addSelectionPredicate(this.selectionPredicate);

    // add squeeze listener to take/drop an object
    this.squeeze = (side, value) => this.handleSqueeze(side, value);
    world.xrHelper.addSqueezeConsumer(this.squeeze);
   
    world.addListener(this);
  }

  /**
  Creates the search panel, called from constructor
  */
  makeUI() {
    this.searchPanel = new ScrollablePanel(this.scene, "SearchUI");
  }

  /**
  Creates HUD buttons, called from constructor
  */
  createButtons() {
    this.moveButton = this.makeAButton("Move", this.contentBase + "/content/icons/move.png", (o) => this.take(o.VRObject, o.position));
    this.moveButton.onPointerUpObservable.add(() => this.dropObject());
    //this.rotateButton = this.makeAButton( "Rotate", this.contentBase+"/content/icons/refresh.png", (o)=>this.rotateObject(o));  
    //this.scaleButton = this.makeAButton("Resize", this.contentBase+"/content/icons/resize.png", (o)=>this.resizeObject(o));
    this.gizmoButton = this.makeAButton("Rotate/Scale", this.contentBase + "/content/icons/rotate-resize.png", (o) => this.createGizmo(o));
    this.alignButton = this.makeAButton("Align", this.contentBase + "/content/icons/download.png", (o) => this.alignObject(o));
    this.alignButton = this.makeAButton("Upright", this.contentBase + "/content/icons/upload.png", (o) => this.upright(o));
    this.copyButton = this.makeAButton("Copy", this.contentBase + "/content/icons/copy.png", (o) => this.copyObject(o));
    this.deleteButton = this.makeAButton("Remove", this.contentBase + "/content/icons/delete.png", (o) => this.removeObject(o));
    this.searchButton = this.makeAButton("Search", this.contentBase + "/content/icons/zoom.png");
    this.saveButton = this.makeAButton("Save", this.contentBase + "/content/icons/save.png");
    this.loadButton = this.makeAButton("Load", this.contentBase + "/content/icons/open.png");

    this.searchButton.onPointerDownObservable.add(() => {
      this.searchPanel.relocatePanel();
      this.searchForm();
    });
    this.saveButton.onPointerDownObservable.add(() => { this.save() });
    this.loadButton.onPointerDownObservable.add(() => { this.load() });
    VRSPACEUI.hud.enableSpeech(true);
  }

  /**
   * Creates the search form, or destroys if it exists.
   * Search form has virtual keyboard attached if created in XR.
   */
  searchForm() {
    if (this.form) {
      this.clearForm();
    } else {
      VRSPACEUI.hud.newRow(); // stops speech recognition
      this.form = new SearchForm(() => this.doSearch());
      this.form.init(); // starts speech recognition
      if (VRSPACEUI.hud.inXR()) {
        let texture = VRSPACEUI.hud.addForm(this.form, 1536, 512);
        this.form.keyboard(texture);
      } else {
        VRSPACEUI.hud.addForm(this.form, 1536, 64);
      }
    }
  }
  /**
   * Disposes of search form and displays HUD buttons
   */
  clearForm() {
    if ( this.form ) {
      this.form.dispose(); // stops speech recognition
      delete this.form;
      VRSPACEUI.hud.clearRow(); // (re)starts speech recognition
      this.displayButtons(true);      
    }
  }

  doSearch(request= new ModelSearchRequest(), cursor, count=24) {
    if ( this.form ) {
      request.q = this.form.input.text;
      if (this.form.animated.isChecked) {
        request.animated = true;
      }
      if (this.form.rigged.isChecked) {
        request.rigged = true;
      }      
    }
    if (cursor) {
      request.cursor = cursor;
      request.count = count;
    } else {
      request.cursor = null;
      request.count = null;
    }
    VRSpaceAPI.getInstance().endpoint.sketchfab.searchModels(request).then(obj=>{
        this.searchPanel.beginUpdate(
          obj.previous != null,
          obj.next != null,
          // FIXME: next/previous
          () => this.doSearch(request, obj.cursors.previous),
          () => this.doSearch(request, obj.cursors.next)
        );
        obj.results.forEach(result => {
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
          result.thumbnails.images.forEach(img => {
            if (img.size > thumbnail.size) {
              thumbnail = img;
            }
          });
          //console.log(thumbnail);

          this.searchPanel.addButton(
            [result.name,
            'by ' + result.user.displayName,
            (result.archives.gltf.size / 1024 / 1024).toFixed(2) + "MB"
              //'Faces: '+result.faceCount,
              //'Vertices: '+result.vertexCount
            ],
            thumbnail.url,
            () => this.download(result)
          );

        });
        // ending workaround:
        this.searchPanel.endUpdate(true);
    }).catch(err=>console.error(err));
    
    this.clearForm();
  }

  /**
   * Creates a HUD button. Adds customAction field to the button, that is executed if a scene object is clicked on.
   * @param text button text
   * @param imageUrl image
   * @param action callback executed upon clicking on an object in the scene
   */
  makeAButton(text, imageUrl, action) {
    var button = VRSPACEUI.hud.addButton(text, imageUrl);
    button.onPointerDownObservable.add(() => {
      if (this.activeButton == button) {
        // already pressed, turn it off
        this.activeButton = null;
        this.displayButtons(true);
        this.clearGizmo();
      } else {
        this.displayButtons(false, button);
        this.activeButton = button;
      }
    });
    button.customAction = action;
    this.buttons.push(button);
    return button;
  }

  /**
   * WorldManager callback (WorldListener method), installed by constructor. 
   * Executed every time a shared object has loaded into the scene.
   * If it is own object, rescales it and calls this.takeObject().
   * This is what happens when selecting a sketchfab object to load.
   * @param {VRObject} vrObject that was loaded
   * @param {*} rootMesh Root mesh of the loaded object
   */
  loaded(vrObject, rootMesh) {
    console.log("WorldEditor loaded: " + vrObject.className + " " + vrObject.id + " " + vrObject.mesh);
    if (vrObject.properties && vrObject.properties.editing == this.worldManager.VRSPACE.me.id) {
      VRSPACEUI.indicator.remove("Download");
      console.log("Loaded my object " + vrObject.id)
      if (!vrObject.scale) {
        this.takeObject(vrObject);
        setTimeout(() => {
          var scale = 1 / this.worldManager.bBoxMax(rootMesh);
          //var scale = 1/this.worldManager.bBoxMax(this.worldManager.getRootNode(vrObject));
          this.worldManager.VRSPACE.sendEvent(vrObject, { scale: { x: scale, y: scale, z: scale } });
        }, 100);
      } else {
        this.takeObject(vrObject, new BABYLON.Vector3(vrObject.position.x, vrObject.position.y, vrObject.position.z));
      }
      // CHECKME: we can do it here
      //this.createGizmo(rootMesh);
    }
  }

  /**
   * WorldManager error callback, installed by constructor.
   */
  loadError(obj, exception) {
    // TODO VRObject still may exists, remove it
    // CHECKME maybe also mark this object as invalid
    VRSPACEUI.indicator.remove("Download");
  }

  createGizmo(obj) {
    this.clearGizmo();
    this.gizmo = new BABYLON.BoundingBoxGizmo();
    this.gizmo.attachedMesh = obj;
    this.gizmo.onScaleBoxDragEndObservable.add(() => {
      this.worldManager.VRSPACE.sendEvent(obj.VRObject, { scale: { x: obj.scaling.x, y: obj.scaling.y, z: obj.scaling.z } });
    });
    this.gizmo.onRotationSphereDragEndObservable.add(() => {
      if (obj.rotationQuaternion) {
        obj.rotation = obj.rotationQuaternion.toEulerAngles();
        obj.rotationQuaternion = null;
      }
      this.worldManager.VRSPACE.sendEvent(obj.VRObject, { rotation: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z } });
    });
  }
  clearGizmo() {
    if (this.gizmo) {
      this.gizmo.dispose();
      this.gizmo = null;
    }
  }
  /**
   * Called when an object is selected, calls the appropriate action e.g. take, resize etc
   * @param obj root scene object
   * @param action customAction of whatever button is currently active
   */
  manipulateObject(obj, action) {
    if (!action) {
      this.displayButtons(true);
      this.clearGizmo();
      return;
    }
    action(obj);
  }

  /**
   * Resize an object using pointer. Drag up or down to scale up or down, drag more to resize more.
   * @param obj a scene object to resize
   */
  resizeObject(obj) {
    this.createGizmo(obj);
    var point;
    var resizeHandler = this.scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type == BABYLON.PointerEventTypes.POINTERDOWN) {
        point = pointerInfo.pickInfo.pickedPoint;
      }
      if (pointerInfo.type == BABYLON.PointerEventTypes.POINTERUP) {
        this.scene.onPointerObservable.remove(resizeHandler);
        if (pointerInfo.pickInfo.hit && VRSPACEUI.findRootNode(pointerInfo.pickInfo.pickedMesh) == obj) {
          //var diff = pointerInfo.pickInfo.pickedPoint.y - point.y;
          var sign = Math.sign(pointerInfo.pickInfo.pickedPoint.y - point.y);
          var diff = pointerInfo.pickInfo.pickedPoint.subtract(point).length() * sign;
          var bbox = this.worldManager.bBoxMax(obj);
          console.log("bBoxMax:" + bbox + " diff:" + diff + " scaling:" + obj.scaling.y);
          //var scale = obj.scaling.y + diff;
          var scale = obj.scaling.y * (bbox + diff) / bbox;
          scale = Math.max(scale, obj.scaling.y * .2);
          scale = Math.min(scale, obj.scaling.y * 5);
          console.log("Scaling: " + obj.scaling.y + " to " + scale);
          this.worldManager.VRSPACE.sendEvent(obj.VRObject, { scale: { x: scale, y: scale, z: scale } });
        }
      }
    });
  }

  /**
   * Rotate an object using pointer. Drag left-right or up-down to rotate, drag more to rotate more.
   * @param obj scene object
   */
  rotateObject(obj) {
    this.createGizmo(obj);
    var point;
    var rotateHandler = this.scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type == BABYLON.PointerEventTypes.POINTERDOWN) {
        point = pointerInfo.pickInfo.pickedPoint;
      }
      if (pointerInfo.type == BABYLON.PointerEventTypes.POINTERUP) {
        this.scene.onPointerObservable.remove(rotateHandler);
        if (pointerInfo.pickInfo.hit && VRSPACEUI.findRootNode(pointerInfo.pickInfo.pickedMesh) == obj) {
          var dest = pointerInfo.pickInfo.pickedPoint;

          //var center = obj.position;
          var center = new BABYLON.Vector3(obj.position.x, (dest.y + point.y) / 2, obj.position.z);
          var vFrom = point.subtract(center).normalize();
          var vTo = dest.subtract(center).normalize();

          var rotationMatrix = new BABYLON.Matrix();
          BABYLON.Matrix.RotationAlignToRef(vFrom, vTo, rotationMatrix);
          var quat = BABYLON.Quaternion.FromRotationMatrix(rotationMatrix);
          var result = BABYLON.Quaternion.FromEulerVector(obj.rotation).multiply(quat).toEulerAngles();

          console.log(obj.rotation + "->" + result);

          // vertical pointer movement:
          var dy = dest.y - point.y;
          // horizontal pointer movement:
          var dxz = new BABYLON.Vector3(dest.x, 0, dest.z).subtract(new BABYLON.Vector3(point.x, 0, point.z)).length();
          if (Math.abs(dxz) > Math.abs(dy * 3)) {
            // mostly horizontal movement, rotation only around y
            console.log("Y rotation")
            this.worldManager.VRSPACE.sendEvent(obj.VRObject, { rotation: { x: obj.rotation.x, y: result.y, z: obj.rotation.z } });
          } else {
            // rotating around all axes
            this.worldManager.VRSPACE.sendEvent(obj.VRObject, { rotation: { x: result.x, y: result.y, z: result.z } });
          }
        }
      }
    });
  }

  /**
   * Align an object using pointer. Casts a ray down, and puts the object on whatever is below it.
   * @param obj selected scene object
   */
  alignObject(obj) {
    var pickInfo = this.pick(obj, new BABYLON.Vector3(0, -1, 0));
    var newPos = { x: obj.position.x, y: obj.position.y, z: obj.position.z };
    if (pickInfo.hit) {
      // there was something below
      newPos.y = obj.position.y - pickInfo.distance;
    } else {
      // nothing below, let's try to move up
      pickInfo = this.pick(obj, new BABYLON.Vector3(0, 1, 0));
      newPos.y = obj.position.y + pickInfo.distance;
    }
    if (pickInfo.hit) {
      this.worldManager.VRSPACE.sendEvent(obj.VRObject, { position: newPos });
      this.clearGizmo();
    }
  }

  /**
   * Casts a ray from the center of an object into given direction to hit another VRObject in the scene.
   * Used to stack (align) objects one on top of another.
   * @param obj object to cast a ray from
   * @param direction Vector3
   * @param length vector length, default 100
   * @returns PickingInfo
   */
  pick(obj, direction, length = 100) {
    // CHECKME: we may need to compute world matrix or something to make sure this works
    var bbox = obj.getHierarchyBoundingVectors();
    //var origin = obj.position;
    var origin = new BABYLON.Vector3((bbox.max.x - bbox.min.x) / 2, bbox.min.y, (bbox.max.z - bbox.min.z) / 2)
    var ray = new BABYLON.Ray(origin, direction, length);
    var pickInfo = this.scene.pickWithRay(ray, (mesh) => {
      var pickedRoot = VRSPACEUI.findRootNode(mesh);
      return pickedRoot != obj;
    });
    //console.log(pickInfo);
    return pickInfo;
  }

  /**
   * Puts an object into original up-down position.
   * @param obj a scene object
   */
  upright(obj) {
    this.clearGizmo();
    this.worldManager.VRSPACE.sendEvent(obj.VRObject, { rotation: { x: 0, y: obj.rotation.y, z: 0 } });
  }

  /**
   * Copy an object: sends a Add command to the server, actual copy (instance) is created when the server responds.
   * @param obj scene object to copy.
   */
  copyObject(obj) {
    var vrObject = obj.VRObject;
    console.log(vrObject);
    this.activeButton = null;
    this.displayButtons(true);
    this.createSharedObject(vrObject.mesh, { position: vrObject.position, rotation: vrObject.rotation, scale: vrObject.scale });
    this.clearGizmo();
  }

  /**
   * Delete a shared object from the scene.
   * @param obj scene object to delete
   */
  removeObject(obj) {
    //this.worldManager.VRSPACE.deleteSharedObject(obj.VRObject);
    VRSpaceAPI.getInstance().endpoint.objects.removeObject(obj.VRObject.className, obj.VRObject.id).then(obj => {
      console.log("Created new VRObject", obj);
    });
  }


  /**
   * Display or hide all buttons, except.
   * @param show true or false
   * @param except buttons to skip
   */
  displayButtons(show, ...except) {
    VRSPACEUI.hud.showButtons(show, ...except);
    if (show) {
      this.activeButton = null;
    }
  }

  /**
   * Called by constructor, installs onPointerObservable event handler to the scene,
   * executed when something is clicked on (BABYLON.PointerEventTypes.POINTERDOWN event).
   * The handler first determines root object, and fetches the attached VRObject,
   * then executes this.manipulateObject passing it this.activeButton.customAction.
   * Thus, routes the event to appropriate handler method.
   */
  installClickHandler() {
    this.clickHandler = this.scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.pickInfo.pickedMesh) {
        var pickedRoot = VRSPACEUI.findRootNode(pointerInfo.pickInfo.pickedMesh);
        switch (pointerInfo.type) {
          case BABYLON.PointerEventTypes.POINTERDOWN:
            if (this.activeButton) {
              //console.log("pickedMesh", pointerInfo.pickInfo.pickedMesh);
              //console.log("pickedRoot", pickedRoot);
              if (pickedRoot.VRObject && this.activeButton.isVisible) {
                // make an action on the object
                console.log("Manipulating shared object " + pickedRoot.VRObject.id + " " + pickedRoot.name);
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

  /**
   * Drop the object currently being carried, if any, and display all buttons.
   */
  dropObject() {
    if (this.carrying) {
      console.log("dropping");
      this.drop(this.carrying);
      this.carrying = null;
    }
  }

  /**
   * Activate this.moveButton and call take()
   * @param vrObject VRObject to take
   * @param position current object position
   */
  takeObject(vrObject, position) {
    this.activeButton = this.moveButton;
    this.displayButtons(false, this.moveButton);
    this.take(vrObject, position);
  }

  /** 
   * Take an object, if not already carrying one.
   * Creates an invisible object, and binds it to current camera, or a VR controller.
   * Invisible object is used to track the position, and actual object position is updated when the server responds.
   * Position of the object is published only after camera position has been published, through WorldManager.addMyChangeListener().
   * @param vrObject VRObject to take
   * @param position optional, current object position, default is 2 meters front of the camera
   */
  take(vrObject, position) {
    // FIXME: also check properties.editing to ensure only one user can carry an object
    if (vrObject.changeListener || this.carrying) {
      // already tracking
      return;
    }

    try {
      this.carrying = vrObject;
      this.editObject(vrObject, true);

      // default position
      if (!position) {
        var forwardDirection = VRSPACEUI.hud.camera.getForwardRay(2).direction;
        var forwardLower = forwardDirection.add(new BABYLON.Vector3(0, -.5, 0));
        position = VRSPACEUI.hud.camera.position.add(forwardLower);
        vrObject.position.x = position.x;
        vrObject.position.y = position.y;
        vrObject.position.z = position.z;
        this.sendPos(vrObject);
      }

      let parent = VRSPACEUI.hud.camera;

      /*
      // bad experience overall
      if (VRSPACEUI.hud.inXR()) {
        // if HUD is attached to a controller, we carry object in the other hand
        if (VRSPACEUI.hud.otherController()) {
          parent = VRSPACEUI.hud.otherController().pointer;
        } else if (VRSPACEUI.hud.attachedController()) {
          parent = VRSPACEUI.hud.attachedController().pointer;
        }
      }
      */
     
      if ( this.world.inXR() ) {
        let side = this.world.xrHelper.activeController;
        if ( "none" != side ) {
          parent = this.world.xrHelper.controller[side].pointer
        }
      }

      // create an object and bind it to camera to track the position
      var targetDirection = position.subtract(parent.position);
      var forwardDirection = VRSPACEUI.hud.camera.getForwardRay(targetDirection.length()).direction;

      var rotationMatrix = new BABYLON.Matrix();
      BABYLON.Matrix.RotationAlignToRef(forwardDirection.normalizeToNew(), targetDirection.normalizeToNew(), rotationMatrix);
      var quat = BABYLON.Quaternion.FromRotationMatrix(rotationMatrix);

      var pos = new BABYLON.Vector3(0, 0, targetDirection.length());
      pos.rotateByQuaternionToRef(quat, pos);

      var target = BABYLON.MeshBuilder.CreateBox("Position of " + vrObject.id, { size: .5 }, this.scene);
      target.parent = parent;
      target.isPickable = false;
      target.isVisible = false;
      target.position = pos;
      if (vrObject.rotation) {
        var rot = new BABYLON.Vector3(vrObject.rotation.x, vrObject.rotation.y, vrObject.rotation.z);
        var quat = BABYLON.Quaternion.FromEulerVector(rot);
        //if ( parent == VRSPACEUI.hud.camera ) {
        quat = BABYLON.Quaternion.Inverse(VRSPACEUI.hud.camera.absoluteRotation).multiply(quat);
        //} else {
        //quat = BABYLON.Quaternion.Inverse(parent.absoluteRotationQuaternion).multiply(quat);
        //}
        target.rotation = quat.toEulerAngles()
      }
      vrObject.target = target;

      vrObject.changeListener = () => this.sendPos(vrObject);
      this.worldManager.addMyChangeListener(vrObject.changeListener);
      console.log("took " + vrObject.id);

    } catch (err) {
      console.error(err.stack);
    }

  }

  /**
   * Send position of the object to the server. Executed by WorldManager after own changes have been published.
   * @param obj a VRObject to update
   */
  sendPos(obj) {
    var rot = VRSPACEUI.hud.camera.rotation;
    var pos = obj.position;
    if (obj.target) {
      // TODO this is not compatible with gizmo, calculate resulting rotation here
      pos = obj.target.absolutePosition;
      rot = obj.target.absoluteRotationQuaternion.toEulerAngles();
      console.log("Sending "+pos.x+","+pos.y+","+pos.z);
    }
    this.worldManager.VRSPACE.sendEvent(obj, { position: { x: pos.x, y: pos.y, z: pos.z }, rotation: { x: rot.x, y: rot.y, z: rot.z } });
  }

  /**
   * Drop the object. Cleans change listener, invisible object used track the position, and sends one final position to the server.
   * @param obj VRObject to drop
   */
  drop(obj) {
    console.log("Dropping " + obj.target);
    this.editObject(obj, false);

    this.scene.onPointerObservable.remove(obj.clickHandler);
    this.worldManager.removeMyChangeListener(obj.changeListener);
    delete obj.clickHandler;
    delete obj.changeListener;
    this.sendPos(obj);

    if (obj.target) {
      obj.target.parent = null;
      obj.target.dispose();
      obj.target = null;
    }
    console.log("dropped " + obj.id);
  }

  /**
   * Publishes beggining/end of object manipulation. Sets a transient property of the shared object, editing, to own id, or null.
   * @param obj VRObject
   * @param editing true/false
   */
  editObject(obj, editing) {
    if (editing) {
      if ( ! obj.properties ) {
        obj.properties = {};
      }
      obj.properties.editing = this.worldManager.VRSPACE.me.id;
      // FIXME: this needs to be published, so that only one user can manipulate the object at the same time 
    } else {
      obj.properties.editing = null;
      this.clearGizmo();
    }
    this.worldManager.VRSPACE.sendEvent(obj, { properties: obj.properties });
  }

  /**
   * Save current scene: dumps everything using AssetLoader.dump(), and calls VRSPACEUI.saveFile(). 
   */
  save() {
    this.displayButtons(true);
    const dump = VRSPACEUI.assetLoader.dump();
    if (Object.keys(dump).length > 0) {
      VRSPACEUI.saveFile(this.world.name + ".json", JSON.stringify(dump));
    }
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
        console.log(selectedFile);
        const reader = new FileReader();
        reader.onload = e => {
          var objects = JSON.parse(e.target.result);
          console.log(objects);
          this.publish(objects);
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
    this.displayButtons(true);
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
        this.worldManager.VRSPACE.createSharedObject(mesh).then(obj => {
          console.log("Created new VRObject", obj);
        });
      });
    }
  }

  /**
   * Search panel selection callback, download selected item.
   * Performs REST API call to VRSpace sketchfab endpoint. Should this call fail with 401 Unauthorized, 
   * executes this.sketchfabLogin(). Otherwise, VRSpace server downloads the model from sketchfab,
   * and returns the url, it's added to the scene by calling this.createSharedObject().
   * @param result search result object
   */
  download(result) {
    if (this.fetching || this.activeButton) {
      console.log("Skipping download, fetching="+this.fetching+" activeButton=",this.activeButton);
      return;
    }
    this.fetching = result;
    VRSPACEUI.indicator.animate();
    VRSPACEUI.indicator.add("Download");
    VRSpaceAPI.getInstance().endpoint.sketchfab.download(result.uid).then(gltfModel=>{
      this.fetching = null;
      console.log(gltfModel);
      this.createSharedObject(gltfModel.mesh);
    }).catch(error=>{
      if (error.status == 401) {
        console.log("Redirecting to login form")
        this.sketchfabLogin();
      } else {
        this.fetching = null;
        console.log(error);
        VRSPACEUI.indicator.remove("Download");
      }
    });
  }

  /**
   * Create a shared object, i.e. publish a mesh to the server. The object is marked with a transient property
   * editing set to current user id.
   * @param mesh the object to publish
   * @param properties optional properties
   */
  createSharedObject(mesh, properties) {
    var object = {
      mesh: mesh,
      properties: { editing: this.worldManager.VRSPACE.me.id },
      position: { x: 0, y: 0, z: 0 },
      active: true
    };
    if (properties) {
      for (var p in properties) {
        object[p] = properties[p];
      }
    }
    console.log("Creating new VRObject", object);
    VRSpaceAPI.getInstance().endpoint.objects.addObject(object).then(obj => {
      console.log("Created new VRObject", obj);
    });
    /* same as above, over websocket
    this.worldManager.VRSPACE.createSharedObject(object).then(obj => {
      console.log("Created new VRObject", obj);
    });
    */
  }

  /**
   * Rest API call to VRSpace sketchfab endpoint. If login is required, this opens the login page in the same browser window.
   */
  sketchfabLogin() {
    VRSpaceAPI.getInstance().endpoint.sketchfab.sketchfabLogin().then(login => {
      window.open(login.url, "_self");
    });
  }

  /**
   * Dispose of everything
   */
  dispose() {
    this.dropObject(); // just in case
    if (this.searchPanel) {
      this.searchPanel.dispose();
    }
    this.buttons.forEach((b) => b.dispose());
    this.world.removeSelectionPredicate(this.selectionPredicate);
    this.world.xrHelper.removeSqueezeConsumer(this.squeeze);
  }

  /**
   * XR selection support
   * @param mesh
   * @returns true if root node of the mesh has VRObject associated
   */
  isSelectableMesh(mesh) {
    return typeof (VRSPACEUI.findRootNode(mesh).VRObject) === 'object';
  }

  /**
   * Start manipulation (scaling,rotating) of currently carried object using XR controllers.
   * Marks current positions and rotations of controllers.
   * @param side left or right
   */
  startManipulation(side) {
    if (this.carrying) {
      this.startData = {
        left: this.world.xrHelper.leftArmPos().clone(),
        right: this.world.xrHelper.rightArmPos().clone(),
        scaling: this.carrying.scale.y,
        side: side,
        rotation: {
          left: this.world.xrHelper.leftArmRot().clone(),
          right: this.world.xrHelper.leftArmRot().clone()
        }
      }
    }
  }

  /**
   * End object manipulation: currently carried object is scaled and rotated depending on position and rotation XR controllers.
   * Sends scaling and rotation data to the server, actual change is performed once the server responds.
   */
  endManipulation() {
    try {
      if (this.carrying && this.startData) {
        //console.log('end manipulation '+this.carrying.id+" "+this.startData.left+' '+this.startData.right+' '+this.startData.scaling);
        //scaling
        let startDistance = this.startData.left.subtract(this.startData.right).length();
        let distance = this.world.xrHelper.leftArmPos().subtract(this.world.xrHelper.rightArmPos()).length();
        let scale = this.startData.scaling * distance / startDistance;
        //console.log("distance start "+startDistance+" end "+distance+" scale "+scale);
        // rotation
        let startQuat = this.startData.rotation[this.startData.side];
        let endQuat = this.world.xrHelper.armRot(this.startData.side);
        let diffQuat = endQuat.multiply(BABYLON.Quaternion.Inverse(startQuat));
        let curQuat = BABYLON.Quaternion.FromEulerAngles(this.carrying.rotation.x, this.carrying.rotation.y, this.carrying.rotation.z);
        let desiredQuat = curQuat.multiply(diffQuat);
        let rotation = desiredQuat.toEulerAngles();
        // send
        this.worldManager.VRSPACE.sendEvent(this.carrying,
          { scale: { x: scale, y: scale, z: scale }, rotation: { x: rotation.x, y: rotation.y, z: rotation.z } }
        );
        // carried object tracks hud, we have to update holder object rotation or next event just rotates it back
        let parentQuat = VRSPACEUI.hud.camera.absoluteRotation;
        if (this.carrying.target && this.carrying.target.parent !== VRSPACEUI.hud.camera) {
          //parentQuat = this.carrying.target.parent.absoluteRotationQuaternion;
        }
        let targetQuat = BABYLON.Quaternion.Inverse(parentQuat).multiply(desiredQuat);
        this.carrying.target.rotation = targetQuat.toEulerAngles();
        delete this.startData;
      }
    } catch (err) {
      console.error(err.stack)
    }
  }
  /**
   * Triggered on squeeze button pres/release. 
   * One squeeze pressed activates move button, like grabbing the object under the pointer. Release drops it.
   * Two squeeze buttons activate scaling and rotation. Spread more, scale more, closer is smaller.
   * @param value 0-1
   * @param side left or right
   */
  handleSqueeze(value, side) {
    try {
      this.clearGizmo();
      let bothOn = this.world.xrHelper.squeeze.left.value == 1 && this.world.xrHelper.squeeze.right.value == 1;
      let bothOff = this.world.xrHelper.squeeze.left.value == 0 && this.world.xrHelper.squeeze.right.value == 0;
      if (value == 1) {
        //console.log('squeeze '+side+' '+value+' both on '+bothOn+' off '+bothOff);
        if (bothOn) {
          this.displayButtons(true); // resets activeControl
          // hiding buttons makes it next to impossible to grab HUD - see intersects() in hud
          //this.displayButtons(false, this.scaleButton, this.rotateButton);
          this.displayButtons(false, this.gizmoButton);
          this.startManipulation(side);
        } else if (this.activeButton == null) {
          this.displayButtons(false, this.moveButton);
          this.activeButton = this.moveButton;
        }
        return false;
      } else if (value == 0) {
        this.displayButtons(true);
        if (bothOff) {
          this.dropObject();
          this.displayButtons(true);
        } else {
          this.endManipulation();
          this.displayButtons(false, this.moveButton);
          this.activeButton = this.moveButton;
        }
        return false;
      }
    } catch (error) {
      console.error(error.stack);
    }
    return true;
  }
}
