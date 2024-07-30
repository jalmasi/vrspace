import { VRSPACEUI } from '../vrspace-ui.js';
import { Form } from '../widget/form.js';

class PromptForm extends Form {
  constructor(callback) {
    super();
    this.callback = callback;
  }
  init() {
    this.createPanel();
    this.panel.addControl(this.textBlock("Prompt Metakraft:"));

    this.input = this.inputText('generate');
    //this.input.text = 'test'; // skip typing in VR
    this.panel.addControl(this.input);

    var enter = this.submitButton("submit", () => this.callback(this.input.text));
    this.panel.addControl(enter);

    //input.focus(); // not available in babylon 4
    this.speechInput.addNoMatch((phrases) => console.log('no match:', phrases));
    this.speechInput.start();
  }
}

export class ModelGenerator{
  constructor(scene,world) {
    this.scene = scene;
    this.world = world;
    this.contentBase = VRSPACEUI.contentBase;
    this.buttons = [];
  }
  show() {
    VRSPACEUI.hud.newRow(); // stops speech recognition
    this.generateButton = this.makeAButton("Generate", this.contentBase + "/content/icons/magic-wand.png", ()=>this.generate());
    this.refineButton = this.makeAButton("Refine", this.contentBase + "/content/icons/magic-wand.png", ()=>this.refine());
    this.styleButton = this.makeAButton("Style", this.contentBase + "/content/icons/magic-wand.png", ()=>this.style());
    this.rigButton = this.makeAButton("Rig", this.contentBase + "/content/icons/magic-wand.png", ()=>this.rig());
    this.animateButton = this.makeAButton("Animate", this.contentBase + "/content/icons/magic-wand.png", ()=>this.animate());
  }
  /**
   * Generate a 3d Model from prompt or image
   */
  generate() {
    if (this.form) {
      this.clearPrompt();
    } else {
      VRSPACEUI.hud.newRow(); // stops speech recognition
      this.form = new PromptForm((text) => this.doPrompt(text));
      this.form.init(); // starts speech recognition
      if (VRSPACEUI.hud.inXR()) {
        let texture = VRSPACEUI.hud.addForm(this.prompt, 1536, 512);
        this.form.keyboard(texture);
      } else {
        VRSPACEUI.hud.addForm(this.form, 1536, 64);
      }
    }
  }
  /**
   * Refine an existing model. Currently only supported for the 'advanced' quality models. Please note that refine process may take more than 10 mins
   */
  refine() {
  }
  /**
   * Style an existing model. Currently only supported for the 'advanced' quality models.
   * Allowed types: lego, voxel, voronoi
   */
  style() {
  }
  /**
   * Rig a model (IF riggable, that's another call)
   */
  rig() {
  }
  /**
   * Animate an existing model. Allowed types: walk, run, dive
   */
  animate() {
  }
  /**
   * Disposes of search form and displays HUD buttons
   */
  clearPrompt() {
    this.form.dispose(); // stops speech recognition
    delete this.prompt;
    VRSPACEUI.hud.clearRow(); // (re)starts speech recognition
    VRSPACEUI.hud.showButtons(true);
  }

  doPrompt(text) {
    this.world.loadingStart('generated object');
    let camera = this.scene.activeCamera;
    let pos = camera.position.add(camera.getForwardRay(1).direction);
    fetch( "/vrspace/api/metakraft/generate?prompt="+text+
      "&x="+pos.x+
      "&y="+pos.y+
      "&z="+pos.z, {
      method: "POST"
    }).then(res=>res.text().then(json=>console.log(json))).finally(()=>this.world.loadingStop('generated object'));
  }
   
  makeAButton(text, imageUrl, action) {
    var button = VRSPACEUI.hud.addButton(text, imageUrl, () => {
      VRSPACEUI.hud.showButtons(false, button);
      action();
    }, false);
    this.buttons.push(button);
    return button;
  }

  dispose() {
    if ( this.form ) {
      this.form.dispose(); // stops speech recognition
      delete this.form;
    }
    this.buttons = [];
    VRSPACEUI.hud.clearRow(); // (re)starts speech recognition
  }
}