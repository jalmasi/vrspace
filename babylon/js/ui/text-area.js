import { VRSPACEUI } from "./vrspace-ui.js";

export class TextArea {
  constructor(scene) {
    this.scene = scene;
    this.size = .2;
    this.position = new BABYLON.Vector3(-.08, 0, .3);
    this.alpha = 0.7;
    this.maxRows = 27;
    this.maxCols = 58;
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
    this.group = new BABYLON.TransformNode("TextArea", this.scene);
  }
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
  removeHandles() {
    if ( this.handles ) {
      this.scene.onPointerObservable.remove(this.resizeHandler);
      this.handles.forEach(h=>h.dispose());
      this.handles = null;
    }
  }
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
  attachToHud(hud = VRSPACEUI.hud) {
    this.group.parent = hud.root;
  }
  attachToCamera(camera = this.scene.activeCamera) {
    this.group.parent = camera;
  }
  detach() {
    this.group.parent = null;
  }
  checkCapacity() {
    if ( this.capacity < this.text.length ) {
      this.text = this.text.substring(this.text.length-this.capacity);
    }
  }
  print(string) {
    this.write(string);
  }
  write(string) {
    this.text += string;
    this.checkCapacity();
    this.textBlock.text = this.text;
  }
  println(string){
    this.writeln(string);
  }
  writeln(string) {
    this.write("\n"+string);
  }
  clear() {
    this.text = "";
    this.textBlock.text = this.text;
  }
  getMaxRows() {
    return Math.floor(this.height/(this.textBlock.fontOffset.height));
  }
  getMaxCols() {
    // font offset on android is not integer
    return Math.floor(this.height*this.ratio/(Math.ceil(this.textBlock.fontOffset.height)/2));
  }
  onClick(callback) {
    this.texture.onControlPickedObservable.add(callback);   
  }
}