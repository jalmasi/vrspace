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
    this.submitColor = "green";
    this.inputWidth = 500;
    this.keyboardRows = null;
    this.speechInput = new SpeechInput();
    if ( params ) {
      for(var c of Object.keys(params)) {
        this[c] = params[c];
      }
    }
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
    if ( params ) {
      for(let c of Object.keys(params)) {
        input[c] = params[c];
      }
    }
    let command = this.nameToCommand(name);
    if ( command ) {
      this.speechInput.addCommand(command+' *text', (text) => this.input.text = text);
    }
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
    
    return button;
  }
  
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
}

