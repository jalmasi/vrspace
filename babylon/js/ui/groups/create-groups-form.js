import { Form } from '../widget/form.js';

export class CreateGroupForm extends Form {
  constructor(callback) {
    super();
    this.callback = callback;
    this.color = "black";
    this.background = "white";
    this.nameText = "Name:";
    this.publicText = "Public:";
    this.tempText = "Temporary:";
  }
  init() {
    this.createPanel();
    this.grid = new BABYLON.GUI.Grid();
    this.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;

    this.nameLabel = this.textBlock(this.nameText);
    this.nameInput = this.inputText('name');
    this.publicLabel = this.textBlock(this.publicText);
    this.publicCheckbox = this.checkbox('public');
    this.tempLabel = this.textBlock(this.tempText);
    this.tempCheckbox = this.checkbox('temporary');
    this.submit = this.submitButton("submit", this.callback);

    this.panel.addControl(this.nameLabel);
    this.panel.addControl(this.nameInput);
    this.panel.addControl(this.publicLabel);
    this.panel.addControl(this.publicCheckbox);
    this.panel.addControl(this.tempLabel);
    this.panel.addControl(this.tempCheckbox);
    this.panel.addControl(this.submit);

    this.speechInput.addNoMatch((phrases) => console.log('no match:', phrases));
    this.speechInput.start();
  }

}

