import { AvatarAnimation } from './avatar-animation.js';

export class BotController {
  constructor( worldManager, avatar ) {
    /** Timestamp of last change */
    this.lastChange = Date.now();
    /** After not receiving any events for this many millis, idle animation starts */
    this.idleTimeout = 200;
    this.lastAnimation = null;
    this.worldManager = worldManager;
    this.world = worldManager.world;
    this.scene = worldManager.scene;
    this.avatar = avatar;
    this.vrObject = avatar.VRObject;
    this.animation = new AvatarAnimation(avatar);
    this.animation.improvise = true;
    this.setupIdleTimer();
    this.vrObject.addListener((obj,changes)=>this.processChanges(obj,changes));
    this.animationEnd = (animation) => this.animationEnded(animation);
  }
  /**
   * Create timer for idle animation, if it doesn't exist.
   * CHECKME copied from AvatarController
   */
  setupIdleTimer() {
    if ( this.idleTimerId ) {
      return;
    }
    this.idleTimerId = setInterval(() => {
      if ( this.worldManager.isOnline() && Date.now() - this.lastChange > this.idleTimeout ) {
        clearInterval(this.idleTimerId);
        this.idleTimerId = null;
        this.startAnimation(this.animation.idle().group, true);
      }
    }, this.idleTimeout);
  }
  
  startAnimation(animation, loop=false) {
    if ( animation && this.animation.contains(animation.name) && animation.name != this.lastAnimation ) {
      //console.log("Sending animation "+animation.name+" loop: "+loop+" speed "+animation.speedRatio);
      this.avatar.startAnimation(animation.name, loop);
      this.lastAnimation = animation.name;
    }
  }

  animationEnded(animation) {
    this.setupIdleTimer();
    animation.onAnimationGroupEndObservable.remove(this.animationEnd);
  }
  processChanges(obj,changes) {
    //console.log("processing changes ",obj,changes);
    if ( changes['wrote'] ) {
      let animation = this.animation.processText(changes.wrote);
      if ( animation ) {
        animation.onAnimationGroupEndObservable.add(this.animationEnd);
        this.startAnimation(animation);
      }
    }
  }
}