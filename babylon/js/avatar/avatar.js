import { TextWriter } from '../core/text-writer.js';
import { EmojiParticleSystem } from '../ui/world/emoji-particle-system.js';
import { Label } from '../ui/widget/label.js';
import { TextArea } from '../ui/widget/text-area.js';
import { VRSPACEUI } from '../ui/vrspace-ui.js';
import { User } from '../client/vrspace.js';
import { WorldManager } from '../core/world-manager.js';
import { VRObject } from '../client/vrspace.js';

/**
 * Base avatar class, provides common methods for actual humanoid/video/mesh avatars
 * @abstract
 */
export class Avatar {
  /** Whether to display the name above the head, default true 
   * @static*/
  static displayName = true;
  /** Should written/spoken text be displayed above the head, default true 
   * @static*/
  static displayText = true;
  /** Should we use 3d text (as opposed to Label and TextArea) - performance penalty 
   * @static  */
  static use3dText = false;
  /**
  @param scene
  @param folder ServerFolder with the content
  @param shadowGenerator optional to cast shadows
   */
  constructor(scene) {
    // parameters
    this.scene = scene;
    /** Name of the avatar/user */
    this.name = null;
    /** Height of the user, default 1.8 */
    this.userHeight = 1.8;
    /** Distance for text above the avatar */
    this.textOffset = 0.4;
    /** Animation frames per second, default 10 */
    this.fps = 5;
    this.humanoid = false;
    this.video = false;
    /** Original root mesh of the avatar, used to scale the avatar */
    /** Whether to display the name above the head, defaults to value of static displayName */
    this.displayName = this.constructor.displayName;
    /** Should written/spoken text be displayed above the head, defaults to value of static displayText */
    this.displayText = this.constructor.displayText;
    /** Should 3d text be used for name/spoken text, defaults to value of static use3dText */
    this.use3dText = this.constructor.use3dText;
    if ( this.displayName || this.displayText ) {
      if ( this.use3dText ) {
        this.writer = new TextWriter(this.scene);
        this.writer.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
      } else {
        this.nameLabel = null;
      }
    }
    this.emojiParticleSystem = null;
    /** Custom nodes to be disposed when this avatar is disposed */
    this.attachments={};
  }

  /** 
  Set the name and display it above the avatar. The avatar needs to be displayed first.
  @param name 
  */
  async setName(name) {
    if ( this.displayName ) {
      if ( this.use3dText && this.writer ) {
        this.writer.clear(this.baseMesh());
        this.writer.relativePosition = this.textPositionRelative();
        this.writer.write(this.baseMesh(), name);
      } else {
        if ( this.nameLabel) {
          this.nameLabel.dispose();
        }
        if ( this.textArea ) {
          this.textArea.titleText = name;
          this.textArea.showTitle();
        } else if (name) {
          this.nameLabel = new Label(name, this.textPositionRelative(), this.baseMesh());
          this.nameLabel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
          this.nameLabel.height = .2;
          this.nameLabel.display();
          //this.nameLabel.textPlane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;
          this.nameLabel.textPlane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
        }
      }
    }
    this.name = name;
  }

  processText(text, limit, lines = []) {
    let line = '';
    text.split(' ').forEach((word) => {
      if ( line.length + word.length > limit ) {
        lines.push(line);
        line = '';
      }
      line += word + ' ';
    });
    lines.push(line);
    return lines;
  }
  /**
   * Write locally generated text, used internally
   * @param wrote text to write above the head
   */
  async write( wrote ) {
    let text = wrote;
    if ( typeof wrote == 'object') {
      text = wrote.text;
      // wrote.link ignored
    }
    if ( this.displayText ) {
      if ( this.use3dText && this.writer ) {
        let lines = this.processText(text, 20, [this.name]);
        this.writer.clear(this.baseMesh());
        this.writer.relativePosition = this.textPositionRelative().add( new BABYLON.Vector3(0,.2*(lines.length-1),0) );
        this.writer.writeArray(this.baseMesh(), lines);
      } else {
        if ( this.nameLabel ) {
          this.nameLabel.dispose();
        }
        if ( this.textArea ) {
          this.textArea.dispose();
        }
        this.textArea = new TextArea(this.scene, this.name+'-TextArea',this.displayName?this.name:null);
        this.textArea.addHandles = false;
        let lines = this.processText(text, 32, []);
        this.textArea.height = lines.length * (this.textArea.fontSize+4);
        this.textArea.width = 16*this.textArea.fontSize;
        this.textArea.position = this.textPositionRelative().add( new BABYLON.Vector3(0,.2*(lines.length/2),0) );
        this.textArea.size = .2*lines.length;
        this.textArea.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        this.textArea.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        this.textArea.group.parent = this.baseMesh();
        this.textArea.group.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
        this.textArea.show();
        lines.forEach( line=>this.textArea.writeln(line));
      }
    }
  }

  /** 
   * Remote event routed by WorldManager, displays whatever user wrote above avatar's head
   * @param client Client that wrote a text
   */  
  async wrote(client) {
    return this.write( client.wrote );
  }
  
  /** Remote emoji event routed by WorldManager/EventRouter */  
  async emoji(client, node, direction=3) {
    let url = client.emoji;
    console.log("Remote emoji: "+url);
    if ( url == null ) {
      // cleanup existing particle system
      if (this.emojiParticleSystem) {
        this.emojiParticleSystem.stop();
      }
    } else {
      // start emoji particle system
      if ( ! this.emojiParticleSystem ) {
        this.emojiParticleSystem = new EmojiParticleSystem(this.scene);
      }
      this.emojiParticleSystem.init(url, this, direction).start();
    }
  }

  /** Returns the URL of the avatar file */  
  getUrl() {
    throw new Error("Implement this method");
  }

  /** Returns the top-level mesh of the avatar */
  baseMesh() {
    throw new Error("Implement this method");
  }

  /** Returns the current base position of the avatar, e.g. where the feet are */
  basePosition() {
    throw new Error("Implement this method");
  }

  /** Position of top of the avatar, default implementation returns basePosition()+topPositionRelative() */
  topPositionAbsolute() {
    return this.basePosition().add(this.topPositionRelative());
  }

  /** Position of top of the avatar, default implementation returns userHeight Vector3 */
  topPositionRelative() {
    return new BABYLON.Vector3(0, this.userHeight, 0);    
  }
  
  /** Position of text above the avatar, default implementation returns topPositionRelative()+textOffset */
  textPositionRelative() {
    return this.topPositionRelative().add(new BABYLON.Vector3(0,this.textOffset,0));
  }
 
  /** Add an attachment to the attachment object */ 
  attach(name,node) {
    this.attachments[name]=node;
  }
  
  /** Delete an attachment, does not dispose */
  detach(name) {
    delete this.attachments[name];
  }

  /**
   * Shortcut for this.attachments.hasOwnProperty(name)
   */
  containsAttachment(name) {
    return this.attachments.hasOwnProperty(name);
  }  
 
  /** Disposes of all attachments */ 
  dispose() {
    Object.values(this.attachments).forEach(node=>node.dispose());
    this.attachments = {};
  }
  
  /**
   * Handles position change network event
   * @param {VRObject} obj contains already changed position
   * @param {*} node babylon node 
   */
  positionChanged(obj, node) {
    if (!obj.translate) {
      obj.translate = VRSPACEUI.createAnimation(node, "position", this.fps);
      // CHECKME move this assignment to createAnimation?
      node.position.x = obj.position.x; 
      node.position.y = obj.position.y; 
      node.position.z = obj.position.z; 
    } else {
      //VRSPACEUI.updateAnimation(obj.translate, node.position, obj.position);
      obj.translate = VRSPACEUI.chainAnimation(obj.translate, node, "position", obj.position);
    }
  }
  
  /**
   * Handles rotation change network event
   * @param {VRObject} obj contains already changed rotation
   * @param {*} node babylon node 
   */
  rotationChanged(obj, node) {
    if (!obj.rotate) {
      obj.rotate = VRSPACEUI.createAnimation(node, "rotation", this.fps);
      node.rotation.x = obj.rotation.x; 
      node.rotation.y = obj.rotation.y; 
      node.rotation.z = obj.rotation.z; 
    } else {
      //VRSPACEUI.updateAnimation(obj.rotate, node.rotation, obj.rotation);
      obj.rotate = VRSPACEUI.chainAnimation(obj.rotate, node, "rotation", obj.rotation);
    }
  }

  /**
   * Handles name change network event
   * @param {VRObject} obj contains already changed name
   * @param {*} node babylon node 
   */
  nameChanged(obj,node) {
    this.setName(obj.name);    
  }
 
  /**
   * @param {User} obj 
   */ 
  meshChanged(obj, node) {
    console.log("TODO: replace avatar mesh", obj);
    WorldManager.instance.removeObject(obj);
    setTimeout(()=>WorldManager.instance.addObject(obj), 100);
  }
  
  /**
   * @param {User} obj 
   */ 
  videoChanged(obj, node) { 
    if (obj.mesh && obj.mesh != "video") {
      console.log("TODO: switch between video and humanoid avatar", obj);
      WorldManager.instance.removeObject(obj);
      setTimeout(()=>WorldManager.instance.addObject(obj), 100);
    } else {
      console.log("TODO: VideoAvatar displaying stream: "+obj.video, obj);
    }
  }
  
  /**
   * @param {User} obj 
   */ 
  humanoidChanged(obj, node) {
    console.log("TODO: humanoid avatar", obj);
  }
}