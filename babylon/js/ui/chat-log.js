import { TextArea } from './text-area.js';
import { TextAreaInput } from './text-area-input.js';

export class ChatLog extends TextArea {
  constructor(scene) {
    super(scene, "ChatLog");
    this.input = new TextAreaInput(this);
    this.input.submitName = "send";
    this.inputPrefix = "ME";
    this.size = .4;
    this.position = new BABYLON.Vector3(-.4, .2, .3);
  }
  show() {
    super.show();
    this.attachToHud();
    this.input.inputPrefix = this.inputPrefix;
    this.input.init();
  }
  dispose() {
    this.input.dispose();
    super.dispose();
  }
}