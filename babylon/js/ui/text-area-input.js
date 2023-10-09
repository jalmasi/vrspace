import { InputForm } from './input-form.js';

/**
 * Form attached to TextArea facitilates keyboard input. Contains a TextBlock, InputText and a submit button.
 * Scales itself accordingly, and attaches itself below the TextArea.
 * Optionally creates a Label and displays it just above the TextArea, as a title.
 * Attach text change listeners to be notified on text input. 
 */
export class TextAreaInput extends InputForm {
  /**
   * @param textArea TextArea to attach to
   * @param inputName optional InputText name, displayed TextBlock before the InputText, defaults to "Write"
   * @param titleText optional text to display on label above the area
   */
  constructor(textArea, inputName = "Write", titleText = null) {
    super(inputName);
    this.textArea = textArea;
    this.textArea.titleText = titleText;
    this.inputName = inputName;
    this.submitName = null;
    /** Input prefix used as argument to write(), default null */
    this.inputPrefix = null;
    /** Allow speech recognition, default true */
    this.speechRecognition = true;
    /** Print speech mismatch on TextArea, default true */
    this.showNoMatch = true;
  }
  /**
   * Initialize and attach to the TextArea
   */
  init() {
    this.buttonCallback = () => {
      // text may be empty string here
      if ( this.input.text ) {
        this.notifyListeners(this.input.text);
        this.write(this.input.text, this.inputPrefix);
      }
    }

    this.inputWidth = this.textArea.width * 2;
    this.size = this.textArea.size / 2;
    this.width = this.textArea.width * 2;
    
    super.init();

    this.textArea.showTitle();
    
    this.inputFocusListener = (input, focused) => {
      if (!focused && input.text) {
        this.notifyListeners(this.input.text);
        this.write(this.input.text, this.inputPrefix);
      }
    }

    this.plane.parent = this.textArea.group;
    this.plane.position = new BABYLON.Vector3(0, -1.2 * this.textArea.size / 2, 0)

    //input.focus(); // not available in babylon 4
    if (this.speechRecognition) {
      this.speechInput.start();
    }
  }
  /** Overridden to display speech mismatch in TextArea */
  noMatch(phrases) {
    if (this.showNoMatch) {
      phrases.forEach(p => this.write(p, "speech", false));
    }
    super.noMatch(phrases);
  }
  /**
   * Write something to this text area.
   * @param what to write
   * @param prefix enclosed in square brackets
   * @param true clear text input, default true
   */
  write(what, prefix, clear = true) {
    if (prefix) {
      this.textArea.writeln('[' + prefix + '] ' + what);
    } else {
      this.textArea.writeln(what);
    }
    if ( clear ) {
      this.input.text = "";
    }
  }
  dispose() {
    super.dispose();
  }
}