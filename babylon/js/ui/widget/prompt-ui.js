import { VRSPACEUI } from '../vrspace-ui.js';
import { ChatLog } from './chat-log.js';
import { LoadProgressIndicator } from '../load-progress-indicator.js';
import { World } from '../../world/world.js';
import { VRSpaceAPI } from '../../client/rest-api.js';
/**
 * Special chatlog customized for LLM prompt.
 */
export class PromptUI extends ChatLog {
  /**
   * @type {PromptUI}
   */
  static intance = null;
  static callback = null;
  static button = null;
  static title = "Search Prompt";
  static name = "Search Prompt";
  static inputName = "Query";
  constructor(world) {
    super(world.scene, PromptUI.title, PromptUI.name, PromptUI.inputName);
    this.world = world;
    this.baseAnchor = 0;
    this.anchor = 0;
    this.verticalAnchor = 0.05;
    this.distance = 0.15; // closer than space chatlog
    this.width = 1024;
    this.input.virtualKeyboardEnabled = this.world.inXR();
    this.autoHide = false;
    this.canClose = true;
    this.onClose = () => this.close();
    this.indicator = new LoadProgressIndicator(this.scene);
    this.indicator.animate();
  }

  static getInstance(world, callback, button) {
    if (PromptUI.instance == null) {
      PromptUI.instance = new PromptUI(world);
    }
    if (callback) {
      PromptUI.callback = callback;
    }
    if (button) {
      PromptUI.updateButton(button);
    }
    return PromptUI.instance;
  }

  show() {
    super.show();
    this.addListener((text, link, attachments) => {
      this.input.setEnabled(false);
      this.indicator.add("prompt");
      this.indicator.position = new BABYLON.Vector3(0, 0, 0.5);

      VRSpaceAPI.getInstance().endpoint.agents.searchAgent(text).then(response => {
        console.log(response);
        this.log('Search Agent', response.answer);
        this.indicator.remove("prompt");
        this.input.setEnabled(true);
        PromptUI.callback(response);
      }).catch(err => {
        this.input.setEnabled(true);
        console.error(err);
        this.indicator.remove("prompt");
        this.log('Search Agent', err.error.message);
      });
    });
    VRSPACEUI.hud.markActive(PromptUI.button);
  }

  close() {
    VRSPACEUI.hud.markEnabled(PromptUI.button);
    this.dispose();
    PromptUI.instance = null;
  }

  static showOrHide() {
    if (!PromptUI.instance) {
      // window closed, reopen it
      PromptUI.instance = new PromptUI(World.lastInstance);
    }
    if (!PromptUI.instance.visible) {
      PromptUI.instance.show();
      VRSPACEUI.hud.markActive(PromptUI.button);
    } else if (VRSPACEUI.hud.isActive(PromptUI.button)) {
      PromptUI.instance.close();
    }
  }

  static updateButton(button) {
    if (button) {
      if (PromptUI.button == null || PromptUI.button != button) {
        button.onPointerDownObservable.add(() => PromptUI.showOrHide());
        button.originalDispose = button.dispose;
        button.dispose=()=>{
          button.originalDispose();
          PromptUI.instance.hide(true);
        }
      }
      PromptUI.button = button;
      if (PromptUI.instance && PromptUI.instance.visible) {
        VRSPACEUI.hud.markActive(PromptUI.button);
      }
    }
  }
}