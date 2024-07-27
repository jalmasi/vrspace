import { Label } from './label.js';
import { ManipulationHandles } from "./manipulation-handles.js";
import { VRSPACEUI } from "../vrspace-ui.js";
import { BaseArea } from './base-area.js';
/**
 * Text area somewhere in space, like a screen.
 * Provides methods for writing the text, movement, resizing.
 */
export class TextArea extends BaseArea {
  /**
   * Creates the area with default values. 
   * By default, it's sized and positioned to be attached to the camera, is nicely transparent, font size 16 on 512x512 texture,
   * and includes manipulation handles.
   * @param scene babylon scene, mandatory
   * @param name optional, defaults to TextArea
   * @param titleText optional title to display above the area 
   */
  constructor(scene, name = "TextArea", titleText = null) {
    super(scene,name);
    this.titleText = titleText;
    this.position = new BABYLON.Vector3(-.08, 0, .5);
    this.alpha = 0.7;
    this.fontSize = 16;
    this.width = 512;
    this.height = 512;
    this.capacity = this.width*this.height/this.fontSize;
    this.textWrapping = true;
    this.addBackground = true;
    this.autoScale = false; // experimental, unstable
    this.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.text = "";
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

    this.areaPlane = BABYLON.MeshBuilder.CreatePlane("TextAreaPlane", {width:this.size*this.ratio,height:this.size}, this.scene);
    this.areaPlane.parent = this.group;

    if ( this.addBackground ) {
      this.material = new BABYLON.StandardMaterial("TextAreaMaterial", this.scene);
      this.material.alpha = this.alpha;
      this.material.diffuseColor = new BABYLON.Color3(.2,.2,.3);
    
      this.backgroundPlane = BABYLON.MeshBuilder.CreatePlane("BackgroundPlane", {width:this.size*this.ratio*1.05,height:this.size*1.05}, this.scene);
      this.backgroundPlane.position = new BABYLON.Vector3(0, 0, this.size/100);
      this.backgroundPlane.parent = this.group;
      this.backgroundPlane.material = this.material;
    }
  
    if (this.addHandles) {
      this.createHandles();
    }
    
    this.texture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(
      this.areaPlane,
      this.width,
      this.height,
      false // do not handle pointer events
    );
    this.areaPlane.material.transparencyMode = BABYLON.Material.MATERIAL_ALPHATEST;
  
    this.texture.addControl(this.textBlock);
    
    this.showTitle();
  }
  /**
   * Show title text on top of the area. Title can be changed and displayed any time after show().
   */
  showTitle() {
    if (this.titleText) {
      let titleHeight = this.size / this.getMaxRows() * 2; // twice as high as a text row
      if ( this.title ) {
        this.title.dispose();
      }
      this.title = new Label(this.title, new BABYLON.Vector3(0, 1.2 * this.size/2 + titleHeight/2, 0), this.group);
      this.title.text = this.titleText;
      this.title.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
      this.title.height = titleHeight;
      this.title.display();
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
    super.dispose();
    this.removeTitle();
    if ( this.backgroundPlane ) {
      this.backgroundPlane.dispose();
    }
    if ( this.texture ) {
      this.textBlock.dispose();
      this.texture.dispose();
    }
  }
  
  /** Attach both textPlane and backgroundPlane to the HUD, and optionally also handles. */
  attachToHud() {
    super.attachToHud();
    VRSPACEUI.hud.addAttachment(this.backgroundPlane);
  }
  
  /**
   * Attach it to the camera. It does not resize automatically, just sets the parent.
   * It does not automatically switch to another camera if active camera changes.
   * @param camera currently active camera
   */
  attachToCamera(camera = this.scene.activeCamera) {
    super.attachToCamera(camera);
    VRSPACEUI.hud.removeAttachment(this.backgroundPlane);
  }
  /**
   * Detach from whatever attached to, i.e. drop it where you stand.
   */
  detach() {
    super.detach();
    VRSPACEUI.hud.removeAttachment(this.backgroundPlane);
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
  writeln(string="") {
    this.write("\n"+string);
  }
  /** Print a number of lines */
  writeArray(text) {
    text.forEach( line => this.writeln(line));
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
}