import { VRSPACEUI } from "./vrspace-ui.js";

/**
 * Text area somewhere in space, like a screen.
 * Provides methods for writing the text, movement, resizing.
 */
export class TextArea {
  /**
   * Creates the area with default values. 
   * By default, it's sized and positioned to be attached to the camera, is nicely transparent, font size 16 on 512x512 texture,
   * and includes manipulation handles
   */
  constructor(scene, name = "TextArea") {
    this.scene = scene;
    this.size = .2;
    this.position = new BABYLON.Vector3(-.08, 0, .3);
    this.alpha = 0.7;
    this.fontSize = 16;
    this.width = 512;
    this.height = 512;
    this.capacity = this.width*this.height/this.fontSize;
    this.textWrapping = true;
    this.addHandles = true;
    this.segments = 8;
    this.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.text = "";
    this.group = new BABYLON.TransformNode(name, this.scene);
    this.attachedToHud = false;
    this.attachedToCamera = false;
  }
  /**
   * As the name says. Optionally also creates manipulation handles.
   */
  show () {
    this.group.position = this.position;
    this.ratio = this.width/this.height;
    
    this.material = new BABYLON.StandardMaterial("TextAreaMaterial", this.scene);
    this.material.alpha = this.alpha;
    this.material.diffuseColor = new BABYLON.Color3(.2,.2,.3);
  
    this.selectedMaterial = new BABYLON.StandardMaterial("selectedMaterial", this.scene);
    this.selectedMaterial.alpha = this.alpha;
    this.selectedMaterial.diffuseColor = new BABYLON.Color3(.2,.5,.2);
  
    this.alertMaterial = new BABYLON.StandardMaterial("alertMaterial", this.scene);
    this.alertMaterial.alpha = this.alpha;
    this.alertMaterial.diffuseColor = new BABYLON.Color3(.3, 0, 0);
  
    this.textAreaPlane = BABYLON.MeshBuilder.CreatePlane("TextAreaPlane", {width:this.size*this.ratio,height:this.size}, this.scene);
    this.textAreaPlane.parent = this.group;
  
    this.backgroundPlane = BABYLON.MeshBuilder.CreatePlane("BackgroundPlane", {width:this.size*this.ratio*1.05,height:this.size*1.05}, this.scene);
    this.backgroundPlane.position = new BABYLON.Vector3(0, 0, this.size/100);
    this.backgroundPlane.parent = this.group;
    this.backgroundPlane.material = this.material;
  
    if (this.addHandles) {
      this.createHandles();
    }
    
    this.texture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(
      this.textAreaPlane,
      this.width,
      this.height,
      false // do not handle pointer events
    );
  
    this.textBlock = new BABYLON.GUI.TextBlock();
    this.textBlock.widthInPixels = this.width;
    this.textBlock.textWrapping = this.textWrapping;
    this.textBlock.color = "white";
    this.textBlock.fontSize = this.fontSize;
    this.textBlock.fontFamily = "monospace";
    this.textBlock.textHorizontalAlignment = this.textHorizontalAlignment;
    this.textBlock.textVerticalAlignment = this.textVerticalAlignment;

    this.textBlock.text = "text is required to compute fontOffset used for font rendering";
    this.textBlock.computeExpectedHeight(); // and now we have textBlock.fontOffset
    this.textBlock.text = this.text;
    
    this.texture.addControl(this.textBlock);
  }
  /**
   * Creates manipulation handles. Left and right handle resize, and top and bottom move it.
   */
  createHandles() {
    this.leftHandle = BABYLON.MeshBuilder.CreateSphere("leftHandle",{segments:this.segments},this.scene);
    this.leftHandle.scaling = new BABYLON.Vector3(this.size/50,this.size,this.size/50);
    this.leftHandle.position = new BABYLON.Vector3(-this.size*this.ratio/2-this.size*this.ratio/20, 0, 0);
    this.leftHandle.parent = this.group;
    this.leftHandle.material = this.material;
  
    this.rightHandle = BABYLON.MeshBuilder.CreateSphere("rightHandle",{segments:this.segments},this.scene);
    this.rightHandle.scaling = new BABYLON.Vector3(this.size/50,this.size,this.size/50);
    this.rightHandle.position = new BABYLON.Vector3(this.size*this.ratio/2+this.size*this.ratio/20, 0, 0);
    this.rightHandle.parent = this.group;
    this.rightHandle.material = this.material;
  
    this.topHandle = BABYLON.MeshBuilder.CreateSphere("topHandle",{segments:this.segments},this.scene);
    this.topHandle.scaling = new BABYLON.Vector3(this.size*this.ratio,this.size/50,this.size/50);
    this.topHandle.position = new BABYLON.Vector3(0, this.size/2+this.size/20, 0);
    this.topHandle.parent = this.group;
    this.topHandle.material = this.material;
  
    this.bottomHandle = BABYLON.MeshBuilder.CreateSphere("bottomHandle",{segments:this.segments},this.scene);
    this.bottomHandle.scaling = new BABYLON.Vector3(this.size*this.ratio,this.size/50,this.size/50);
    this.bottomHandle.position = new BABYLON.Vector3(0, -this.size/2-this.size/20, 0);
    this.bottomHandle.parent = this.group;
    this.bottomHandle.material = this.material;
  
    this.bottomHandle.opposite = this.topHandle;
    this.topHandle.opposite = this.bottomHandle;
    this.leftHandle.opposite = this.rightHandle;
    this.rightHandle.opposite = this.leftHandle;
  
    this.handles = [ this.leftHandle, this.topHandle, this.rightHandle, this.bottomHandle ];

    this.resizeHandler = this.scene.onPointerObservable.add((pointerInfo) => {
      if ( pointerInfo.type == BABYLON.PointerEventTypes.POINTERDOWN ) {
        //if ( pointerInfo.pickInfo.hit && this.handles.includes(pointerInfo.pickInfo.pickedMesh) ) {
        if ( pointerInfo.pickInfo.hit ) {
          // moving around
          if (pointerInfo.pickInfo.pickedMesh == this.bottomHandle || pointerInfo.pickInfo.pickedMesh == this.topHandle) {
            if ( ! this.behavior ) {
              this.behavior = new BABYLON.SixDofDragBehavior()
              this.group.addBehavior(this.behavior);
              pointerInfo.pickInfo.pickedMesh.material = this.selectedMaterial;
              this.selectedHandle = pointerInfo.pickInfo.pickedMesh;
            }
          } else if (pointerInfo.pickInfo.pickedMesh == this.leftHandle || pointerInfo.pickInfo.pickedMesh == this.rightHandle) {
            // scaling
            if ( ! this.selectedHandle ) {
              this.selectedHandle = pointerInfo.pickInfo.pickedMesh;
              this.point = pointerInfo.pickInfo.pickedPoint;
              pointerInfo.pickInfo.pickedMesh.material = this.selectedMaterial;
            }
          }
        } else if ( this.selectedHandle) {
          this.selectedHandle.material = this.material;
          this.selectedHandle = null;
          if ( this.behavior ) {
            this.group.removeBehavior(this.behavior);
            this.behavior = null;
          }
        }
      }
      if ( pointerInfo.type == BABYLON.PointerEventTypes.POINTERUP && this.selectedHandle) {
        if ( pointerInfo.pickInfo.hit && (pointerInfo.pickInfo.pickedMesh == this.leftHandle || pointerInfo.pickInfo.pickedMesh == this.rightHandle) ) {
          let diff = pointerInfo.pickInfo.pickedPoint.y - this.point.y;
          let scale = (this.size + diff)/this.size;
          this.group.scaling = this.group.scaling.scale(scale);
        }
        if ( this.selectedHandle) {
          this.selectedHandle.material = this.material;
          this.selectedHandle = null;
          if ( this.behavior ) {
            this.group.removeBehavior(this.behavior);
            this.behavior = null;
          }
        }
      }
    });
    
  }
  /**
   * Removes manipulation handles.
   */
  removeHandles() {
    if ( this.handles ) {
      this.scene.onPointerObservable.remove(this.resizeHandler);
      this.handles.forEach(h=>h.dispose());
      this.handles = null;
    }
  }
  /** Clean up. */
  dispose() {
    this.removeHandles();
    this.textAreaPlane.dispose();
    this.backgroundPlane.dispose();
    this.textBlock.dispose();
    this.texture.dispose();
    this.material.dispose();
    this.selectedMaterial.dispose();
    this.alertMaterial.dispose();
  }
  /**
   * Attach it to the hud. It does not resize automatically, just sets the parent.
   */
  attachToHud() {
    this.group.parent = VRSPACEUI.hud.root;
    this.attachedToCamera = false;
    this.attachedToHud = true;
    VRSPACEUI.hud.addAttachment(this.textAreaPlane);
    VRSPACEUI.hud.addAttachment(this.backgroundPlane);
    if ( this.handles ) {
      this.handles.forEach( h => VRSPACEUI.hud.addAttachment(h));
    }
  }
  /**
   * Attach it to the camera. It does not resize automatically, just sets the parent.
   * It does not automatically switch to another camera if active camera changes.
   * @param camera currently active camera
   */
  attachToCamera(camera = this.scene.activeCamera) {
    this.group.parent = camera;
    this.attachedToCamera = true;
    this.attachedToHud = false;
    VRSPACEUI.hud.removeAttachment(this.textAreaPlane);
    VRSPACEUI.hud.removeAttachment(this.backgroundPlane);
    if ( this.handles ) {
      this.handles.forEach( h => VRSPACEUI.hud.addAttachment(h));
    }
  }
  /**
   * Detach from whatever attached to, i.e. drop it where you stand.
   */
  detach() {
    this.group.parent = null;
    this.attachedToCamera = false;
    this.attachedToHud = false;
    VRSPACEUI.hud.removeAttachment(this.textAreaPlane);
    VRSPACEUI.hud.removeAttachment(this.backgroundPlane);
    if ( this.handles ) {
      this.handles.forEach( h => VRSPACEUI.hud.addAttachment(h));
    }
  }
  /**
   * Check if current text length exceeds the capacity and truncate as required.
   */
  checkCapacity() {
    if ( this.capacity < this.text.length ) {
      this.text = this.text.substring(this.text.length-this.capacity);
    }
  }
  /** Same as write */
  print(string) {
    this.write(string);
  }
  /** Write a string */
  write(string) {
    this.text += string;
    this.checkCapacity();
    this.textBlock.text = this.text;
  }
  /** Same as writeln */
  println(string){
    this.writeln(string);
  }
  /** Print a string into a new line */
  writeln(string) {
    this.write("\n"+string);
  }
  /** Remove the text */
  clear() {
    this.text = "";
    this.textBlock.text = this.text;
  }
  /** Calculates and returns maximum text rows available */
  getMaxRows() {
    return Math.floor(this.height/(this.textBlock.fontOffset.height));
  }
  /** Calculates and returns maximum number text columns available */
  getMaxCols() {
    // font offset on android is not integer
    return Math.floor(this.height*this.ratio/(Math.ceil(this.textBlock.fontOffset.height)/2));
  }
  /**
   * Set click event handler here
   * @param callback executed on pointer click, passed Control argument
   */
  onClick(callback) {
    this.texture.onControlPickedObservable.add(callback);   
  }
  /**
   * XR pointer support
   */
  isSelectableMesh(mesh) {
    return mesh == this.textAreaPlane || (this.handles && this.handles.includes(mesh)); 
  }
}