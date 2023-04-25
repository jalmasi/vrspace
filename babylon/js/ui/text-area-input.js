import { Form } from './form.js';
import { Label } from './label.js';

/**
 * Form attached to TextArea facitilates keyboard input. Contains a TextBlock, InputText and a submit button.
 * Scales itself accordingly, and attaches itself below the TextArea.
 * Optionally creates a Label and displays it just above the TextArea.
 * Attach text change listeners to be notified on text input. 
 */
export class TextAreaInput extends Form {
  /**
   * @param textArea TextArea to attach to
   * @param inputName optional InputText name, displayed TextBlock before the InputText, defaults to "Write"
   * @param titleText optional text to display on label
   */
  constructor(textArea, inputName = "Write", titleText) {
    super();
    this.textArea = textArea;
    this.inputName = inputName;
    this.submitName = null;
    this.titleText = titleText;
    /** Input prefix used as argument to write(), default null */
    this.inputPrefix = null;
    /** Allow speech recognition, default true */
    this.speechRecognition = true;
    /** Print speech mismatch on TextArea, default true */
    this.showNoMatch = true;
    this.textChangeListeners = [];
  }
  init() {
    this.inputWidth = this.textArea.width * 2;

    if (this.titleText) {
      this.title = new Label(this.title, new BABYLON.Vector3(0, 1.2 * this.textArea.size / 2, 0), this.textArea.group);
      this.title.text = this.titleText;
      this.title.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
      this.title.height = this.textArea.size / 10;
      this.title.display();
    }
    this.createPanel();
    
    let textBlock = this.textBlock(this.inputName + ":")
    this.inputWidth -= this.fontSize/2*this.inputName.length+20;
    this.panel.addControl(textBlock);

    this.input = this.inputText(this.inputName.trim().toLowerCase());
    this.addControl(this.input);
    this.inputFocusListener = (input, focused) => {
      if (!focused && input.text) {
        this.notifyListeners(this.input.text);
        this.write(this.input.text, this.inputPrefix);
      }
    }

    let buttonCallback = () => {
      // text may be empty string here
      if ( this.input.text ) {
        this.notifyListeners(this.input.text);
        this.write(this.input.text, this.inputPrefix);
      }
    }
    let button;
    if ( this.submitName ) {
      button = this.textButton(this.submitName, buttonCallback);
    } else {
      button = this.submitButton("submit", buttonCallback);
    }
    this.addControl(button);

    this.inputWidth -= button.widthInPixels;
    this.input.widthInPixels = this.inputWidth;

    this.createPlane(this.textArea.size / 2, this.textArea.width * 2, 512);
    this.keyboard();
    this.plane.parent = this.textArea.group;
    this.plane.position = new BABYLON.Vector3(0, -1.2 * this.textArea.size / 2, 0)

    //input.focus(); // not available in babylon 4
    if (this.speechRecognition) {
      this.speechInput.start();
    }
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
  /** Overridden to display speech mismatch in TextArea */
  noMatch(phrases) {
    if (this.showNoMatch) {
      phrases.forEach(p => this.write(p, "speech"));
    }
    super.noMatch(phrases);
  }
  /**
   * Write something to this text area.
   * @param what to write
   * @param prefix enclosed in square brackets
   */
  write(what, prefix) {
    if (prefix) {
      this.textArea.writeln('[' + prefix + '] ' + what);
    } else {
      this.textArea.writeln(what);
    }
    this.input.text = "";
  }
  dispose() {
    super.dispose();
    this.textChangeListeners = null;
    if (this.title) {
      this.title.dispose();
    }
  }
}