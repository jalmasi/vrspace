import { TextArea } from './text-area.js';
import { TextAreaInput } from './text-area-input.js';
import { VRSPACEUI } from './vrspace-ui.js';
import { Label } from './label.js';

class LinkStack {
  constructor(parent, position, scaling = new BABYLON.Vector3(.02,.02,.02)) {
    this.parent = parent;
    this.scaling = scaling;
    this.position = position;
    this.capacity = 5;
    this.buttons = [];
  }
  addButton(link){
    this.scroll();
    
    let pos = new BABYLON.Vector3(this.position.x+link.length/(Label.fontRatio*2)*this.scaling.x,this.position.y,this.position.z);
    let label = new Label("> "+link,pos,this.parent);
    //let label = new Label("> "+link,this.position,this.parent);
    label.background = "black";
    label.display();
    label.textPlane.scaling = this.scaling;
    
    this.buttons.push(label);
  }
  clicked(link) {
    console.log("Clicked "+link);
  }
  scroll() {
    if ( this.buttons.length == this.capacity ) {
      this.buttons[0].dispose();
      this.buttons.splice(0,1);
    }
    for ( let i = 0; i < this.buttons.length; i++ ) {
      let label = this.buttons[i];
      let y = label.textPlane.position.y + label.textPlane.scaling.y*1.5;
      label.textPlane.position = new BABYLON.Vector3( label.textPlane.position.x, y, label.textPlane.position.z );
    }
  }
}
/**
 * Chat log with TextArea and TextAreaInput, attached by to HUD. 
 * By default alligned to left side of the screen.
 */
export class ChatLog extends TextArea {
  constructor(scene) {
    super(scene, "ChatLog");
    this.input = new TextAreaInput(this, "Say");
    this.input.submitName = "send";
    this.inputPrefix = "ME";
    this.size = .3;
    this.baseAnchor = -.2;
    this.anchor = this.baseAnchor;
    this.leftSide();
    this.linkStack = new LinkStack(this.group, new BABYLON.Vector3(this.size/2*1.25,-this.size/2,0));
  }
  /**
   * Show both TextArea and TextAreaInput, and attach to HUD.
   */
  show() {
    super.show();
    this.input.inputPrefix = this.inputPrefix;
    this.input.init();
    this.handles.dontMinimize.push(this.input.plane);
    this.attachToHud();
    this.handleResize();
    this.resizeHandler = () => this.handleResize();
    window.addEventListener("resize", this.resizeHandler);
  }
  /**
   * Log something written by someone.
   * @param who who wrote that
   * @param what what they wrote
   */
  log( who, what ) {
    this.input.write(what,who);
  }
  attachToHud(){
    super.attachToHud();
    VRSPACEUI.hud.addAttachment(this.input.plane);
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
    //console.log("Aspect ratio: "+aspectRatio+" "+Math.sign(this.anchor));
    let diff = aspectRatio/2; // 2 being HD
    this.anchor = -this.baseAnchor * diff * Math.sign(this.anchor);
    this.moveToAnchor();
  }
  hasLink(line) {
    return line.indexOf("://") > -1 || line.indexOf('www.') > -1 ;
  }
  processLinks(line) {
    if ( this.showLinks && typeof(line) === "string" && this.hasLink(line)) {
      line.split(' ').forEach((word)=>{
        if ( this.hasLink(word) ) {
          this.showLink(word);
        }
      });
    }
  }
  showLink(link) {
    console.log("Link found: "+link);
    this.linkStack.addButton(link);
  }
  write(string) {
    this.processLinks(string);
    super.write(string);
  }
  /** Clean up */
  dispose() {
    VRSPACEUI.hud.removeAttachment(this.input.plane);
    window.removeEventListener("resize", this.resizeHandler);
    this.input.dispose();
    super.dispose();
  }
  /** XR pointer selection support */
  isSelectableMesh(mesh) {
    return super.isSelectableMesh(mesh) || this.input.isSelectableMesh(mesh);
  }
}