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
  static agent='sceneAgent';
  static agents={
    searchAgent:{
      title:"Search Prompt",
      name: "Search Prompt",
      inputName :"Query",
      endpoint:q=>VRSpaceAPI.getInstance().endpoint.agents.searchAgent(q)
    },
    sceneAgent:{
      title:"Scene Prompt",
      name: "Scene Prompt",
      inputName :"Query",
      endpoint:q=>VRSpaceAPI.getInstance().endpoint.agents.sceneAgent(q)
    }
  }
  
  constructor(world, agent) {
    super(world.scene, PromptUI.agents[agent].title, PromptUI.agents[agent].name, PromptUI.agents[agent].inputName);
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
    this.indicator.position = new BABYLON.Vector3(0,0,0);
    this.indicator.xrPosition = new BABYLON.Vector3(0,0,0);
  }

  createHandles() {
    super.createHandles();
    this.handles.dontMinimize.push(this.indicator.mesh);
  }
  
  static getInstance(world, agent=PromptUI.agent, callback, button) {
    PromptUI.agent=agent;
    if (PromptUI.instance == null) {
      PromptUI.instance = new PromptUI(world, agent)
    } else {
      PromptUI.instance.titleText = PromptUI.agents[agent].title;
      PromptUI.instance.showTitle();
      PromptUI.instance.name = PromptUI.agents[agent].name; // does not matter
      PromptUI.instance.input.block.text = PromptUI.agents[agent].inputName;
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
      this.indicator.animate();
      this.indicator.mesh.parent = this.areaPlane; 

      PromptUI.agents[PromptUI.agent].endpoint(text).then(response => {
        console.log(response);
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
      PromptUI.instance = new PromptUI(World.lastInstance, PromptUI.agent);
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