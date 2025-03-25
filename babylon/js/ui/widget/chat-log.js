import { TextArea } from './text-area.js';
import { TextAreaInput } from './text-area-input.js';
import { Label } from './label.js';
import { RemoteBrowser } from './remote-browser.js';

class ChatLogInput extends TextAreaInput {
  inputFocused(input, focused) {
    super.inputFocused(input,focused);
    if ( focused ) {
      console.log("Focused ", this.textArea);
      ChatLog.activeInstance = this.textArea;
    }
  }
}

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
    //this.browser.attachToCamera();
    this.browser.attachToHud();
    if ( url.toLowerCase().endsWith(".jpg") || url.toLowerCase().endsWith(".jpg") ) {
      this.browser.loadUrl(url);
    } else {
      this.browser.get(url);
    }
  }
  scroll() {
    if ( this.links.length == this.capacity ) {
      this.links[0].dispose();
      let link = this.links.splice(0,1)[0];
      link.dispose();
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
  static instanceCount = 0;
  static instances = {}
  static activeInstance = null;
  static instanceId(name, title) {
    return name+":"+title;
  }
  /** @return {ChatLog} */
  static findInstance(title, name="ChatLog") {
    if ( ChatLog.instances.hasOwnProperty(ChatLog.instanceId(name,title)) ) {
      return ChatLog.instances[ChatLog.instanceId(name,title)];
    }
  }
  static getInstance(scene, title, name="ChatLog") {
    if ( ChatLog.instances.hasOwnProperty(ChatLog.instanceId(name,title)) ) {
      return ChatLog.instances[ChatLog.instanceId(name,title)];
    }
    return new ChatLog(scene, title, name);
  }
  constructor(scene, title, name="ChatLog") {
    super(scene, name, title);
    if ( ChatLog.instances.hasOwnProperty(this.instanceId()) ) {
      throw "Instance already exists: "+this.instanceId();
    }
    this.input = new ChatLogInput(this, "Say", title);
    this.input.submitName = "send";
    this.input.showNoMatch = false;
    this.inputPrefix = "ME";
    this.showLinks = true;
    this.minimizeInput = false;
    this.minimizeTitle = true;
    this.autoHide = true;
    this.size = .3;
    this.baseAnchor = -.4;
    this.verticalAnchor = -.1;
    //this.baseAnchor = 0;
    this.anchor = this.baseAnchor;
    this.leftSide();
    this.linkStack = new LinkStack(this.scene, this.group, new BABYLON.Vector3(this.size/2*1.25,-this.size/2,0));
    ChatLog.instanceCount++;
    ChatLog.instances[this.instanceId()] = this;
  }
  instanceId() {
    return this.name+":"+this.titleText;
  }
  /**
   * Show both TextArea and TextAreaInput, and attach to HUD.
   */
  show() {
    super.show();
    this.setActiveInstance();
    this.input.inputPrefix = this.inputPrefix;
    // order matters: InputArea.init() shows the title, so call hide after
    this.input.init();
    if ( this.handles ) {
      if ( !this.minimizeInput ) {
        this.handles.dontMinimize.push(this.input.plane);
      }
      if ( this.title && !this.minimizeTitle ) {
        this.handles.dontMinimize.push(this.title.textPlane);
        // reposition the title
        this.handles.onMinMax = (minimized) => {
          if ( minimized ) {
            this.title.position.y = -1.2 * this.size/2 + this.title.height/2;
            this.clearActiveInstance();
          } else {
            // CHECKME: copied from TextArea.showTitle:
            this.title.position.y = 1.2 * this.size/2 + this.title.height/2;
            this.setActiveInstance();
          }
        };
      } else {
        this.handles.onMinMax = (minimized) => {
          if ( minimized ) {
            this.clearActiveInstance();
          } else {
            this.setActiveInstance();
          }
        };
      }
    }
    this.hide(this.autoHide);
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
    //this.position = new BABYLON.Vector3(this.anchor, this.size/2-.025, 0);
    this.position = new BABYLON.Vector3(this.anchor, this.size/2+this.verticalAnchor, 0.2);
    this.group.position = this.position;
  }
  /**
   * Handle window resize, recalculates the current anchor and positions appropriatelly.
   */
  handleResize() {
    let aspectRatio = this.scene.getEngine().getAspectRatio(this.scene.activeCamera);
    // 0.67 -> anchor 0.1 (e.g. smartphone vertical)
    // 2 -> anchor 0.4 (pc, smartphone horizontal)
    let diff = (aspectRatio-0.67)/1.33;
    //this.anchor = -this.baseAnchor * diff * Math.sign(this.anchor);
    this.anchor = this.baseAnchor * diff;
    //console.log("Aspect ratio: "+aspectRatio+" anchor "+Math.sign(this.anchor)+" "+this.anchor+" base "+this.baseAnchor+" diff "+diff);
    this.moveToAnchor();
  }
  hasLink(line) {
    // TODO improve link detection
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
    this.hide(false);
  }
  setActiveInstance() {
    ChatLog.activeInstance = this;
    console.log("Focused ", this);
 }
  clearActiveInstance() {
    if ( ChatLog.activeInstance == this ) {
      console.log("Focus removed from ", this);
      ChatLog.activeInstance = null;
    }
  }
  /** Clean up */
  dispose() {
    window.removeEventListener("resize", this.resizeHandler);
    this.input.dispose();
    super.dispose();
    this.linkStack.dispose();
    this.clearActiveInstance();
    delete ChatLog.instances[this.instanceId()];
    ChatLog.instanceCount--;
  }
  /** XR pointer selection support */
  isSelectableMesh(mesh) {
    return super.isSelectableMesh(mesh) || this.input.isSelectableMesh(mesh);
  }
}