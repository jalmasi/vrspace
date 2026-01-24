import { Form } from './form.js';
/**
 * Basic input form, contains a TextBlock, InputText and a submit button.
 */
export class InputForm extends Form {
  constructor(inputName = "write", submitName = null) {
    super();
    this.block = null;
    this.input = null;
    this.button = null;
    this.inputName = inputName;
    this.submitName = submitName;
    this.height = 512;
    this.width = 512;
    this.size = 1;
    this.textChangeListeners = [];
    this.buttonCallback = () => {
      // text may be empty string here
      if (this.input.text) {
        this.notifyListeners(this.input.text);
      }
    }
    this.enterCallback = this.buttonCallback;
  }
  /**
   * Creates the StackPanel, adds components, creates plane, texture and virtual keyboard.
   * @returns plane containing the form
   */
  init() {
    this.createPanel();

    this.block = this.textBlock(this.inputName + ":")
    this.inputWidth -= this.fontSize / 2 * this.inputName.length + 20;
    this.panel.addControl(this.block);

    this.input = this.inputText(this.inputName.trim().toLowerCase());
    if (this.enterCallback) {
      // onEnterPressedObservable does not exist in current babylon version
      //this.input.onEnterPressedObservable.add((control) => this.enterCallback(this,control));
      this.input.onKeyboardEventProcessedObservable.add(event => {
        if (event.keyCode == 13) {
          this.enterCallback();
        }
      });
    }
    this.addControl(this.input);

    if (this.submitName) {
      this.button = this.textButton(this.submitName, this.buttonCallback);
    } else {
      this.button = this.submitButton("submit", this.buttonCallback);
    }
    this.addControl(this.button);

    this.inputWidth -= this.button.widthInPixels;
    this.input.widthInPixels = this.inputWidth;

    this.createPlane(this.size, this.width, this.height);
    this.keyboard();

    this.speechInput.start();

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
    if (pos > -1) {
      this.textChangeListeners.splice(pos, 1);
    }
  }
  /** Called to notify listeners */
  notifyListeners(text = this.input.text) {
    this.textChangeListeners.forEach(l => l(text));
  }
  dispose() {
    super.dispose();
    this.textChangeListeners = null;
  }
}
