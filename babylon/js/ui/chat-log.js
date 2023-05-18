import { TextArea } from './text-area.js';
import { TextAreaInput } from './text-area-input.js';
import { VRSPACEUI } from './vrspace-ui.js';
import { Label } from './label.js';
import { RemoteBrowser } from './remote-browser.js';

class Link {
  constructor( text ) {
    this.url = text;
    let pos = text.indexOf("://");
    if ( pos > 0 ) {
      text = text.substring(pos+3);
    } else {
      this.url = "https://"+this.url;
    }
    pos = text.indexOf("/");
    if ( pos > 0 ) {
      this.site = text.substring(0,pos);
    } else {
      this.site = text;
    }
    console.log('new link: '+this.url+" "+this.site);
    this.label = null;
  }
  dispose() {
    this.label.dispose();
  }
}
class LinkStack {
  constructor(scene, parent, position, scaling = new BABYLON.Vector3(.02,.02,.02)) {
    this.scene = scene;
    this.parent = parent;
    this.scaling = scaling;
    this.position = position;
    this.capacity = 5;
    this.links = [];
    this.clickHandler = this.scene.onPointerObservable.add((pointerInfo) => {
      if ( pointerInfo.type == BABYLON.PointerEventTypes.POINTERDOWN
        && pointerInfo.pickInfo.hit
      ) {
        for ( let i = 0; i < this.links.length; i++ ) {
          if ( this.links[i].label.textPlane == pointerInfo.pickInfo.pickedMesh ) {
            this.clicked(this.links[i].url);
            break;
          }
        }
      }
    });
  }
  addLink(word){
    let link = new Link(word);
    this.scroll();
    
    let pos = new BABYLON.Vector3(this.position.x+link.site.length/(Label.fontRatio*2)*this.scaling.x,this.position.y,this.position.z);
    let label = new Label("> "+link.site,pos,this.parent);
    //label.background = "black";
    label.display();
    label.textPlane.scaling = this.scaling;
    link.label = label;
    
    this.links.push(link);
  }
  clicked(url) {
    console.log("Clicked "+url);
    if ( this.browser ) {
      this.browser.dispose();
    }
    this.browser = new RemoteBrowser(this.scene);
    this.browser.show();
    this.browser.attachToCamera();
    if ( url.toLowerCase().endsWith(".jpg") || url.toLowerCase().endsWith(".jpg") ) {
      this.browser.loadUrl(url);
    } else {
      this.browser.get(url);
    }
  }
  scroll() {
    if ( this.links.length == this.capacity ) {
      this.links[0].dispose();
      this.links.splice(0,1);
    }
    for ( let i = 0; i < this.links.length; i++ ) {
      let label = this.links[i].label;
      let y = label.textPlane.position.y + label.textPlane.scaling.y*1.5;
      label.textPlane.position = new BABYLON.Vector3( label.textPlane.position.x, y, label.textPlane.position.z );
    }
  }
  dispose() {
    this.scene.onPointerObservable.remove(this.clickHandler);
    this.links.forEach(l=>l.dispose());
    if ( this.browser ) {
      this.browser.dispose();
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
    this.showLinks = true;
    this.size = .3;
    this.baseAnchor = -.2;
    this.anchor = this.baseAnchor;
    this.leftSide();
    this.linkStack = new LinkStack(this.scene, this.group, new BABYLON.Vector3(this.size/2*1.25,-this.size/2,0));
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
  showLink(word) {
    console.log("Link found: "+word);
    this.linkStack.addLink(word);
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
    this.linkStack.dispose();
  }
  /** XR pointer selection support */
  isSelectableMesh(mesh) {
    return super.isSelectableMesh(mesh) || this.input.isSelectableMesh(mesh);
  }
}