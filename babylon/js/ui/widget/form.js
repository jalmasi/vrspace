import {SpeechInput} from '../../core/speech-input.js';

/**
 * Base form helper class contains utility methods for creation of UI elements - text blocks, checkboxes, text input etc.
 * All elements share the same style defined in constructor.
 * Every property of the form or element can be overriden with properties of passed params object.
 * UI elements need to be named; this name is used to create a speech command that activates the element.
 * E.g. if the element is checkbox named 'rigged', it can be (de)selected by speaking 'rigged on' or 'rigged off'.
 * HUD delegates gamepad events to appropriate form methods, making form elements usable.
 */
export class Form {
  constructor(params) {
    this.fontSize = 42;
    this.heightInPixels = 48;
    this.resizeToFit = true;
    this.color = "white";
    this.background = "black";
    this.selected = "yellow";
    this.submitColor = "green";
    this.verticalPanel = false;
    this.inputWidth = 500;
    this.keyboardRows = null;
    this.virtualKeyboardEnabled = true;
    this.speechInput = new SpeechInput();
    this.speechInput.addNoMatch((phrases)=>this.noMatch(phrases));
    this.inputFocusListener = null;
    this.elements = [];
    this.controls = [];
    this.activeControl = null;
    this.activeBackground = null;
    this.plane = null;
    this.texture = null;
    if ( params ) {
      for(var c of Object.keys(params)) {
        this[c] = params[c];
      }
    }
  }
  /** Returns Form, required by HUD*/
  getClassName() {
    return "Form";
  }
  /** Called by default on speech recognition mismatch */
  noMatch(phrases) {
    console.log('no match:',phrases)
  }
  /**
   * Returns new StackPanel with 1 height and width and aligned to center both vertically and horizontally
   */
  createPanel() {
    this.panel = new BABYLON.GUI.StackPanel();
    this.panel.isVertical = this.verticalPanel;
    this.panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.panel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    this.panel.width = 1;
    this.panel.height = 1;
    return this.panel;
  }
  /** Add control to the panel */
  addControl(control) {
    this.panel.addControl(control);
  }
  /**
   * Creates and returns a textblock with given text 
   */
  textBlock(text, params) {
    var block = new BABYLON.GUI.TextBlock();
    block.text = text;
    block.color = this.color;
    block.fontSize = this.fontSize;
    block.heightInPixels = this.heightInPixels;
    block.resizeToFit = this.resizeToFit;
    if ( params ) {
      for(var c of Object.keys(params)) {
        block[c] = params[c];
      }
    }
    this.elements.push(block);
    return block;
  }
  // common code for checkbox and radio button
  _common(obj, name, params) {
    obj.heightInPixels = this.heightInPixels;
    obj.widthInPixels = this.heightInPixels;
    obj.color = this.color;
    obj.background = this.background;
    if ( params ) {
      for(var c of Object.keys(params)) {
        obj[c] = params[c];
      }
    }
    let command = this.nameToCommand(name);
    if ( command ) {
      this.speechInput.addCommand(command, (text) => {
        if ( text == 'on' || text == 'true') {
          obj.isChecked = true;
        } else if ( text == 'off' || text == 'false') {
          obj.isChecked = false;
        } else {
          console.log("Can't set "+name+" to "+text);
        }
      }, "*onoff");
    }
    this.elements.push(obj);
    this.controls.push(obj);
    return obj;
  }
  /**
   * Creates and returns a named Checkbox
   */
  checkbox(name, params) {
    var checkbox = new BABYLON.GUI.Checkbox();
    return this._common(checkbox, name, params);
  }
  /**
   * Creates and returns a named RadioButton
   */
  radio(name, params) {
    var radioButton= new BABYLON.GUI.RadioButton();
    return this._common(radioButton, name, params);
  }
  /**
   * Creates and returns a named InputText, registers this.inputFocus() as focus/blur listener
   * @param name identifier used for speech input
   * @param params optional object to override InputText field values
   */
  inputText(name, params) {
    let input = new BABYLON.GUI.InputText(name);
    input.widthInPixels = this.inputWidth;
    input.heightInPixels = this.heightInPixels;
    input.fontSizeInPixels = this.fontSize;

    input.color = this.color;
    input.background = this.background;
    input.focusedBackground = this.background;
    input.onFocusObservable.add(i=>this.inputFocused(i,true));
    input.onBlurObservable.add(i=>this.inputFocused(i,false));
    input.disableMobilePrompt = VRSPACEUI.hud.inXR();
    if ( params ) {
      for(let c of Object.keys(params)) {
        input[c] = params[c];
      }
    }
    let command = this.nameToCommand(name);
    if ( command ) {
      this.speechInput.addCommand(command, 
      (text) => { 
        this.input.text = text;
        this.input.onTextChangedObservable.notifyObservers(text); 
        this.input.onBlurObservable.notifyObservers();
      }, 
      "*text");
    }
    this.elements.push(input);
    this.controls.push(input);
    return input;
  }
  /** Common code for submitButton() and textButton() */
  setupButton(button, callback, params) {
    button.heightInPixels = this.heightInPixels;
    button.paddingLeft = "10px";
    button.background = this.submitColor;
    if ( params ) {
      for(let c of Object.keys(params)) {
        button[c] = params[c];
      }
    }
    let command = this.nameToCommand(button.name);
    if ( callback ) {
      if ( command ) {
        this.speechInput.addCommand(command, () => callback(this));
      }
      button.onPointerDownObservable.add( () => callback(this));
    }
    
    this.elements.push(button);
    this.controls.push(button);
  }
  /**
   * Ceates and returns a named submit image-only Button.
   */
  submitButton(name, callback, params) {
    let button = BABYLON.GUI.Button.CreateImageOnlyButton(name, VRSPACEUI.contentBase+"/content/icons/play.png");
    button.widthInPixels = this.heightInPixels+10;
    this.setupButton(button, callback, params);
    return button;
  }

  /** Creates and returns button showing both text and image */
  textButton(name, callback, params) {
    let button = BABYLON.GUI.Button.CreateImageButton(name.toLowerCase(), name, VRSPACEUI.contentBase+"/content/icons/play.png");
    button.widthInPixels = this.heightInPixels/2*name.length+10;
    this.setupButton(button, callback, params);
    return button;
  }
  /**
   * Creates and returns a VirtualKeyboard, bound to given AdvancedDynamicTexture.
   * A form can only have one keyboard, shared by all InputText elements. 
   * Currently selected InputText takes keyboard input.
   */
  keyboard(advancedTexture = this.texture) {
    var keyboard = BABYLON.GUI.VirtualKeyboard.CreateDefaultLayout('form-keyboard');
    keyboard.fontSizeInPixels = 36;
    keyboard.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    if (this.keyboardRows) {
      this.keyboardRows.forEach(row=>keyboard.addKeysRow(row));
    }
    advancedTexture.addControl(keyboard);
    keyboard.isVisible = false;
    this.vKeyboard = keyboard;
    return keyboard;
  }

  /**
   * Creates a plane and advanced dynamic texture to hold the panel and all controlls.
   * At this point all UI elements should be created. 
   * TODO Form should estimate required texture width/height from elements
   */
  createPlane(size, textureWidth, textureHeight) {
    this.planeSize = size;
    this.plane = BABYLON.MeshBuilder.CreatePlane("FormPlane", {width: size*textureWidth/textureHeight, height: size});
    this.texture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(this.plane,textureWidth,textureHeight);
    // advancedTexture creates material and attaches it to the plane
    this.plane.material.transparencyMode = BABYLON.Material.MATERIAL_ALPHATEST;
    this.texture.addControl(this.panel);
    return this.plane;
  }
  /** 
   * Connects the keyboard to given input, or hides it
   * @param input InputText to (dis)connect
   * @param focused true = connect the keyboard, false = disconnect and hide 
   */
  inputFocused(input, focused) {
    if ( this.vKeyboard && this.virtualKeyboardEnabled ) {
      if ( focused ) {
        this.vKeyboard.connect(input); // makes keyboard invisible if input has no focus
      } else {
        this.vKeyboard.disconnect(input);
      }
      this.vKeyboard.isVisible=focused;
    }
    if ( this.inputFocusListener ) {
      this.inputFocusListener(input,focused);
    }
  }

  /**
   * Dispose of all created elements.
   */
  dispose() {
    if ( this.vKeyboard ) {
      this.vKeyboard.dispose();
      delete this.vKeyboard;
    }
    this.elements.forEach(e=>e.dispose());
    this.speechInput.dispose();
    if ( this.panel ) {
      this.panel.dispose();
    }
    if ( this.plane) {
      this.plane.dispose();
    }
    if ( this.texture ) {
      this.texture.dispose();
    }
  }
  
  /** Internal voice input method: converts a control (button,checkbox...) name (label) to voice command */
  nameToCommand(name) {
    let ret = null;
    if ( name ) {
      // split words and remove all punctuation
      let tokens = name.split(/\s+/).map(word => word.replace(/^[^\w]+|[^\w]+$/g, ''));
      if ( tokens ) {
        // first word is mandatory
        let command = tokens[0].toLowerCase();
        if ( tokens.length > 1 ) {
          // all other words are optional
          for ( let i = 1; i < tokens.length; i++ ) {
            command += ' ('+tokens[i].toLowerCase()+')';
          }
        }
        ret = command;
      }
    }
    return ret;
  }
  
  /**
   * Input delegate method used for gamepad input, or programatic control of the form.
   * @return all controls in this form, or in the keyboard if it's active
   */
  getControls() {
    if ( this.activeControl && this.activeControl.getClassName() == "VirtualKeyboard") {
      return this.vKeyboard.children[this.keyboardRow].children;
    }
    return this.controls;
  }
  /**
   * Input delegate method used for gamepad input, or programatic control of the form.
   * @return currently active control, or in the keyboard if it's active
   */
  getActiveControl() {
    if ( this.activeControl && this.activeControl.getClassName() == "VirtualKeyboard") {
      return this.vKeyboard.children[this.keyboardRow].children[this.keyboardCol];
    }
    return this.activeControl;
  }
  /**
   * Input delegate method used for gamepad input, or programatic control of the form.
   * Sets currently active control.
   */
  setActiveControl(control) {
    if ( this.activeControl && this.activeControl.getClassName() == "VirtualKeyboard") {
      return;
    }
    this.activeControl = control;
  }
  /**
   * Input delegate method used for gamepad input, or programatic control of the form.
   * Activates currently selected control, equivalent to clicking/tapping it.
   * E.g. (de)select a checkbox, press a button, etc.
   */
  activateCurrent() {
    if ( this.activeControl ) {
      //console.log('activate '+this.activeControl.getClassName());
      if ( this.activeControl.getClassName() == "Checkbox") {
        this.activeControl.isChecked = !this.activeControl.isChecked;
      } else if ( this.activeControl.getClassName() == "Button") {
        this.activeControl.onPointerDownObservable.observers.forEach(observer=>observer.callback(this));
      } else if ( this.activeControl.getClassName() == "InputText") {
        console.log("activating keyboard");
        this.activeControl.disableMobilePrompt = true;
        // keyboard has 5 children, each with own children;
        this.getActiveControl().background = this.activeBackground;
        this.activeControl = this.vKeyboard;
        this.keyboardRow = 0;
        this.keyboardCol = 0;
        this.selectCurrent(0);
      } else if ( this.activeControl.getClassName() == "VirtualKeyboard") {
        let input = this.activeControl.connectedInputText;
        let button = this.vKeyboard.children[this.keyboardRow].children[this.keyboardCol];
        button.onPointerUpObservable.observers.forEach(o=>{
          o.callback();
        })
        if(!this.vKeyboard.isVisible) {
          // enter key pressed
          this.activeControl = input;
          this.getActiveControl().background = this.selected;
        }
      }
    }
  }
  /**
   * Internal virtual keyboard method, selects current row at given index
   */
  selectCurrent(index) {
    if (this.activeControl) {
      //console.log('select '+index+' '+this.getActiveControl().getClassName());
      this.keyboardCol = index;
      this.activeBackground = this.getActiveControl().background;
      this.getActiveControl().background = this.selected;
      if ( this.getActiveControl().getClassName() == "InputText") {
        this.inputFocused(this.getActiveControl(),true);
      }
    }
  }
  /**
   * Deselects current control, i.e. changes the background color
   */
  unselectCurrent() {
    if (this.activeControl) {
      this.getActiveControl().background = this.activeBackground;
      if ( this.getActiveControl().getClassName() == "InputText") {
        this.inputFocused(this.activeControl,false);
      }
    }
  }
  /**
   * Internal virtual keyboard method, keeps column index in range
   */
  adjustKeyboardColumn() {
    if (this.keyboardCol >= this.vKeyboard.children[this.keyboardRow].children.length-1) {
      this.keyboardCol = this.vKeyboard.children[this.keyboardRow].children.length-1;
    }
    this.selectCurrent(this.keyboardCol);
  }
  /**
   * Input delegate method used for gamepad input, or programatic control of the form.
   * Processes up key: activate current element, or move up a row in virtual keyboard
   */
  up() {
    if ( this.activeControl && this.activeControl.getClassName() == "VirtualKeyboard") {
      this.unselectCurrent();
      if ( this.keyboardRow > 0 ) {
        this.keyboardRow--;
      } else {
        this.keyboardRow = this.vKeyboard.children.length-1;
      }
      this.adjustKeyboardColumn();
    } else {
      this.activateCurrent();
    }
  }
  /**
   * Input delegate method used for gamepad input, or programatic control of the form.
   * Processes down key: move down a row in virtual keyboard
   */
  down() {
    if ( this.activeControl && this.activeControl.getClassName() == "VirtualKeyboard") {
      this.unselectCurrent();
      if ( this.keyboardRow + 1 < this.vKeyboard.children.length ) {
        this.keyboardRow++;
      } else {
        this.keyboardRow = 0;
      }
      this.adjustKeyboardColumn();
      return false;
    }
    return true;
  }
  /**
   * XR selection support
   */
  isSelectableMesh(mesh) {
    return this.plane && this.plane == mesh;
  }
}

