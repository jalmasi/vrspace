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
    this.voice = null;
    
    const voices = window.speechSynthesis.getVoices();
    if ( voices.length == 0 ) {
      // chrome fires event
      window.speechSynthesis.onvoiceschanged = (changed) => {
        this.processVoices(window.speechSynthesis.getVoices());
      }
    } else {
      // mozilla returns it right away
      this.processVoices(voices);
    }
  }
  
  processVoices(voices) {
    console.log("voices",voices);
    this.voice = voices[0];
    let langMatch = this.vrObject.lang == null; // null means any matches
    let genderMatch = this.vrObject.gender == null; // null means any matches
    voices.forEach( (voice, index) => {
      // CHECKME this could be easily wrong way to select female voice
      if ( ! langMatch && this.vrObject.lang && voice.lang == this.vrObject.lang ) {
        langMatch = true;
        this.voice = voice;
      }
      let female = voice.name.indexOf("Zira") >= 0 || voice.name.indexOf("Female") >= 0;
      if ( !genderMatch && female && this.vrObject.gender && this.vrObject.gender.toLowerCase() === "female") {
        genderMatch = true;
        this.voice = voice;
      }
    });
    console.log("Voice selected", this.voice);
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
      if ( this.voice ) {
        const utter = new SpeechSynthesisUtterance(changes.wrote);
        utter.voice = this.voice;
        window.speechSynthesis.speak(utter);
      }
      let animation = this.animation.processText(changes.wrote);
      if ( animation ) {
        animation.onAnimationGroupEndObservable.add(this.animationEnd);
        this.startAnimation(animation);
      }
    }
  }
}