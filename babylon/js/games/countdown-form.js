import { Form } from '../ui/widget/form.js';
import { VRSPACEUI } from '../ui/vrspace-ui.js';

/**
 * Countdown form bound to HUD.
 */
export class CountdownForm extends Form {
  /**
   * Creates the form with font size 128.
   * @param {number} count number to start counting from 
   */
  constructor(count) {
    super();
    this.fontSize = 128;
    this.count = count;
  }
  /** 
   * Initialize and display the form.
   * Hides HUD buttons, adds new HUD row, adds the form to the HUD, 
   * and positions it at the center of the screen. 
   */
  init() {
    this.createPanel();
    this.label = this.textBlock(" ");
    this.update(this.count);
    this.label.width = "256px";
    this.label.height = "256px";
    this.addControl(this.label);
    VRSPACEUI.hud.showButtons(false);
    VRSPACEUI.hud.newRow();
    VRSPACEUI.hud.addForm(this,256,128);
    this.plane.position.y += 0.1;
  }
  /**
   * Update the count
   * @param {number} count set new displayed value 
   */
  update(count) {
    // FIXME ugly way to justify right
    if ( count >= 10 ) {
      this.label.text = " "+count;
    } else {
      this.label.text = "  "+count;
    }
  }
  /**
   * Clean up, also removes the HUD row and shows buttons.
   */
  dispose() {
    super.dispose();
    VRSPACEUI.hud.clearRow();
    VRSPACEUI.hud.showButtons(true);
  }
}

