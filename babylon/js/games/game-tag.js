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
    this.catchRadius = .5;
    this.delay = 3;
    this.minDelay = 1;
    this.maxDelay = 5;
    this.sounds = {
      soundAlarm: VRSPACEUI.contentBase + "/content/sound/bowesy__alarm.wav",
      soundClock: VRSPACEUI.contentBase + "/content/sound/deadrobotmusic__sprinkler-timer-loop.wav",
      soundTick: VRSPACEUI.contentBase + "/content/sound/fupicat__videogame-menu-highlight.wav",
      soundStart: VRSPACEUI.contentBase + "/content/sound/ricardus__zildjian-4ft-gong.wav",
      soundVictory: VRSPACEUI.contentBase + "/content/sound/colorscrimsontears__fanfare-3-rpg.wav"
    }
    this.chaseIcon = VRSPACEUI.contentBase + "/content/icons/man-run.png";
    this.targetIcon = VRSPACEUI.contentBase + "/content/icons/target-aim.png";
    this.camera = this.scene.activeCamera;
    this.gameStateCheck = null;
    this.counting = false;
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
    this.counting = true;
    let countForm = new CountdownForm(delay);
    countForm.init();
    let timerSound = new BABYLON.Sound(
      "clock",
      this.sounds.soundClock,
      this.scene,
      null,
      {loop: true, autoplay: true}
    );
    timerSound.play();
    let tickSound = new BABYLON.Sound(
      "clock",
      this.sounds.soundTick,
      this.scene,
      null,
      {loop: false, autoplay: true }
    );
    let startSound = new BABYLON.Sound(
      "gong",
      this.sounds.soundStart,
      this.scene,
      null,
      {loop: false, autoplay: false }
    );
    
    if ( !this.hunter && this.isMine() || VRSPACE.me == this.hunter ) {
      this.camera.detachControl();
    }
    
    let countDown = setInterval( () => {
      if ( delay-- <= 0 ) {
        this.counting = false;
        this.camera.attachControl();
        clearInterval(countDown);
        countForm.dispose();
        timerSound.dispose();
        tickSound.dispose();
        startSound.play();
        this.gameStarted = true;
        if ( this.isMine() && ! this.gameStateCheck) {
          VRSPACE.sendCommand("Game", {id: this.vrObject.id, action:"start" });
          this.gameStateCheck = setInterval( () => this.checkGameState(), 1000/this.fps);
        }
      } else {
        tickSound.play();
        countForm.update(delay);
      }
    }, 1000);
  }

  inRange(pos,target,range) {
    let dx = pos.x - target.x;
    let dz = pos.z - target.z;
    let radius = Math.sqrt( dx*dx + dz*dz );
    let ret = radius <= range && Math.abs(pos.y - target.y) <= range;
    //console.log("pos: "+pos+" target: "+target+" range: "+range+" radius: "+radius+" "+ret);
    return ret;
  }

  playerPosition(player) {
    if ( player == VRSPACE.me ) {
      // does not have avatar, VRObject position may not be updated, may be in 3rd person view
      return this.avatarPosition();
    }
    return player.position;
  }
  
  checkGameState() {
    if ( this.counting ) {
      return;
    }
    let caught = this.players.find(player=>{
      return player!=this.hunter && this.inRange(this.playerPosition(this.hunter), this.playerPosition(player), this.catchRadius)
    });
    if ( caught ) {
      this.counting = true;
      VRSPACE.sendEvent(this.vrObject, {caught: {className: caught.className, id: caught.id} });
    }
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
      this.sounds.soundAlarm,
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
        // also add all players that joined the game before this instance was created
        this.vrObject.players.forEach(player=>this.playerJoins(player));
        this.startCountdown(this.delay);
      } else if ( this.joinDlg ) {
        this.joinDlg.close();
        this.joinDlg = null;
      }
    } else if ( changes.start && this.playing ) {
      this.gameStarted = true;
      this.hunter = this.changePlayerStatus(changes.start, "SoundAlarm", this.chaseIcon);
      this.players.filter(player => player != this.hunter).forEach((player)=>{
        this.changePlayerStatus(player, null, this.targetIcon);
      });
    } else if ( changes.caught && this.playing ) {
      this.changePlayerStatus(this.hunter, null, this.targetIcon);
      // hunter needs to be known before countdown (disables movement)
      this.hunter = this.changePlayerStatus(changes.caught, "SoundAlarm", this.chaseIcon);
      this.startCountdown(this.delay);
    } else {
      console.log("Unknown/ignored notification: ", changes);
    }
  }

}