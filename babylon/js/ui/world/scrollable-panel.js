import { VRSPACEUI } from '../vrspace-ui.js';
import { TextWriter } from '../../core/text-writer.js';
import { TextArea } from '../widget/text-area.js';
import { SpeechInput } from '../../core/speech-input.js';

/**
 * A 3D panel displayed in the world, with arbitrary number of holographic buttons.
 * Each button must have text and image. Text is displayed when pointer is over the button,
 * and it can be either 3D (framerate impact) or texture (readability impact). This is controlled by
 * text3d property, false by default.
 */
export class ScrollablePanel {
  constructor(scene, name) {
    this.scene = scene;
    this.uiRoot = new BABYLON.TransformNode(name);
    this.text3d = false;

    this.uiRoot.position = new BABYLON.Vector3(0, 3, 0);
    this.uiRoot.rotation = new BABYLON.Vector3(0, 0, 0);
    this.uiRoot.scaling = new BABYLON.Vector3(.5, .5, .5);
    //this.guiManager = new BABYLON.GUI.GUI3DManager(this.scene); // causes transparency issues
    this.guiManager = VRSPACEUI.guiManager;
    this.panel = new BABYLON.GUI.CylinderPanel();
    this.panel.blocklayout = true; // optimization, requires updateLayout() call
    this.panel.margin = 0.05;
    this.panel.columns = 6;
    this.guiManager.addControl(this.panel);
    this.panel.linkToTransformNode(this.uiRoot);

    this.buttonPrev = new BABYLON.GUI.HolographicButton("prev");
    this.buttonPrev.imageUrl = VRSPACEUI.contentBase + "/content/icons/upload.png";
    this.guiManager.addControl(this.buttonPrev);
    this.buttonPrev.linkToTransformNode(this.uiRoot);
    this.buttonPrev.position = new BABYLON.Vector3(-4, 0, 4);
    this.buttonPrev.mesh.rotation = new BABYLON.Vector3(0, 0, Math.PI / 2);
    this.buttonPrev.mesh.isNearPickable = VRSPACEUI.allowHands;
    this.buttonPrev.tooltipText = "Previous";
    this.buttonPrev.isVisible = false;

    this.buttonNext = new BABYLON.GUI.HolographicButton("next");
    this.buttonNext.imageUrl = VRSPACEUI.contentBase + "/content/icons/upload.png";
    this.guiManager.addControl(this.buttonNext);
    this.buttonNext.linkToTransformNode(this.uiRoot);
    this.buttonNext.position = new BABYLON.Vector3(4, 0, 4);
    this.buttonNext.mesh.rotation = new BABYLON.Vector3(0, 0, -Math.PI / 2);
    this.buttonNext.mesh.isNearPickable = VRSPACEUI.allowHands;
    this.buttonNext.tooltipText = "Next";
    this.buttonNext.isVisible = false;

    // same material used for all buttons in this UI:
    this.buttonNext.backMaterial.alpha = .5;
    this.enableSpeech = SpeechInput.available();
    this.speechInput = null;
    if (this.enableSpeech) {
      this.panel.columns++;
      this.buttonPrev.position.x = -4.2;
      this.buttonNext.position.x = 4.4;
    }
    this.currentRow = 0;
    this.selectedButton = null;
  }

  /**
   * Relocate panel to given distance from the camera, by default 6
   */
  relocatePanel(distanceFromCamera = 6) {
    var forwardDirection = VRSPACEUI.hud.camera.getForwardRay(distanceFromCamera).direction;
    this.uiRoot.position = VRSPACEUI.hud.camera.position.add(forwardDirection);
    this.uiRoot.rotation = new BABYLON.Vector3(VRSPACEUI.hud.cameraRotation().x, VRSPACEUI.hud.cameraRotation().y, VRSPACEUI.hud.cameraRotation().z);
  }

  /**
   * Call this before consecutive addButton calls.
   * @param hasPrevious true if previous button is to be rendered
   * @param hasNext true if next button is to be rendered
   * @param onPrevious callback to be executed when previous button is activated
   * @param onNext callback to be executed when next button is activated
   */
  beginUpdate(hasPrevious, hasNext, onPrevious, onNext) {
    // workaround for panel buttons all messed up
    this.previousCoord = { pos: this.uiRoot.position, rot: this.uiRoot.rotation };
    this.uiRoot.position = new BABYLON.Vector3(0, 2, 0);
    this.uiRoot.rotation = new BABYLON.Vector3(0, 0, 0);
    this.panel.linkToTransformNode();

    let controls = this.panel.children.slice();
    controls.forEach((button) => {
      this.panel.removeControl(button); 
      button.dispose();
    });

    this.buttonPrev.isVisible = hasPrevious;
    this.buttonPrev.onPointerDownObservable.clear();
    this.buttonPrev.onPointerDownObservable.add(onPrevious);

    this.buttonNext.isVisible = hasNext;
    this.buttonNext.onPointerDownObservable.clear();
    this.buttonNext.onPointerDownObservable.add(onNext);

    if (this.speechInput) {
      this.speechInput.dispose();
      this.speechInput = null;
    }
    if (this.enableSpeech) {
      this.speechInput = new SpeechInput();
      this.speechInput.addNoMatch((phrases) => console.log('no match:', phrases));
      if (hasNext) {
        this.speechInput.addCommand("next", () => onNext());
      }
      if (hasPrevious) {
        this.speechInput.addCommand("previous", () => onPrevious());
      }
      // button in the bottom-left corner
      this.cornerButton = this.makeLabel("get");
      this.cornerButton.isVisible = false;
      this.speechInput.addCommand("get", () => {
        if (this.selectedButton) {
          this.selectedButton.onPointerDownObservable.observers.forEach(observer => observer.callback(this.selectedButton));
          this.selectedButton.onPointerOutObservable.observers.forEach(observer => observer.callback())
          this.selectedButton = null;
          this.cornerButton.isVisible = false;
        }
      });
      // column buttons
      for (let i = 1;i < this.panel.columns;i++) {
        let char = String.fromCharCode(64 + i);
        this.makeLabel(char);
        this.speechInput.addCommand(char, (value) => {
          console.log("Selected button "+char+value);
          this.selectedButton = this.getButtonAt(value,char);
          if (this.selectedButton) {
            this.selectedButton.onPointerOutObservable.observers.forEach(observer => observer.callback())
            this.selectedButton.onPointerEnterObservable.observers.forEach(observer => observer.callback())
            this.cornerButton.isVisible = true;
          }
        },
        "*value");
      }
      this.currentRow = 1;
    }
  }

  makeLabel(char) {
    let button = new BABYLON.GUI.HolographicButton(char);
    this.panel.addControl(button);

    var text = new BABYLON.GUI.TextBlock();
    text.text = char;
    text.color = "white";
    text.fontSize = 96;
    button.content = text;

    button.plateMaterial.disableLighting = true;
    button.mesh.scaling = new BABYLON.Vector3(.5, .5, .5);
    return button;    
  }
  
  getButtonAt(row,col) {
    // CHECKME: requires side buttons
    let colNumber = col.charCodeAt(0)-64; 
    let rowNumber = parseInt(row);
    let index = rowNumber*this.panel.columns + colNumber;
    return this.panel.children[index];
  }
  
  /**
   * Call this after all buttons are added. Optionally relocates the panel.
   */
  endUpdate(relocate) {
    this.panel.linkToTransformNode(this.uiRoot);
    this.panel.updateLayout();
    if (relocate) {
      this.relocatePanel();
    } else {
      this.uiRoot.position = this.previousCoord.pos;
      this.uiRoot.rotation = this.previousCoord.rot;
    }
    if (this.enableSpeech) {
      this.speechInput.start();
    }
  }

  /**
   * Create and add a holographic button to the panel.
   * @param {string|array} text to be rendered on pointer over, String or array of String
   * @param {string} image url to display over the button
   * @param {*} callback function called on pointer down, takes the button as the argument
   */
  addButton(text, image, callback) {
    if (typeof (text) === "string") {
      text = [text];
    }

    if (this.enableSpeech && this.panel.children.length % this.panel.columns == 0) {
      this.makeLabel("" + this.currentRow);
      this.currentRow++;
    }
    var button = new BABYLON.GUI.HolographicButton(text[0]);
    this.panel.addControl(button);
    button.mesh.isNearPickable = VRSPACEUI.allowHands;

    button.imageUrl = image;

    button.plateMaterial.disableLighting = true;

    button.content.scaleX = 2;
    button.content.scaleY = 2;

    button.onPointerEnterObservable.add(() => {
      this.buttonTextWrite(button.node, text);
    });
    button.onPointerOutObservable.add(() => {
      this.buttonTextClear(button.node);
    });
    button.onPointerDownObservable.add(() => callback(button));
  }

  /**
   * Clear the panel - remove all buttons
   */
  clear() {
    this.panel.children.forEach((button) => { button.dispose() });
  }
  /**
   * Internally called to show tooltip text on pointer enter
   */
  buttonTextWrite(node, lines) {
    if (this.text3d) {
      if (!this.writer) {
        this.writer = new TextWriter(this.scene);
      }
      this.writer.writeArray(node, lines);
    } else {
      if (!this.textArea) {
        this.textArea = new TextArea(this.scene);
        this.textArea.addHandles = false;
        this.textArea.size = 1;
        this.textArea.addBackground = false;
        this.textArea.height = 128;
        this.textArea.width = 256;
        this.textArea.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        this.textArea.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
        this.textArea.position = new BABYLON.Vector3(0, 1, -.2);
        this.textArea.show();
      }
      this.textArea.group.parent = node;
      this.textArea.writeArray(lines);
    }
  }
  /**
   * Internally called to remove tooltip on pointer exit
   */
  buttonTextClear(node) {
    if (this.text3d) {
      this.writer.clear(node);
    } else if (this.textArea) {
      this.textArea.dispose();
      this.textArea = null;
    }
    if (this.cornerButton && this.cornerButton.isVisible) {
      this.cornerButton.isVisible = false;
    }
  }

  /**
   * Clean up
   */
  dispose() {
    if (this.textArea) {
      this.textArea.dispose();
    }
    if (this.writer) {
      // currently we can't dispose of writer
      //this.writer.dispose();
    }
    if (this.speechInput) {
      this.speechInput.dispose();
    }
    this.buttonPrev.dispose();
    this.buttonNext.dispose();
    this.panel.dispose();
  }
}