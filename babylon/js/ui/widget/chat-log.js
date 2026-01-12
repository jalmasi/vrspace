import { TextArea } from './text-area.js';
import { TextAreaInput } from './text-area-input.js';
import { ButtonStack } from './button-stack.js';
import { GroupMessage } from '../../client/vrspace.js';
import { VRSpaceAPI } from '../../client/rest-api.js';
import { GroupsApi } from '../../client/openapi/api/GroupsApi.js';
import { VRSPACEUI } from '../vrspace-ui.js';
import { World } from '../../world/world.js';

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
    // we don't want to send a message when focus is lost:
    this.inputFocusListener = null;
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
   * @param {string} [inputName="Say"] 
   * @return {ChatLog} 
   */
  static getInstance(scene, title="main", name="ChatLog", inputName) {
    if ( ChatLog.instances.hasOwnProperty(ChatLog.instanceId(name,title)) ) {
      return ChatLog.instances[ChatLog.instanceId(name,title)];
    }
    return new ChatLog(scene, title, name, inputName);
  }
  constructor(scene, title, name="ChatLog", inputName="Say") {
    super(scene, name, title);
    if ( ChatLog.instances.hasOwnProperty(this.instanceId()) ) {
      throw "Instance already exists: "+this.instanceId();
    }
    this.input = new ChatLogInput(this, inputName, title);
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
    this.buttonStack = new ButtonStack(this.scene, this.group, new BABYLON.Vector3(this.size/2*1.25,-this.size/2,0));
    // TODO document listener arguments
    this.listeners = [];
    ChatLog.instanceCount++;
    ChatLog.instances[this.instanceId()] = this;
    /** @type {GroupsApi} */
    this.groupApi = VRSpaceAPI.getInstance().endpoint.groups;
    this.selectionPredicate = (mesh) => this.isSelectableMesh(mesh);
  }
  instanceId() {
    return ChatLog.instanceId(this.name, this.titleText);
  }
  /**
   * Show both TextArea and TextAreaInput, and attach to HUD.
   */
  show() {
    if ( this.visible ) {
      return;
    }
    super.show();
    World.lastInstance.addSelectionPredicate(this.selectionPredicate);
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
   * CHECKME this may make things easier but introduces dependency on the client
   * @param {GroupMessage} groupMessage 
   */
  addAttachment(groupMessage) {
    let content = groupMessage.attachments[groupMessage.attachments.length-1];
    this.buttonStack.addAttachment(content.fileName, () => {
      console.log("Attachment callback group "+groupMessage.group.id+" msg "+groupMessage.id);
      VRSpaceAPI.getInstance().downloadAttachment(groupMessage.group.id,groupMessage.id,content.fileName);
      /*
      this.groupApi.getAttachment(groupMessage.group.id,groupMessage.id,content.fileName).then(
        ()=>console.log("TODO download attachment")
      ).catch(
        ()=>console.log("TODO download attachment failed")        
      );
      */
    });
  }
  
  /**
   * CHECKME this may make things easier but introduces dependency on the client
   * @param {GroupMessage} groupMessage 
   */
  logMessage(groupMessage) {
    this.log(groupMessage.from.name, groupMessage.content, groupMessage.link);
    if ( groupMessage.attachments ) {
      this.addAttachment(groupMessage);
    }
  }
  
  /**
   * Log something written by someone.
   * @param {String} who who wrote that
   * @param {String} what what they wrote
   * @param {object} link world link
   * @param {boolean} local FIXME not used  
   */
  log( who, what, link, local ) {
    this.input.write(what,who);
    if ( link ) {
      // FIXME: called from ListGroupsForm, twice
      // CHECKME: where this metadata idea comes from?
      this.showLink(link, true);
      //this.showLink(link.link, true);
    }
  }
  /**
   * Attach chatlog to the HUD
   */
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
    // TODO parameterize this Z    
    this.position = new BABYLON.Vector3(this.anchor, this.size/2+this.verticalAnchor, 0.2);
    this.group.position = this.position;
  }
  /**
   * Handle window resize, recalculates the current anchor and positions appropriatelly.
   * @private
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
  /** @private */
  hasLink(line) {
    // TODO improve link detection
    return line.indexOf("://") > -1 || line.indexOf('www.') > -1 ;
  }
  /** @private */
  processLinks(line) {
    if ( this.showLinks && typeof(line) === "string" && this.hasLink(line)) {
      line.split(' ').forEach((word)=>{
        if ( this.hasLink(word) ) {
          this.showLink(word);
        }
      });
    }
  }
  /** @private */
  showLink(word, enterWorld) {
    console.log("Link found: "+word);
    this.buttonStack.addLink(word, enterWorld);
  }
  /**
   * Internally called on text input.
   */
  write(string) {
    this.processLinks(string);
    super.write(string);
    this.hide(false);
  }
  /** @private */
  setActiveInstance() {
    ChatLog.activeInstance = this;
    console.log("Focused ", this);
  }
  /** @private */
  clearActiveInstance() {
    if ( ChatLog.activeInstance == this ) {
      console.log("Focus removed from ", this);
      ChatLog.activeInstance = null;
    }
  }
  
  /**
   * Share a world: notifies all the listeners (world or group) with the world name, content and link
   */
  shareWorld(worldName, href) {
    this.notifyListeners(worldName, href);
  }
  
  /**
   * Notify all chatlog listeners that the text has changed.
   * @private
   */
  notifyListeners(text,link,attachments) {
    this.listeners.forEach(l=>l(text, link, attachments));
  }
  
  /**
   * Add a listener to be called when input text is changed.
   * Listeners are current world, groups, i.e. whatever this chat is for.
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
    World.lastInstance.removeSelectionPredicate(this.selectionPredicate);
    window.removeEventListener("resize", this.resizeHandler);
    this.input.dispose();
    super.dispose();
    this.buttonStack.dispose();
    this.clearActiveInstance();
    delete ChatLog.instances[this.instanceId()];
    ChatLog.instanceCount--;
  }
  
  /** XR pointer selection support */
  isSelectableMesh(mesh) {
    return super.isSelectableMesh(mesh) || this.input.isSelectableMesh(mesh) || this.buttonStack.isSelectableMesh(mesh);
  }
}