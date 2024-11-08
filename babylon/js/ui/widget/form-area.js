import { BaseArea } from './base-area.js';
import { Form } from './form.js';
import { ManipulationHandles } from "./manipulation-handles.js";

/**
 * Place a Form on a plane, anywhere in space or attach it to HUD, with or without manipulation handles.
 */
export class FormArea extends BaseArea {
  /**
   * Create the area. The form must be fully prepared and initialized.
   * 
   * @param {BABYLON.Scene} scene 
   * @param {Form} form 
   * @param {string} [name="FormArea"] 
   */
  constructor(scene, form, name = "FormArea") {
    super(scene, name);
    this.form = form;
    this.alpha = 0.7;
    this.color = new BABYLON.Color4(.2,.2,.3, this.alpha);
    this.size = .2;
    this.position = new BABYLON.Vector3(-.08, 0, .5);
    this.addHandles = true;
    this.addBackground = true;
    this.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
  }

  /**
   * Show the form. Texture with and height must be known up front, since Form can't figure it out - yet.
   */
  show(textureWidth, textureHeight) {
    this.ratio = textureWidth/textureHeight;
    this.group.position = this.position;

    this.form.createPlane(this.size, textureWidth, textureHeight);
    this.form.plane.parent = this.group;

    if ( this.addBackground ) {
      this.form.texture.background = this.color.toHexString();    
    }
    
    if (this.addHandles) {
      this.createHandles();
    }
    
  }

  /**
   * Creates manipulation handles. Left and right handle resize, and top and bottom move it.
   */
  createHandles() {
    this.material = new BABYLON.StandardMaterial("TextAreaMaterial", this.scene);
    this.material.alpha = this.alpha;
    this.material.diffuseColor = this.color;

    this.handles = new ManipulationHandles(this.form.plane, this.size*this.ratio, this.size, this.scene);
    this.handles.material = this.material;
    this.handles.canMinimize = this.canMinimize;
    this.handles.show();
  }

  /**
   * Dispose of all resources, including the form.
   */
  dispose() {
    super.dispose();
    this.form.dispose();
  }
}