import { Form } from './form.js';
import { VRSPACEUI } from '../vrspace-ui.js';

/**
 * Simple yes/no dialogue, typically attached straight to the HUD.
 */
export class Dialogue extends Form {
  constructor(question, callback) {
    super();
    this.question = question;
    this.callback = callback;
  }  
  
  init() {
    this.createPanel();
    this.label = this.textBlock(this.question);
    this.addControl(this.label);
    let yesButton = this.textButton("Yes ", () => this.close(true), VRSPACEUI.contentBase+"/content/icons/tick.png");
    this.addControl(yesButton);
    let noButton = this.textButton(" No ", () => this.close(false), VRSPACEUI.contentBase+"/content/icons/close.png", "red");
    this.addControl(noButton);

    VRSPACEUI.hud.showButtons(false);
    VRSPACEUI.hud.newRow();
    let width = this.fontSize*this.question.length;
    VRSPACEUI.hud.addForm(this,width,this.fontSize*2);
  }
  
  close(yesNo) {
    VRSPACEUI.hud.clearRow();
    VRSPACEUI.hud.showButtons(true);
    super.dispose();
    if ( this.callback ) {
      this.callback(yesNo);
    }
  }
}