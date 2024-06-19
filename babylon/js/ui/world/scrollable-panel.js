import { VRSPACEUI } from '../vrspace-ui.js';
import { TextWriter } from '../../core/text-writer.js';
import { TextArea } from '../widget/text-area.js';

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
    this.buttonPrev.tooltipText = "Previous";
    this.buttonPrev.isVisible = false;

    this.buttonNext = new BABYLON.GUI.HolographicButton("next");
    this.buttonNext.imageUrl = VRSPACEUI.contentBase + "/content/icons/upload.png";
    this.guiManager.addControl(this.buttonNext);
    this.buttonNext.linkToTransformNode(this.uiRoot);
    this.buttonNext.position = new BABYLON.Vector3(4, 0, 4);
    this.buttonNext.mesh.rotation = new BABYLON.Vector3(0, 0, -Math.PI / 2);
    this.buttonNext.tooltipText = "Next";
    this.buttonNext.isVisible = false;

    // same material used for all buttons in this UI:
    this.buttonNext.backMaterial.alpha = .5;
  }

  /**
   * Relocate panel to given distance from the camera, by default 6
   */
  relocatePanel(distanceFromCamera = 6) {
    var forwardDirection = VRSPACEUI.hud.camera.getForwardRay(distanceFromCamera).direction;
    this.uiRoot.position = VRSPACEUI.hud.camera.position.add(forwardDirection);
    this.uiRoot.rotation = new BABYLON.Vector3(VRSPACEUI.hud.camera.rotation.x, VRSPACEUI.hud.camera.rotation.y, VRSPACEUI.hud.camera.rotation.z);
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

    this.panel.children.forEach((button) => { button.dispose() });

    this.buttonPrev.isVisible = hasPrevious;
    this.buttonPrev.onPointerDownObservable.clear();
    this.buttonPrev.onPointerDownObservable.add(onPrevious);

    this.buttonNext.isVisible = hasNext;
    this.buttonNext.onPointerDownObservable.clear();
    this.buttonNext.onPointerDownObservable.add(onNext);

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
  }

  /**
   * Create and add a holographic button to the panel.
   * @param text to be rendered on pointer over, String or array of String
   * @param image url to display over the button
   * @param callback function called on pointer down, takes the button as the argument
   */
  addButton(text, image, callback) {
    if (typeof (text) === "string") {
      text = [text];
    }

    var button = new BABYLON.GUI.HolographicButton(text[0]);
    this.panel.addControl(button);

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
   * Internally called to show tooltip text on pointer enter
   */
  buttonTextWrite(node, lines) {
    if (this.text3d) {
      if ( ! this.writer ) {
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
  }

  /**
   * Clean up
   */
  dispose() {
    if ( this.textArea ) {
      this.textArea.dispose();
    }
    if ( this.writer ) {
      // currently we can't dispose of writer
      //this.writer.dispose();
    }
    this.buttonPrev.dispose();
    this.buttonNext.dispose();
    this.panel.dispose();
  }
}