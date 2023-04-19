import {SpeechInput} from './speech-input.js';

/**
 * Base form helper class contains utility methods for creation of UI elements - text blocks, checkboxes, text input etc.
 * Every property of created UI object can be overriden with properties of passed params object.
 * UI elements need to be named; this name is used to create a speech command that activates the element.
 * E.g. if the element is checkbox named 'rigged', it can be (de)selected by speaking 'rigged on' or 'rigged off'.
 */
export class Form {
  constructor(params) {
    this.fontSize = 48;
    this.heightInPixels = 48;
    this.resizeToFit = true;
    this.color = "white";
    this.background = "black";
    this.selected = "yellow";
    this.submitColor = "green";
    this.inputWidth = 500;
    this.keyboardRows = null;
    this.speechInput = new SpeechInput();
    this.elements = [];
    this.controls = [];
    this.activeControl = null;
    this.activeBackground = null;
    if ( params ) {
      for(var c of Object.keys(params)) {
        this[c] = params[c];
      }
    }
  }
  getClassName() {
    return "Form";
  }
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
  checkbox(name, params) {
    var checkbox = new BABYLON.GUI.Checkbox();
    checkbox.heightInPixels = this.heightInPixels;
    checkbox.widthInPixels = this.heightInPixels;
    checkbox.color = this.color;
    checkbox.background = this.background;
    if ( params ) {
      for(var c of Object.keys(params)) {
        checkbox[c] = params[c];
      }
    }
    let command = this.nameToCommand(name);
    if ( command ) {
      this.speechInput.addCommand(command+' *onoff', (text) => {
        if ( text == 'on' || text == 'true') {
          checkbox.isChecked = true;
        } else if ( text == 'off' || text == 'false') {
          checkbox.isChecked = false;
        } else {
          console.log("Can't set "+name+" to "+text);
        }
      });
    }
    this.elements.push(checkbox);
    this.controls.push(checkbox);
    return checkbox;
  }
  inputText(name, params) {
    let input = new BABYLON.GUI.InputText(name);
    input.widthInPixels = this.inputWidth;
    input.heightInPixels = this.heightInPixels;
    input.fontSizeInPixels = this.fontSize;
    //input.paddingLeft = "10px";
    //input.paddingRight = "10px";
    // fine:
    //input.widthInPixels = canvas.getBoundingClientRect().width/2;
    //input.widthInPixels = scene.getEngine().getRenderingCanvas().getBoundingClientRect().width/2;
    input.color = this.color;
    input.background = this.background;
    input.onFocusObservable.add(i=>this.inputFocused(i,true));
    input.onBlurObservable.add(i=>this.inputFocused(i,false));
    if ( params ) {
      for(let c of Object.keys(params)) {
        input[c] = params[c];
      }
    }
    let command = this.nameToCommand(name);
    if ( command ) {
      this.speechInput.addCommand(command+' *text', (text) => this.input.text = text);
    }
    this.elements.push(input);
    this.controls.push(input);
    return input;
  }
  submitButton(name, callback, params) {
    let button = new BABYLON.GUI.Button.CreateImageOnlyButton(name, VRSPACEUI.contentBase+"/content/icons/play.png");
    button.widthInPixels = this.heightInPixels+10;
    button.heightInPixels = this.heightInPixels;
    button.paddingLeft = "10px";
    button.background = this.submitColor;
    if ( params ) {
      for(let c of Object.keys(params)) {
        button[c] = params[c];
      }
    }
    let command = this.nameToCommand(name);
    if ( callback ) {
      if ( command ) {
        this.speechInput.addCommand(command, () => callback(this));
      }
      button.onPointerDownObservable.add( () => callback(this));
    }
    
    this.elements.push(button);
    this.controls.push(button);
    return button;
  }

  keyboard(advancedTexture) {
    var keyboard = BABYLON.GUI.VirtualKeyboard.CreateDefaultLayout('search-keyboard');
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
  
  inputFocused(input, focused) {
    if ( this.vKeyboard ) {
      if ( focused ) {
        this.vKeyboard.connect(input); // makes keyboard invisible if input has no focus
      } else {
        this.vKeyboard.disconnect(input);
      }
      this.vKeyboard.isVisible=focused;
    }
  }

  dispose() {
    if ( this.vKeyboard ) {
      this.vKeyboard.dispose();
      delete this.vKeyboard;
    }
    this.elements.forEach(e=>e.dispose());
    this.speechInput.dispose();
  }  
  
  /** converts a control (button,checkbox...) name (label) to voice command */
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
  
  getControls() {
    if ( this.activeControl && this.activeControl.getClassName() == "VirtualKeyboard") {
      return this.vKeyboard.children[this.keyboardRow].children;
    }
    return this.controls;
  }
  getActiveControl() {
    if ( this.activeControl && this.activeControl.getClassName() == "VirtualKeyboard") {
      return this.vKeyboard.children[this.keyboardRow].children[this.keyboardCol];
    }
    return this.activeControl;
  }
  setActiveControl(control){
    if ( this.activeControl && this.activeControl.getClassName() == "VirtualKeyboard") {
      return;
    }
    this.activeControl = control;
  }
  activateCurrent() {
    if ( this.activeControl ) {
      //console.log('activate '+this.activeControl.getClassName());
      if ( this.activeControl.getClassName() == "Checkbox") {
        this.activeControl.isChecked = !this.activeControl.isChecked;
      } else if ( this.activeControl.getClassName() == "Button") {
        this.activeControl.onPointerDownObservable.observers.forEach(observer=>observer.callback(this));
      } else if ( this.activeControl.getClassName() == "InputText") {
        console.log("activating keyboard");
        this.activeControl.disableMobilePrompt = VRSPACEUI.hud.inXR();
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
  unselectCurrent() {
    if (this.activeControl) {
      this.getActiveControl().background = this.activeBackground;
      if ( this.getActiveControl().getClassName() == "InputText") {
        this.inputFocused(this.activeControl,false);
      }
    }
  }
  down() {
    if ( this.activeControl && this.activeControl.getClassName() == "VirtualKeyboard") {
      this.unselectCurrent();
      if ( this.keyboardRow + 1 < this.vKeyboard.children.length ) {
        this.keyboardRow++;
      } else {
        this.keyboardRow = 0;
      }
      if (this.keyboardCol >= this.vKeyboard.children[this.keyboardRow].children.length-1) {
        this.keyboardCol = this.vKeyboard.children[this.keyboardRow].children.length-1;
      }
      this.selectCurrent(this.keyboardCol);
      return false;
    }
    return true;
  }
}

