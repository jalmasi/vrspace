import { TextWriter } from './text-writer.js';
import { EmojiParticleSystem } from './emoji-particle-system.js';

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
    this.humanoid = false;
    this.video = false;
    /** Original root mesh of the avatar, used to scale the avatar */
    /** Whether to display the name above the head, defaults to value of static displayName */
    this.displayName = this.constructor.displayName;
    /** Should written/spoken text be displayed above the head, defaults to value of static displayText */
    this.displayText = this.constructor.displayText;
    if ( this.displayName || this.displayText ) {
      this.writer = new TextWriter(this.scene);
      this.writer.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    }
    this.emojiParticleSystem = null;
  }

  /** 
  Set the name and display it above the avatar 
  @param name 
  */
  async setName(name) {
    if ( this.writer && this.displayName ) {
      this.writer.clear(this.baseMesh());
      this.writer.relativePosition = this.textPositionRelative();
      this.writer.write(this.baseMesh(), name);
    }
    this.name = name;
  }

  /** Remote event routed by WorldManager, displays whatever user wrote above avatar's head*/  
  async wrote(client) {
    if ( this.writer && this.displayText ) {
      let limit = 20;
      let text = [this.name];
      let line = '';
      client.wrote.split(' ').forEach((word) => {
        if ( line.length + word.length > limit ) {
          text.push(line);
          line = '';
        }
        line += word + ' ';
      });
      text.push(line);

      this.writer.clear(this.baseMesh());
      this.writer.relativePosition = this.textPositionRelative().add( new BABYLON.Vector3(0,.2*(text.length-1),0) );
      this.writer.writeArray(this.baseMesh(), text);
    }
  }
  
  /** Remote emoji event routed by WorldManager */  
  async emoji(client, direction=3) {
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
  
  dispose() {
    throw new Error("Implement this method");
  }
}