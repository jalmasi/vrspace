import { Label } from './label.js';
import { ManipulationHandles } from "./manipulation-handles.js";
import { VRSPACEUI } from "./vrspace-ui.js";

/**
 * Text area somewhere in space, like a screen.
 * Provides methods for writing the text, movement, resizing.
 */
export class TextArea {
  /**
   * Creates the area with default values. 
   * By default, it's sized and positioned to be attached to the camera, is nicely transparent, font size 16 on 512x512 texture,
   * and includes manipulation handles.
   * @param scene babylon scene, mandatory
   * @param name optional, defaults to TextArea
   * @param titleText optional title to display above the area 
   */
  constructor(scene, name = "TextArea", titleText = null) {
    this.titleText = titleText;
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
    this.canMinimize = true;
    this.autoScale = false;
    this.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.text = "";
    this.group = new BABYLON.TransformNode(name, this.scene);
    this.attachedToHud = false;
    this.attachedToCamera = false;
    this.title = null;
  }
  /**
   * As the name says. Optionally also creates manipulation handles.
   */
  show () {
    this.group.position = this.position;
    
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

    if ( this.autoScale ) {
      if ( ! this.text ) {
        //throw new Error( "Text has to be set before autoscaling");
        return;
      }
      // so we scale height depending on text size and width
      // i.e. add as many rows as we need
      let rowsNeeded = Math.ceil(this.text.length * this.textBlock.fontOffset.height / this.width);
      this.height = rowsNeeded * this.textBlock.fontOffset.height;
      this.size = rowsNeeded * this.size;
    }
    this.ratio = this.width/this.height;
    
    this.material = new BABYLON.StandardMaterial("TextAreaMaterial", this.scene);
    this.material.alpha = this.alpha;
    this.material.diffuseColor = new BABYLON.Color3(.2,.2,.3);
  
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
  
    this.texture.addControl(this.textBlock);
    
    this.showTitle();
  }
  /**
   * Show title text on top of the area. Title can be changed and displayed any time after show().
   */
  showTitle() {
    if (this.titleText) {
      // defaults if we're displaying the title before any text was displayed
      let titleHeight = this.size;
      if ( this.texture ) {
        // texture exists, so reposition title above the text
        titleHeight = this.size / this.getMaxRows() * 2; // twice as high as a text row
      }
      let verticalOffset = 1.2 * this.size/2 + titleHeight/2;
      if ( ! this.title ) {
        this.title = new Label("avatar-title", new BABYLON.Vector3(0, verticalOffset, 0), this.group);
        if ( this.titleText.length < 32 ) {
          // ensure some minimal capacity for successive calls
          // TODO take a text argument to this method instead?
          this.title.text = ' '.repeat(32);
        }
        this.title.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        this.title.height = titleHeight;
        this.title.display();
      } else {
        this.title.setText(this.titleText);
      }
    } else if ( this.title ) {
      this.title.dispose();
      this.title = null;
    }
  }
  /**
   * Remove the title, if any.
   */
  removeTitle() {
    if ( this.title ) {
      this.title.dispose();
      this.title = null;
    }
  }
  /**
   * Creates manipulation handles. Left and right handle resize, and top and bottom move it.
   */
  createHandles() {
    this.handles = new ManipulationHandles(this.backgroundPlane, this.size*this.ratio, this.size, this.scene);
    this.handles.canMinimize = this.canMinimize;
    this.handles.show();
  }
  /**
   * Removes manipulation handles.
   */
  removeHandles() {
    if ( this.handles ) {
      this.handles.dispose();
      this.handles = null;
    }
  }
  /**
   * Hide/show (requires manipulation handles)
   * @param flag boolean, hide/show
   */
  hide(flag) {
    if ( this.handles ) {
      this.handles.hide(flag);
    }
  }
  /** Clean up. */
  dispose() {
    this.removeTitle();
    this.removeHandles();
    this.textBlock.dispose();
    if ( this.texture ) {
      this.textAreaPlane.dispose();
      this.backgroundPlane.dispose();
      this.texture.dispose();
      this.material.dispose();
    }
    this.group.dispose();
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
      this.handles.handles.forEach( h => VRSPACEUI.hud.addAttachment(h));
      VRSPACEUI.hud.addAttachment(this.handles.box);
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
      this.handles.handles.forEach( h => VRSPACEUI.hud.addAttachment(h));
      VRSPACEUI.hud.addAttachment(this.handles.box);
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
      this.handles.handles.forEach( h => VRSPACEUI.hud.removeAttachment(h));
      VRSPACEUI.hud.removeAttachment(this.handles.box);
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
    return mesh == this.textAreaPlane || (this.handles && this.handles.handles.includes(mesh)); 
  }
}