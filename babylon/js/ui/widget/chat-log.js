import { TextArea } from './text-area.js';
import { TextAreaInput } from './text-area-input.js';
import { Label } from './label.js';
import { RemoteBrowser } from './remote-browser.js';
import { VRSpaceAPI } from './../../client/rest-api.js'
import { VRSPACEUI } from '../vrspace-ui.js';
import { ServerCapabilities } from '../../client/openapi/model/ServerCapabilities.js';

class ChatLogInput extends TextAreaInput {
  constructor(textArea, inputName = "Write", titleText = null) {
    super(textArea, inputName, titleText);
    this.attachments=false;
    this.attachButton = this.submitButton("attach", ()=>this.attach(), VRSPACEUI.contentBase+"/content/icons/attachment.png");
    this.attachButton.isVisible = false;
    //somehow gets overridden and becomes left:
    //this.attachButton.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.attachButton.background = this.background;
    this.attached = [];
    this.maxAttachments = 4;
  }
  init() {
    super.init();
    this.plane.position.y -= 0.02; 
  }
  createPanel() {
    super.createPanel();
    this.panel.width = 1;
    this.panel.heightInPixels = this.heightInPixels;
    
    this.parentPanel = new BABYLON.GUI.StackPanel('StackPanel-parent');
    this.parentPanel.isVertical = true;
    this.parentPanel.width = 1;
    this.parentPanel.heightInPixels = this.heightInPixels*4;
    
    this.attachmentsPanel = new BABYLON.GUI.StackPanel('StackPanel-attachments');
    this.attachmentsPanel.isVertical = false;
    // disables alignment for reasons unknown:
    //this.attachmentsPanel.widthInPixels = this.textArea.width*2;
    this.attachmentsPanel.widthInPixels = 64;
    this.attachmentsPanel.heightInPixels = this.heightInPixels;
    this.attachmentsPanel.addControl(this.attachButton);
    
    this.parentPanel.addControl(this.panel);
    this.parentPanel.addControl(this.attachmentsPanel);
  }
  createPlane(size, textureWidth, textureHeight, panel=this.panel) {
    super.createPlane(size,textureWidth, textureHeight, this.parentPanel);
  }
  inputFocused(input, focused) {
    super.inputFocused(input,focused);
    this.attachButton.isVisible = focused && this.attachments || this.attached.length > 0;
    if ( focused ) {
      console.log("Focused ", this.textArea);
      ChatLog.activeInstance = this.textArea;
    }
  }
  attach() {
    console.log("attach clicked");
    if ( this.attached.length >= this.maxAttachments ) {
      // TODO notify user
      return;
    }
    let input = document.createElement("input");
    input.setAttribute('type', 'file');
    input.setAttribute('style', 'display:none');
    document.body.appendChild(input);
    input.addEventListener("change", () => this.upload(input), false);
    input.addEventListener("cancel", () => this.upload(input), false);
    input.click();
  }
  upload(input){
    console.log("Files: ", input.files);
    document.body.removeChild(input);
    if ( input.files ) {
      this.attachmentsPanel.widthInPixels = this.textArea.width*2;
      for (let i = 0; i < input.files.length; i++) {
        const file = input.files[i];
        let fileName = file.name;
        let button = this.textButton(fileName,() => this.detach(button,fileName),VRSPACEUI.contentBase+"/content/icons/attachment.png", this.cancelColor);
        button.file = file;
        this.attachmentsPanel.addControl(button);
        this.attached.push(button);
      }
    }
    this.checkAttachments();
  }
  checkAttachments(){
    if ( this.attached.length == 0 ) {
      this.attachmentsPanel.widthInPixels = 64;
      this.attachButton.isVisible = false;
    }
  }
  detach(button,fileName) {
    this.attachmentsPanel.removeControl(button);
    this.attached.splice(this.attached.indexOf(button),1);
    button.dispose();
    this.checkAttachments();
  }
  getAttachments() {
    let ret = this.attached.map(button=>button.file);
    this.attached.forEach(button=>button.dispose());
    this.attached=[];
    return ret;
  }
}

class Link {
  constructor( text, enterWorld=false ) {
    this.url = text;
    this.enterWorld = enterWorld;
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
    this.buttons = [];
  }
  openHere(local) {
    if ( local ) {
      console.log("TODO: Enter the world like AvatarSelection.enterWorld does");
      let dest = URL.parse(this.url);
      window.location.href = window.location.pathname + dest.search;
    } else {
      window.location.href = this.url;
    }
  }
  openTab() {
    window.open(this.url, '_blank').focus();    
  }
  dispose() {
    this.label.dispose();
    this.buttons.forEach(b=>b.dispose());
  }
}

class LinkStack {
  /** @type {ServerCapabilities} */
  static serverCapablities = null;
  constructor(scene, parent, position, scaling = new BABYLON.Vector3(.02,.02,.02)) {
    this.scene = scene;
    this.parent = parent;
    this.scaling = scaling;
    this.position = position;
    this.capacity = 5;
    this.links = [];
    this.meshes = []; // XR selectables
    this.clickHandler = this.scene.onPointerObservable.add((pointerInfo) => {
      if ( pointerInfo.type == BABYLON.PointerEventTypes.POINTERDOWN
        && pointerInfo.pickInfo.hit
      ) {
        for ( let i = 0; i < this.links.length; i++ ) {
          if ( this.links[i].label.textPlane == pointerInfo.pickInfo.pickedMesh ) {
            this.clicked(this.links[i]);
            break;
          }
        }
      }
    });
    if ( LinkStack.serverCapablities == null ) {
      VRSpaceAPI.getInstance().endpoint.server.getServerCapabilities().then(c=>LinkStack.serverCapablities=c);
    }
  }
  
  // FIXME local is not used, enterWorld is always local
  addLink(word, enterWorld, local){
    let link = new Link(word, enterWorld);
    this.scroll();
    
    // add buttons to open in new tab, this tab, optionally internal browser
    if ( enterWorld ) {
      this.addButton(link, "enter", () => link.openHere(enterWorld));
    } else {
      this.addButton(link, "external-link", () => link.openTab());
      if (LinkStack.serverCapablities.remoteBrowser) {
        this.addButton(link, "play", () => this.openBrowser(link.url));
      }
    }

    let x = this.scaling.x*link.buttons.length+this.position.x+link.site.length/(Label.fontRatio*2)*this.scaling.x;
    let pos = new BABYLON.Vector3(x,this.position.y,this.position.z);
    let label = new Label(link.site,pos,this.parent);
    //label.background = "black";
    label.display();
    label.textPlane.scaling = this.scaling;
    link.label = label;
    
    this.links.push(link);
    this.meshes.push(label.textPlane);
    return link;
  }
  
  addButton(link, name, callback) {
    let button = BABYLON.GUI.Button.CreateImageOnlyButton(name+"-"+link.site, VRSPACEUI.contentBase+"/content/icons/"+name+".png");
    let buttonPlane = BABYLON.MeshBuilder.CreatePlane(name+"-"+link.site, {height:1,width:1});
    buttonPlane.parent = this.parent;
    buttonPlane.position = new BABYLON.Vector3(this.position.x + this.scaling.x*link.buttons.length,this.position.y,this.position.z);
    buttonPlane.scaling = this.scaling;
    let buttonTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(
      buttonPlane,
      128,
      128,
      false // mouse events disabled
    );
    buttonTexture.addControl(button);
    button.onPointerDownObservable.add( () => callback());
    link.buttons.push(buttonPlane);    
    this.meshes.push(buttonPlane);
  }
  
  /** @param {Link} link */
  async clicked(link) {
    // process invitations
    console.log("Clicked "+link.url);
    if ( link.enterWorld ) {
      // CHECKME
      link.openHere(true);
    } else if (LinkStack.serverCapablities.remoteBrowser) {
      this.openBrowser(link.url);
    } else {
      link.openTab();
    }
  }
  openBrowser(url) {
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
      this.links[i].buttons.forEach(b=>b.position.y = y );
    }
  }
  dispose() {
    this.scene.onPointerObservable.remove(this.clickHandler);
    this.links.forEach(l=>l.dispose());
    this.meshes = [];
    if ( this.browser ) {
      this.browser.dispose();
    }
  }
  isSelectableMesh(mesh) {
    return this.meshes.includes(mesh);
  }
}
/**
 * Chat log with TextArea and TextAreaInput, attached by to HUD. 
 * By default alligned to left side of the screen.
 */
export class ChatLog extends TextArea {
  static instanceCount = 0;
  static instances = {}
  /** @type {ChatLog} */
  static activeInstance = null;
  static instanceId(name, title) {
    return name+"_"+title;
  }
  /**
   * @param {string} title
   * @param {string} [name="ChatLog"] 
   * @return {ChatLog} 
   */
  static findInstance(title, name="ChatLog") {
    if ( ChatLog.instances.hasOwnProperty(ChatLog.instanceId(name,title)) ) {
      return ChatLog.instances[ChatLog.instanceId(name,title)];
    }
  }
  /**
   * @param {*} scene 
   * @param {string} title
   * @param {string} [name="ChatLog"] 
   * @return {ChatLog} 
   */
  static getInstance(scene, title="main", name="ChatLog") {
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
    // safe in both portrait and lanscape orientation on mobile an pc, just above hud buttons:
    this.verticalAnchor = 0.02;
    this.anchor = this.baseAnchor;
    this.leftSide();
    this.linkStack = new LinkStack(this.scene, this.group, new BABYLON.Vector3(this.size/2*1.25,-this.size/2,0));
    this.listeners = [];
    ChatLog.instanceCount++;
    ChatLog.instances[this.instanceId()] = this;
  }
  instanceId() {
    return ChatLog.instanceId(this.name, this.titleText);
  }
  /**
   * Show both TextArea and TextAreaInput, and attach to HUD.
   */
  show() {
    super.show();
    this.setActiveInstance();
    this.input.inputPrefix = this.inputPrefix;
    this.input.addListener( text => this.notifyListeners(text,null,this.input.getAttachments()) );
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
   * @param {String} who who wrote that
   * @param {String} what what they wrote
   * @param {object} link metadata of the link 
   */
  log( who, what, link, local ) {
    this.input.write(what,who);
    if ( link ) {
      this.showLink(link.link, true);
    }
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
    // 0.65 -> anchor 0.1 (e.g. smartphone vertical)
    // 2 -> anchor 0.4 (pc, smartphone horizontal)
    let diff = (aspectRatio-0.65)/1.35;
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
  showLink(word, enterWorld, local) {
    console.log("Link found: "+word);
    this.linkStack.addLink(word, enterWorld);
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
  notifyListeners(text,data,attachments) {
    this.listeners.forEach(l=>l(text, data, attachments));
  }
  /**
   * Add a listener to be called when input text is changed
   */
  addListener(listener) {
    this.listeners.push(listener);
  }
  /** Remove a listener */
  removeListener(listener) {
    let pos = this.listeners.indexOf(listener);
    if ( pos > -1 ) {
      this.listeners.splice(pos,1);
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
    return super.isSelectableMesh(mesh) || this.input.isSelectableMesh(mesh) || this.linkStack.isSelectableMesh(mesh);
  }
}