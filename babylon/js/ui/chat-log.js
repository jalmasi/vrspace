import { TextArea } from './text-area.js';
import { TextAreaInput } from './text-area-input.js';

/**
 * Chat log with TextArea and TextAreaInput, attached by to HUD. 
 * By default alligned to left side of the screen.
 */
export class ChatLog extends TextArea {
  constructor(scene) {
    super(scene, "ChatLog");
    this.input = new TextAreaInput(this);
    this.input.submitName = "send";
    this.inputPrefix = "ME";
    this.size = .3;
    this.baseAnchor = -.2;
    this.anchor = this.baseAnchor;
    this.leftSide();
  }
  /**
   * Show both TextArea and TextAreaInput, and attach to HUD.
   */
  show() {
    super.show();
    this.attachToHud();
    this.input.inputPrefix = this.inputPrefix;
    this.input.init();
    this.resizeHandler = () => this.handleResize();
    window.addEventListener("resize", this.resizeHandler);
  }
  /**
   * Move to left side of the screen
   */
  leftSide() {
    this.anchor = - Math.abs(this.anchor);
    this.moveToAnchor();
  }
  /**
   * Move to right side of the screen
   */
  rightSide() {
    this.anchor = Math.abs(this.anchor);
    this.moveToAnchor();
  }
  /**
   * Move either left or right, whatever is the current anchor
   */
  moveToAnchor() {
    this.position = new BABYLON.Vector3(this.anchor, this.size/2, 0);
    this.group.position = this.position;
  }
  /**
   * Handle window resize, recalculates the current anchor and positions appropriatelly.
   */
  handleResize() {
    let aspectRatio = this.scene.getEngine().getAspectRatio(this.scene.activeCamera);
    console.log("Aspect ratio: "+aspectRatio);
    let diff = aspectRatio/2; // 2 being HD
    this.anchor = this.baseAnchor * diff * Math.sign(this.anchor);
    this.moveToAnchor();
  }
  /** Clean up */
  dispose() {
    window.removeEventListener("resize", this.resizeHandler);
    this.input.dispose();
    super.dispose();
  }
  /** XR pointer selection support */
  isSelectableMesh(mesh) {
    return super.isSelectableMesh(mesh) || this.input.isSelectableMesh(mesh);
  }
}