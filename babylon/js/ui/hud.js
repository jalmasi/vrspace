import {SpeechInput} from '../core/speech-input.js';
import { ColorPickerPanel } from './widget/colorpicker-panel.js';
import { SliderPanel } from './widget/slider-panel.js';
/**
HUD stands for head-up display - a UI container mounted on users head.
Typically we have some buttons around 50 cm front, 10-20 cm below line of sight.

This is common UI supposed to be usefull on VR devices, PC and mobiles, but likely to be suboptimal - 
UI specifically designed for a device should be more ergonomic.

By default it tracks active camera, and binds to new camera whenever active camera changes,
e.g. upon entering/exiting VR. Constructed with a camera parameter, it does not rebind to a new one.
This allows to have multiple HUDs attached to different cameras, 
e.g. switching from first-person view to god mode activates a different HUD.

But in XR, it can be attached to left or right controller instead of camera: just grab any hud element
and squeeze, i.e. use squeeze button. Press both squeeze buttons to attach hud back to the camera.

Typically HUD is just a collection of buttons, but it can also contain different UI elements, 
e.g. sliders, and even forms. It takes input from mouse, touch screen, VR controllers and even gamepad,
and delegates it to underlying UI elements as appropriate.

It can contain multiple rows, each containing multiple buttons, but a row can contain only one Form.
 */
export class HUD {
  /** @param scene babylonjs scene */
  /** @param camera to track, by default tracks active camera */
  constructor( scene, camera ) {
    // parameters
    this.scene = scene;
    this.onlyCamera = camera;
    // constants
    this.buttonSize = .05;
    this.buttonSpacing = 0.025;
    this.alpha=0.7; // button opacity
    this.distanceWeb = .5;
    this.distanceXR = .5;
    this.verticalWeb = -0.15;
    this.verticalXR = -0.1;
    this.scaleWeb = 1;
    this.scaleXR = .5;
    this.rowOffset = new BABYLON.Vector3(0,this.verticalWeb,0);
    this.colorEnabled = new BABYLON.Color3(0.3, 0.35, 0.4);
    this.colorDisabled = new BABYLON.Color3(0.67, 0.29, 0.29);
    this.colorActive = new BABYLON.Color3(0.29, 0.67, 0.29);
    // state variables
    /** set by World.InitXR() */
    this.vrHelper = null;
    /* Allow selection with Ray? True by default, but prevents ray picking object from the scene as it is just in front of the camera.*/
    this.allowSelection = true;
    this.speechInput = new SpeechInput();
    this.speechInput.onlyLetters = false;
    this.speechInput.addNoMatch((phrases)=>console.log('no match:',phrases));
    this.currentController = null;
    this.scale = this.scaleWeb;
    this.activeControl = null;
    scene.onActiveCameraChanged.add( () => this.trackCamera() );
    this.guiManager = new BABYLON.GUI.GUI3DManager(this.scene);
    this.attachments = [];
    this.elements = [];
    this.controls = [];
    this.textures = [];
    this.root = new BABYLON.TransformNode("HUD");
    this.root.position = new BABYLON.Vector3(0,this.verticalWeb,this.distanceWeb);
    this.rowRoot = new BABYLON.TransformNode("HUD0");
    this.rowRoot.parent = this.root;
    this.rows = [{root: this.rowRoot, elements: this.elements, controls: this.controls, textures: this.textures, speechInput: this.speechInput, activeControl: this.activeControl}];
    window.addEventListener("resize", () => {
      this.rescaleHUD();
    });
    this.trackCamera();
  }
  /**
  Handles camera change events, typically while entering/exiting VR.
   */
  trackCamera() {
    console.log("HUD tracking camera: "+this.scene.activeCamera.getClassName()+" new position "+this.scene.activeCamera.position);
    console.log("Camera inputs:", this.scene.activeCamera.inputs.attached);
    this.camera = this.scene.activeCamera;
    this.rescaleHUD();
    if ( this.camera ) {
      if ( this.onlyCamera ) {
       if ( this.camera == this.onlyCamera ) {
          // TODO activate this HUD
        } else {
          // TODO deactivate this HUD
        }
      } else {
        this.attachToCamera();
      }
    }
  }
  /**
   * Attach HUD to camera it was created with.
   */
  attachToCamera() {
    this.root.parent = this.camera;
    this.root.position = new BABYLON.Vector3(0,this.vertical(),this.distance());
    this.root.rotation = new BABYLON.Vector3(0,0,0);
    this.rowOffset = new BABYLON.Vector3(0,this.verticalWeb,0);
    this.currentController = null;
  }
  /** Returns true if XR mode is active (current camera is WebXRCamera) */
  inXR() {
    return this.camera && "WebXRCamera" == this.camera.getClassName();
  }
  
  /** Returns vertical position of the HUD */
  vertical() {
    if ( this.inXR() ) {
      return this.verticalXR;
    } else {
      return this.verticalWeb;
    }
  }
  /** Returns distance of the HUD from the camera*/
  distance() {
    if ( this.inXR() ) {
      return this.distanceXR;
    } else {
      return this.distanceWeb;
    }
  }
  /** Returns scaling of the HUD */
  scaling() {
    if ( this.inXR() ) {
      return this.scaleXR;
    }
    return this.scaleWeb;
  }
  /**
  Window.resize event handler, rescales the HUD if aspect ratio is too small for all buttons to fit.
   */
  rescaleHUD() {
    let aspectRatio = this.scene.getEngine().getAspectRatio(this.scene.activeCamera);
    if (this.activeControl && this.activeControl.getClassName() == "Form") {
      // we have only one element - plane with advancedTexture
      let width = this.elements[0].material.emissiveTexture.getSize().width;
      let size = 0.03 / 64 * width;
      let requiredRatio = size*3;
      this.scale = Math.min(this.scaling(), aspectRatio/requiredRatio);
    } else {
      // 0.75 (10 buttons) on this distance fits at aspect of 2
      let requiredRatio = this.elements.length/10*2;
      this.scale = Math.min(this.scaling(), aspectRatio/requiredRatio);
    }
    this.root.scaling = new BABYLON.Vector3(this.scale,this.scale,1);
    //console.log("Aspect ratio: "+aspectRatio+" HUD scaling: "+this.scale+" controls "+this.getControls().length);
  }
  
  /**
   * Called before adding a new button to reposition existing ones
   */
  makeRoomForMore() {
	  // TODO take variable size of elements into account
    var width = this.buttonSize+this.buttonSpacing;
    this.elements.forEach(b=>{
      b.position.x = b.position.x - width/2;
    });
    return width;
  }
  
  /**
  Create a button with given text and image and add it to the HUD
  @param text description to display
  @param imageUrl image to display
  @param onPointerDown callback function activated when pressed
  @param shareMaterial optional, defaults to true, use shared material for all buttons or create a new one
  @returns a BabylonJS HolographicButton
   */
  addButton(text, imageUrl, onPointerDown, shareMaterial=true) {
    var width = this.makeRoomForMore();
    
    var button = new BABYLON.GUI.HolographicButton(text+"Button", shareMaterial);
    this.guiManager.addControl(button);
    button.imageUrl = imageUrl;
    button.text=text;
    button.position = new BABYLON.Vector3(this.elements.length*width/2,0,0);
    button.scaling = new BABYLON.Vector3( this.buttonSize, this.buttonSize, this.buttonSize );
    button.mesh.parent = this.rowRoot;
    this.elements.push(button);
    this.controls.push(button);
    button.backMaterial.alpha = this.alpha;
    this.rescaleHUD();
    if ( onPointerDown ) {
      button.onPointerDownObservable.add( (vector3WithInfo) => onPointerDown(button, vector3WithInfo) );
    }
    if ( text ) {
      this.speechInput.addCommand(text, () => {
        // execute click callback(s) on visible button
        this.activateButton(button);
      });
    }
    return button;
  }

  /** Activates given button, if it's visible */
  activateButton(button) {
    if ( button.isVisible ) {
      button.onPointerDownObservable.observers.forEach(observer=>observer.callback(button))
      button.onPointerUpObservable.observers.forEach(observer=>observer.callback(button))
    }
  }
  /**
   * Input delegate method, returns controls available in the current row or form. 
   */
  getControls() {
    if (this.activeControl && this.activeControl.getClassName() == "Form") {
      return this.activeControl.getControls();
    }
    return this.controls;
  }
  /**
   * Input delegate method, returns active control current in row or form. 
   */
  getActiveControl() {
    if (this.activeControl && this.activeControl.getClassName() == "Form") {
      return this.activeControl.getActiveControl();
    }
    return this.activeControl;
  }
  /**
   * Input delegate method, sets active control current in row or form. 
   */
  setActiveControl(control) {
    if (this.activeControl && this.activeControl.getClassName() == "Form") {
      this.activeControl.setActiveControl(control);
    } else {
      this.activeControl = control;
    }
  }
  /**
   * Input delegate method, returns index of control current in row or form. 
   */
  getControlIndex(control) {
    let ret = -1;
    let controls = this.getControls();
    for ( let i = 0; i < controls.length; i++ ) {
      if ( controls[i] === control) {
        ret = i;
        break;
      }
    }
    return ret;
  }
  /**
   * Input delegate method, deselects current control. 
   */
  unselectCurrent() {
    if ( this.activeControl && this.activeControl.getClassName() == "HolographicButton") {
      this.activeControl.pointerOutAnimation();
    } else if (this.activeControl && this.activeControl.getClassName() == "Form") {
      this.activeControl.unselectCurrent();
    }
  }
  /**
   * Input delegate method, selects current control (button or Form element) at given index.
   */
  selectCurrent(index) {
    if ( this.activeControl && this.activeControl.getClassName() == "HolographicButton") {
      this.activeControl.pointerEnterAnimation();
    } else if (this.activeControl && this.activeControl.getClassName() == "Form") {
      this.activeControl.selectCurrent(index);
    }
  }
  /**
   * Input delegate method, selects the control at given index, keeps track of bounds and wraps around.
   */
  selectControl(index) {
    let controls = this.getControls();
    if ( index < 0 ) {
      index = controls.length + index;
    }
    index = index % controls.length;
    //console.log("Current control: "+index+"/"+this.getControls().length);
    this.unselectCurrent();
    this.setActiveControl(controls[index]);
    this.selectCurrent(index);
  }
  /** Returns true if HUD can process gamepad event, i.e. a button or form is currently active. FIXME ugly hack used by VRHelper. */
  canProcessGamepadEvent(index) {
    return this.activeControl && 
    (this.activeControl.getClassName() == "HolographicButton"||this.activeControl.getClassName() == "Form") &&
    (index == 8 || index == 9);
  }
  /**
   * Input delegate method, activates the current control (as if clicked on)
   */
  activate() {
    if ( this.activeControl ) {
      if ( this.activeControl.getClassName() == "HolographicButton") {
        this.activateButton(this.activeControl);
      } else if ( this.activeControl.getClassName() == "Form") {
        this.activeControl.activateCurrent();
      }
    }
  }
  /**
   * Input delegate method, process a gamepad up button event: activate a button or delegate it to the Form.
   */
  up() {
    if ( this.activeControl ) {
      if ( this.activeControl.getClassName() == "HolographicButton") {
        this.activateButton(this.activeControl);
      } else if ( this.activeControl.getClassName() == "Form") {
        this.activeControl.up();
      }
    }
  }
  /**
   * Input delegate method, process a gamepad up button event: go back to previous row, or forward to the Form.
   */
  down() {
    let clear = true;
    if ( this.activeControl && this.activeControl.getClassName() == "Form") { 
      clear = this.activeControl.down();
    }
    if ( clear && this.rows.length > 1 ) {
      let previous = this.rows[this.rows.length-2];
      if ( previous.activeControl && previous.activeControl.getClassName() == "HolographicButton") {
        this.activateButton(previous.activeControl);
      }
    } else if ( clear ) {
      this.unselectCurrent();
      this.activeControl = null;
    }
  }
  /**
   * Input delegate method, internal state management. Activates next or previous element, ignoring invisible ones.
   * @param increment -1 or 1 for previous/next
   */
  next(increment) {
    let index = this.getControlIndex(this.getActiveControl());
    let controls = this.getControls();
    for ( let i = index+increment; i >=0 && i < controls.length; i=i+increment ) {
      if ( controls[i].isVisible ) {
        return i;
      }
    }
    if ( increment < 0 && controls[controls.length-1].isVisible) {
      return controls.length-1;
    } else if ( increment > 0 && controls[0].isVisible) {
      return 0;
    }
    return index;
  }
  /**
   * Activates previous element (gamepad left button)
   */
  left() {
    this.selectControl(this.next(-1));
  }
  /**
   * Activates next element (gamepad right button)
   */
  right() {
    this.selectControl(this.next(1));
  }
  /**
   * Adds a Form to the hud. Creates and returns AdvancedDynamicTexture to render the form.
   * @param form to add
   * @param textureWidth width in pixels
   * @param textureHeight height in pixels
   */
  addForm(form,textureWidth,textureHeight) {
    let size = 0.03 * textureHeight/64; // 3cm for 64px letter

    let plane = form.createPlane(size,textureWidth,textureHeight);
    plane.parent = this.rowRoot;
    //plane.position = new BABYLON.Vector3(0,size/2,0.02);
    plane.position = new BABYLON.Vector3(0,size/2,-0.05); // closer than buttons
    
    this.elements.push(plane);
    this.controls.push(form.panel);
    this.textures.push(form.texture);
    
    this.activeControl = form;
    
    this.rescaleHUD();
    return form.texture;
  }
  
  /**
  Adds a slider to the HUD.
  @return babylon Slider object
   */
  addSlider(text="Value",min,max,value) {
    var width = this.makeRoomForMore();

    let sliderPanel = new SliderPanel(0.07,text,min,max,value);

    sliderPanel.plane.parent = this.rowRoot;
    //plane.position.z = 0.02;
    sliderPanel.plane.position = new BABYLON.Vector3(this.elements.length*width/2,0,0.02);    
    this.textures.push(sliderPanel.advancedTexture);

    this.elements.push(sliderPanel.plane);
    this.controls.push(sliderPanel.panel);
    
    if ( text ) {
      this.speechInput.addCommand(text, (value) => {
        console.log("setting "+text+" to "+value);
        if ( "one" == value ) {
          value = "1";
        } else if ( "zero" == value ) {
          value = "0";
        }
        if ( isNaN(value)) {
          console.log('Unrecognized input value: '+value);
        } else {
          let num = parseFloat(value);
          if ( num > slider.maximum ) {
            slider.value = slider.maximum;
          } else if ( num < slider.minimum ) {
            slider.value = slider.minimum;
          } else {
            slider.value = num;
          }
          header.text = text+": "+value;
        }
      }, "*value");
    }
    
    return sliderPanel.slider;
  }
  /**
  Adds color picker to the HUD.
  @return babylon ColorPicker object
   */
  addColorPicker(text="Color",color=new BABYLON.Color3()) {
    let width = this.makeRoomForMore();
    let pickerPanel = new ColorPickerPanel(0.07,text,color);
    
    pickerPanel.plane.parent = this.rowRoot;
    pickerPanel.plane.position = new BABYLON.Vector3(this.elements.length*width/2,0,0);

    this.textures.push(pickerPanel.advancedTexture);

    this.elements.push(pickerPanel.plane);
    this.controls.push(pickerPanel.panel);

    this.rescaleHUD();
    return pickerPanel.picker;
  }

  /**
  Show or hide all HUD elements (buttons)
  @param show show or hide
  @param except optional element(s) to skip
   */
  showButtons(show, ...except) {
    this.controls.forEach( (element) => {
      if ( !except
        // no children - button 
        || (!element.children && !except.includes(element))
        // panel contains text and control 
        || ( element.children && !except.includes(element.children[1]))  
      ) {
        element.isVisible = show;
      }
    });
    if ( !show && except && except != this.getActiveControl()) {
      // if everything turned off, including currently selected button, select what you can
      this.right();
    }
  }
 
  /** Returns the current row */
  currentRow() {
    return this.rows[this.rows.length-1];
  }
  
  /**
   * Creates a new empty row. Current row is scaled down and moved a bit down.
   */
  newRow() {
    this.rows.forEach(row=>{
      row.root.scaling.scaleInPlace(.5);
      row.root.position.addInPlace(this.rowOffset.scale(.6/(this.rows.length*2)));
    });
    this.unselectCurrent();
    this.currentRow().activeControl = this.activeControl;
    this.rowRoot = new BABYLON.TransformNode("HUD"+this.rows.length);
    this.rowRoot.parent = this.root;
    
    this.elements = [];
    this.controls = [];
    this.textures = [];
    this.activeControl = null;
    this.speechInput.stop();
    this.speechInput = new SpeechInput();
    this.speechInput.onlyLetters = false;
    this.rows.push({root: this.rowRoot, elements: this.elements, controls: this.controls, textures: this.textures, speechInput: this.speechInput, activeControl: this.activeControl});
  }

  /**
   * Clears and disposes of all controls in the current row
   */
  clearControls() {
    this.controls.forEach(c=>c.dispose());
    this.elements.forEach(e=>{
      if ( e.material ) {
        // apparently AdvancedDynamicTexture creates and leaks material for Plane
        e.material.dispose();
      }
      e.dispose();
    });
    this.textures.forEach(t=>t.dispose());

    this.attachments = [];
    this.elements = [];
    this.controls = [];
    this.textures = [];
    this.activeControl = null;
  }
  /**
   * Clears the current row. Previous row is scaled back to original size and brought back into position.
   */
  clearRow() {
    // TODO check rows length
    this.clearControls();

    this.rowRoot.dispose();
    this.speechInput.dispose();

    this.rows.pop();

    this.rows.forEach(row=>{
      row.root.scaling.scaleInPlace(2);
      row.root.position.addInPlace(this.rowOffset.scale(-.6/(this.rows.length*2)));
    });

    var row = this.rows[this.rows.length-1];
    this.rowRoot = row.root;
    this.elements = row.elements;
    this.controls = row.controls;
    this.textures = row.textures;
    this.speechInput = row.speechInput;
    this.activeControl = row.activeControl;
    this.selectCurrent();
    this.speechInput.start();
    this.rescaleHUD();
  }
  
  /**
   * Enable/disable speech input.
   * @param enable true/false to enable/disable
   */
  enableSpeech(enable) {
    if ( enable ) {
      this.speechInput.start();
    } else {
      this.speechInput.stop();
    }
  }
  
  /**
   * Used XR pointer selection predicate, returns true if selection is allowed and given mesh is one of HUD elements.
   */
  isSelectableMesh(mesh) {
    return this.allowSelection && (this.elements.includes(mesh) || this.attachments.includes(mesh));
  }

  /**
   * Initialize XR - allows to grab hud in left or right hand
   * @param vrHelper VRHelper
   */  
  initXR(vrHelper) {
    this.vrHelper = vrHelper;
    this.squeezeConsumer = (value,side)=>this.processSqueeze(value,side);
    this.vrHelper.addSqueezeConsumer(this.squeezeConsumer);
  }

  processSqueeze(value,side) {
    let xrController = this.vrHelper.controller[side];
    let intersects = this.intersects(xrController.grip);
    //console.log(side+' squeeze: '+value+ " Intersects: "+intersects);
    if ( value == 1 && intersects ) {
      if ( side == 'left' ) {
        this.attachToLeftController();
      } else {
        this.attachToRightController();
      }
      return false;
    } else if ( 
      this.vrHelper.squeeze.left.value == 1 && this.vrHelper.squeeze.right.value == 1 &&
      this.vrHelper.trigger.left.value == 0 && this.vrHelper.trigger.right.value == 0 ) 
    {
      // rescaling/repositioning the hud using both squeeze buttons
      try {
        let leftPos = this.vrHelper.controller.left.grip.absolutePosition;
        let rightPos = this.vrHelper.controller.right.grip.absolutePosition;
        let handDistance = leftPos.subtract(rightPos).length();
        let leftDistance = leftPos.subtract(this.camera.position).length();
        let rightDistance = rightPos.subtract(this.camera.position).length();
        let distance = Math.min(leftDistance,rightDistance);
        let leftHeight = leftPos.y - this.camera.position.y;
        let rightHeight = rightPos.y - this.camera.position.y;
        let height = (leftHeight+rightHeight)/2;
        this.distanceXR = distance;
        this.scaleXR = handDistance;
        this.verticalXR = height;
      } catch ( err ) {
        console.log(err.stack);
      }
      this.attachToCamera();
      this.rescaleHUD();
      //return false; // let's not consume it
    }
    return true;    
  }  
  /**
   * Attach hud to left hand
   */
  attachToLeftController() {
    this.root.parent = this.vrHelper.controller.left.grip;
    this.root.position = new BABYLON.Vector3(this.verticalWeb,0,.1);
    this.root.rotation = new BABYLON.Vector3(Math.PI/2,0,Math.PI/2);
    //this.rowOffset = new BABYLON.Vector3(-this.verticalXR,0,0);
    this.rowOffset = new BABYLON.Vector3(0,this.verticalXR,0);
    this.currentController = 'left';
  }
  /**
   * Attach hud to right hand
   */
  attachToRightController() {
    this.root.parent = this.vrHelper.controller.right.grip;
    this.root.position = new BABYLON.Vector3(-this.verticalWeb,0,.1);
    this.root.rotation = new BABYLON.Vector3(Math.PI/2,0,-Math.PI/2);
    //this.rowOffset = new BABYLON.Vector3(this.verticalXR,0,0);
    this.rowOffset = new BABYLON.Vector3(0,this.verticalXR,0);
    this.currentController = 'right';
  }
  /**
   * Returns VR controller this HUD is attached to, or null
   */
  attachedController() {
    if (this.currentController) {
      return this.vrHelper.controller[this.currentController];
    }
    return null;
  }
  /**
   * If attached to a hand, returns the other hand, or null otherwise
   */
  otherController() {
    if ( this.currentController && this.vrHelper ) {
      if ( 'left' == this.currentController ) {
        return this.vrHelper.controller.right;
      } else if ( 'right' == this.currentController ) {
        return this.vrHelper.controller.left;
      }
    }
    return null;
  }
  /**
   * Returns true if mesh intersects any of hud elements. Allows to 'grab' the hud with a VR controller.
   */
  intersects(mesh) {
    let ret = false;
    this.elements.forEach(e=>{
      if (e.getClassName() == "HolographicButton") {
        // also trying currently invisible buttons
        let visible = e.mesh.isVisible;
        ret |= e.mesh.intersectsMesh(mesh);
        e.mesh.isVisible = visible;
      } else {
        ret |= e.intersectsMesh(mesh);
      }
    });
    this.attachments.forEach( e => ret |= e.intersectsMesh(mesh));
    return ret;
  }
  /**
   * Add an attachment mesh. It will be used for XR controller manipulation as other hud elements.
   * However, mesh parent isn't changed, it has to be set by caller to hud root.
   */
  addAttachment(mesh) {
    this.attachments.push(mesh);
  }
  /** Detach an attached mesh. Parent is not changed here. */
  removeAttachment(mesh) {
    let pos = this.attachments.indexOf(mesh);
    if ( pos > -1 ) {
      this.attachments.splice(pos,1);
    }
  }

  /**
   * Helper method to set button color, note that button needs it's own material. 
   */  
  markEnabled(button, keepTooltip = false) {
    this.markButton(button, this.colorEnabled, keepTooltip);
  }

  /**
   * Helper method to set button color to red, note that button needs it's own material. 
   */  
  markDisabled(button, keepTooltip = false) {
    this.markButton(button, this.colorDisabled, keepTooltip);
  }

  /**
   * Helper method to set button color to green, note that button needs it's own material. 
   */  
  markActive(button, keepTooltip = false) {
    this.markButton(button, this.colorActive, keepTooltip);
  }

  /**
   * Returns true if button color matches colorEnabled
   */
  isEnabled(button) {
    return button.backMaterial.albedoColor.r == this.colorEnabled.r
    && button.backMaterial.albedoColor.g == this.colorEnabled.g
    && button.backMaterial.albedoColor.b == this.colorEnabled.b;
  }
  /**
   * Common code for markEnabled/Disabled/Active
   */
  markButton(button, color, keepTooltip = false) {
    if ( button ) {
      if ( ! keepTooltip ) {
        button.tooltipText = "N/A";
      }
      button.backMaterial.albedoColor = color;
    }
  }
 
}