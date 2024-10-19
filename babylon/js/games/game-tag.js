import { VRSPACE } from "../client/vrspace.js";
import { VRSPACEUI } from '../ui/vrspace-ui.js';
import { BasicGame } from './basic-game.js';
import { CountdownForm } from './countdown-form.js'

/**
 * Tag has a lot of meanings and uses, class name contains Game to avoid confusion.
 * 
 * In the game of tag, players try to catch each other. Player caught becomes the hunter.
 */
export class GameTag extends BasicGame {
  static instance = null;
  
  constructor( world, vrObject ) {
    super(world,vrObject);
    this.fps = 5;
    this.goalRadius = .5;
    this.delay = 3;
    this.minDelay = 1;
    this.maxDelay = 5;
    this.soundClock = VRSPACEUI.contentBase + "/content/sound/deadrobotmusic__sprinkler-timer-loop.wav";
    this.soundTick = VRSPACEUI.contentBase + "/content/sound/fupicat__videogame-menu-highlight.wav";
    this.soundStart = VRSPACEUI.contentBase + "/content/sound/ricardus__zildjian-4ft-gong.wav";
    this.soundAlarm = VRSPACEUI.contentBase + "/content/sound/bowesy__alarm.wav";
    this.chaseIcon = VRSPACEUI.contentBase + "/content/icons/man-run.png";
    this.targetIcon = VRSPACEUI.contentBase + "/content/icons/target-aim.png";
    this.camera = this.scene.activeCamera;
    this.invitePlayers();
    if ( GameTag.instance ) {
      throw "There can be only one";
    } else {
      GameTag.instance = this;
    }
  }

  dispose() {
    super.dispose();
    GameTag.instance = null;
    if ( this.callback ) {
      this.callback(false);
    }
  }
  
  static createOrJoinInstance(callback) {
    if ( GameTag.instance ) {
      // already exists
      if ( ! GameTag.instance.callback ) {
        GameTag.instance.callback = callback;
      }
      GameTag.instance.startRequested();
    } else if (VRSPACE.me) {
      VRSPACE.createScriptedObject({
        name: "Game of Tag",
        properties: { clientId: VRSPACE.me.id },
        active: true,
        script: '/babylon/js/games/game-tag.js'
      }, "Game").then( obj => {
        obj.addLoadListener((obj, loaded)=>{
          //console.log("Game script loaded: ", obj);
          obj.attachedScript.callback=callback;
        });
        console.log("Created new script ", obj);
      });
    } else {
      console.error("Attemting to start the game before entering a world");
    }
  }
 
  startCountdown(delay) {
    let countForm = new CountdownForm(delay);
    countForm.init();
    let timerSound = new BABYLON.Sound(
      "clock",
      this.soundClock,
      this.scene,
      null,
      {loop: true, autoplay: true}
    );
    timerSound.play();
    let tickSound = new BABYLON.Sound(
      "clock",
      this.soundTick,
      this.scene,
      null,
      {loop: false, autoplay: true }
    );
    let startSound = new BABYLON.Sound(
      "gong",
      this.soundStart,
      this.scene,
      null,
      {loop: false, autoplay: false }
    );
    
    if ( this.isMine() ) {
      this.camera.detachControl();
    }
    
    let countDown = setInterval( () => {
      if ( delay-- <= 0 ) {
        this.camera.attachControl();
        clearInterval(countDown);
        countForm.dispose();
        timerSound.dispose();
        tickSound.dispose();
        startSound.play();
        this.gameStarted = true;
        if ( this.isMine() ) {
          VRSPACE.sendCommand("Game", {id: this.vrObject.id, action:"start" });
          this.gameStateCheck = setInterval( () => this.checkGameState(), 1000/this.fps);
        }
      } else {
        tickSound.play();
        countForm.update(delay);
      }
    }, 1000);
  }

  checkGameState() {
  }
  
  attachSounds(baseMesh) {
    let options = {
      loop: true,
      autoplay: false,
      streaming: false,
      panningModel: "linear",
      maxDistance: 100,
      spatialSound: true
    }
    let alarm = new BABYLON.Sound(
      "alarm",
      this.soundAlarm,
      this.scene, 
      null, // callback 
      options
    );
    alarm.attachToMesh(baseMesh);
    baseMesh.SoundAlarm = alarm;
  }
  
  remoteChange(vrObject, changes) {
    console.log("Remote changes for "+vrObject.id, changes);
    if ( changes.joined ) {
      this.totalPlayers++;
      this.updateStatus();
      this.playerJoins(changes.joined);
    } else if ( changes.quit ) {
      this.totalPlayers--;
      this.updateStatus();
      this.playerQuits(changes.quit);
    } else if ( changes.starting ) {
      if ( this.playing ) {
        this.closeGameStatus();
        this.delay = changes.starting;
        this.startCountdown(this.delay, this.world.chatLog);
        // also add all players that joined the game before this instance was created
        this.vrObject.players.forEach(player=>this.playerJoins(player));
      } else if ( this.joinDlg ) {
        this.joinDlg.close();
        this.joinDlg = null;
      }
    } else if ( changes.start && this.playing ) {
      this.gameStarted = true;
      this.hunter = this.changePlayerStatus(changes.start, "SoundAlarm", this.chaseIcon);
    } else {
      console.log("Unknown/ignored notification: ", changes);
    }
  }

}