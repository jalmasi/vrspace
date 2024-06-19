import { Form } from './form.js';
import { VRSPACEUI } from '../vrspace-ui.js';
/**
 * Basic input form, contains a TextBlock, InputText and a submit button.
 */
export class InputForm extends Form {
  constructor(inputName = "write", submitName = null) {
    super();
    this.inputName = inputName;
    this.submitName = submitName;
    this.height = 512;
    this.width = 512;
    this.size = 1;
    this.textChangeListeners = [];
    this.buttonCallback = () => {
      // text may be empty string here
      if ( this.input.text ) {
        this.notifyListeners(this.input.text);
      }
    }
  }
  /**
   * Creates the StackPanel, adds components, creates plane, texture and virtual keyboard.
   * @returns plane containing the form
   */
  init() {
    this.createPanel();
    
    let textBlock = this.textBlock(this.inputName + ":")
    this.inputWidth -= this.fontSize/2*this.inputName.length+20;
    this.panel.addControl(textBlock);

    this.input = this.inputText(this.inputName.trim().toLowerCase());
    this.addControl(this.input);

    let button;
    if ( this.submitName ) {
      button = this.textButton(this.submitName, this.buttonCallback);
    } else {
      button = this.submitButton("submit", this.buttonCallback);
    }
    this.addControl(button);

    this.inputWidth -= button.widthInPixels;
    this.input.widthInPixels = this.inputWidth;
    
    this.createPlane(this.size, this.width, this.height);
    this.keyboard();
    
    this.speechInput.start();
    
    VRSPACEUI.hud.addAttachment(this.plane);
    return this.plane;
  }
  setEnabled(enable) {
    this.plane.setEnabled(enable);
  }
  /**
   * Add a listener to be called when input text is changed (submit button activated or input lost focus)
   */
  addListener(listener) {
    this.textChangeListeners.push(listener);
  }
  /** Remove a listener */
  removeListener(listener) {
    let pos = this.textChangeListeners.indexOf(listener);
    if ( pos > -1 ) {
      this.textChangeListeners.splice(pos,1);
    }
  }
  /** Called to notify listeners */
  notifyListeners() {
    this.textChangeListeners.forEach(l=>l(this.input.text));
  }
  dispose() {
    VRSPACEUI.hud.removeAttachment(this.plane);
    super.dispose();
    this.textChangeListeners = null;
  }
}
