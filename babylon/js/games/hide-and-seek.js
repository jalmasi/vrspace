import { BasicGame } from './basic-game.js';
import { VisibilityHelper } from "../world/visibility-helper.js";
import { VRSPACE } from "../client/vrspace.js";
import { VRSPACEUI } from '../ui/vrspace-ui.js';
import { Form } from '../ui/widget/form.js';
import { CountdownForm } from './countdown-form.js'

class ScoreBoard extends Form {
  constructor(game, callback) {
    super();
    this.game = game;
    this.seeker = game.seeker;
    this.seen = game.seen;
    this.winners = game.winners;
    this.losers = game.losers;
    this.callback = callback;
  }
  
  init() {
    this.createPanel();
    this.grid = new BABYLON.GUI.Grid();
    this.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.grid.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    
    this.grid.addColumnDefinition(0.2);
    this.grid.addColumnDefinition(0.5);
    this.grid.addColumnDefinition(0.3);

    this.grid.addRowDefinition(this.heightInPixels, true);

    let seekerScore = Object.keys(this.losers).length;
    let seekerIcon = this.makeIcon("seekerIcon", this.game.searchIcon);
    this.grid.addControl(seekerIcon, 0, 0);
    this.grid.addControl(this.textBlock(this.playerName(this.seeker)), 0, 1);
    this.grid.addControl(this.textBlock(seekerScore), 0, 2);

    let winnerIcon = this.makeIcon("winnerIcon", this.game.wonIcon);
    let loserIcon = this.makeIcon("loserIcon", this.game.lostIcon);
    let seenIcon = this.makeIcon("seenIcon", this.game.foundIcon);
    
    this.showPlayers(this.winners, 1, winnerIcon);
    this.showPlayers(this.losers, 0, loserIcon);
    this.showPlayers(this.seen , 0, seenIcon);
    let otherPlayers = {};
    this.game.players.forEach(player=>{
      let id = player.getID().toString();
      if ( !this.winners[id] && !this.losers[id] && !this.seen[id] && player != this.seeker) {
        // not found yet
        otherPlayers[id] = player;
      }
    });
    this.showPlayers(otherPlayers, 0);
        
    this.addControl(this.grid);

    this.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    if ( this.game.playing ) {
      let closeButton = this.textButton("OK", () => this.callback(false), VRSPACEUI.contentBase+"/content/icons/tick.png", "green");
      this.addControl(closeButton);
    }
    let quitButton = this.textButton("Quit", () => this.callback(true), VRSPACEUI.contentBase+"/content/icons/close.png", "red");
    this.addControl(quitButton);
    
    VRSPACEUI.hud.addForm(this,512,this.heightInPixels*(this.grid.rowCount+1));
  }

  showPlayers(obj, score, icon) {
    let keys = Object.keys(obj);
    let rowCount = this.grid.rowCount;
    for ( let i = 0; i < keys.length; i++ ) {
      this.grid.addRowDefinition(this.heightInPixels, true);
      if ( icon ) {
        this.grid.addControl(icon, i+rowCount, 0);
      }
      this.grid.addControl(this.textBlock(this.playerName(obj[keys[i]])), i+rowCount, 1);
      this.grid.addControl(this.textBlock(score), i+rowCount, 2);
    }
  }
  
  playerName(vrObject) {
    if ( vrObject.name ) {
      return vrObject.name;
    }
    return "Player "+vrObject.id;
  }
}

/**
 * Super original hide and seek game!
 * 
 * Player that started the game needs to search for other players.
 * If seen, both players rush to the place where the game started, first one to arrive, scores.
 */
export class HideAndSeek extends BasicGame {
  static instance = null;
  
  constructor( world, vrObject ) {
    super(world,vrObject);
    this.camera = this.scene.activeCamera;
    this.visibilityHelper = new VisibilityHelper();
    this.fps = 5;
    this.goalRadius = 1.5;
    this.gameIcon = VRSPACEUI.contentBase + "/content/emoji/cool.png";
    this.searchIcon = VRSPACEUI.contentBase + "/content/icons/search.png";
    this.foundIcon = VRSPACEUI.contentBase + "/content/icons/eye.png";
    this.wonIcon = VRSPACEUI.contentBase + "/content/icons/tick.png";
    this.lostIcon = VRSPACEUI.contentBase + "/content/icons/close.png";
    this.sounds = {
      soundSeek: VRSPACEUI.contentBase + "/content/sound/sergeyionov__cr-water-sonar.wav",
      soundFail: VRSPACEUI.contentBase + "/content/sound/kevinvg207__wrong-buzzer.wav",
      soundVictory: VRSPACEUI.contentBase + "/content/sound/colorscrimsontears__fanfare-3-rpg.wav",
      soundAlarm: VRSPACEUI.contentBase + "/content/sound/bowesy__alarm.wav",
      soundClock: VRSPACEUI.contentBase + "/content/sound/deadrobotmusic__sprinkler-timer-loop.wav",
      soundTick: VRSPACEUI.contentBase + "/content/sound/fupicat__videogame-menu-highlight.wav",
      soundStart: VRSPACEUI.contentBase + "/content/sound/ricardus__zildjian-4ft-gong.wav",
      soundEnd: VRSPACEUI.contentBase + "/content/sound/ricardus__zildjian-4ft-gong.wav"
    }
    this.gameStarted = false;
    this.invitePlayers();
    this.markStartingPosition();
    this.seeker = null;
    this.seen = {};
    this.winners = {};
    this.losers = {};
    this.materials = [];
    console.log("Players already in the game:", this.vrObject.players );
    if ( HideAndSeek.instance ) {
      throw "There can be only one";
    } else {
      HideAndSeek.instance = this;
    }
  }
  
  dispose() {
    super.dispose();
    this.visibilityHelper.dispose();
    this.visibilityHelper = null;
    if ( this.visibilityCheck ) {
      clearInterval(this.visibilityCheck);
    }
    if ( this.particleSystem ) {
      this.particleSystem.dispose();
      this.particleSystem = null;
      this.particleSource.dispose();
      this.goal.dispose();
      this.goalMaterial.dispose();
    }
    this.materials.forEach( m => m.dispose());
    HideAndSeek.instance = null;
    if ( this.callback ) {
      this.callback(false);
    }
  }
  
  markStartingPosition() {
    //if ( BABYLON.GPUParticleSystem.IsSupported ) {
      // hardware particles work differently on different devices 
      //this.particleSystem = new BABYLON.GPUParticleSystem("GoalParticles", {capacity: 100}, this.scene);
    //} else {
      this.particleSystem = new BABYLON.ParticleSystem("GoalParticles", 100, this.scene);
    //}
    this.particleSystem.disposeOnStop = true;
    this.particleSystem.particleTexture = new BABYLON.Texture(this.gameIcon, this.scene);
    this.particleSource = BABYLON.MeshBuilder.CreateSphere("particlePositon",{diameter: 0.1},this.scene);
    this.particleSource.isVisible = false;

    let pos = this.vrObject.position;
    this.particleSource.position = new BABYLON.Vector3(pos.x, pos.y, pos.z);

    this.particleSystem.emitter = this.particleSource;
    this.particleSystem.addColorGradient(0, new BABYLON.Color4(.1, .1, .1, .5), new BABYLON.Color4(.2, .2, .2, .5));
    this.particleSystem.addColorGradient(0.1, new BABYLON.Color4(1, 1, 1, 1), new BABYLON.Color4(0.9, 0.9, 0.9, 1));
    this.particleSystem.addColorGradient(0.9, new BABYLON.Color4(1, 1, 1, 1), new BABYLON.Color4(0.9, 0.9, 0.9, 1));
    this.particleSystem.addColorGradient(1, new BABYLON.Color4(.1, .1, .1, .5), new BABYLON.Color4(.2, .2, .2, .5));
    this.particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
    
    this.particleSystem.addSizeGradient(0, 0.05); //size at start of particle lifetime
    this.particleSystem.addSizeGradient(.5, .3); //size at half lifetime
    this.particleSystem.addSizeGradient(1, .1); //size at end of particle lifetime

    this.particleSystem.addVelocityGradient(0, 1);
    this.particleSystem.addVelocityGradient(1, 0);
    this.particleSystem.maxInitialRotation=Math.PI;
    this.particleSystem.maxAngularSpeed=5*Math.PI;

    this.particleSystem.minLifeTime = 3;
    this.particleSystem.maxLifeTime = 4;

    this.particleSystem.emitRate = 10;
    
    this.particleSystem.createSphereEmitter(0.5,1);
    
    this.particleSystem.minEmitPower = 0.1;
    this.particleSystem.maxEmitPower = 1;
    this.particleSystem.updateSpeed = 0.005;
    this.particleSystem.gravity = new BABYLON.Vector3(0,-10,0);
    
    this.particleSystem.start();
    
    let animation = VRSPACEUI.createAnimation(this.particleSource, "position", 0.05);
    VRSPACEUI.updateAnimation(animation,new BABYLON.Vector3(pos.x, pos.y, pos.z),new BABYLON.Vector3(pos.x, pos.y+20, pos.z));
    
    this.goal = BABYLON.MeshBuilder.CreateCylinder("Goal", {height:.2,diameter:this.goalRadius*2}, this.scene);
    this.goal.position = new BABYLON.Vector3(pos.x, pos.y, pos.z);
    this.goalMaterial = new BABYLON.StandardMaterial("GoalMaterial",this.scene);
    this.goalMaterial.emissiveTexture = new BABYLON.Texture(this.gameIcon, this.scene);
    this.goalMaterial.disableLighting = true;
    this.goal.material = this.goalMaterial;
  }
  
  showGameStatus() {
    this.closeGameStatus();
    if ( ! this.gameStarted ) {
      super.showGameStatus();
      return;
    }
    VRSPACEUI.hud.showButtons(false);
    VRSPACEUI.hud.newRow();
    this.scoreBoard = new ScoreBoard(this, (quit)=>{
      this.closeGameStatus();
      if ( quit ) {
        this.quitGame();
      }
    });
    this.scoreBoard.init();
  }
  
  closeGameStatus() {
    super.closeGameStatus();
    if ( this.scoreBoard ) {
      VRSPACEUI.hud.clearRow();
      VRSPACEUI.hud.showButtons(true);
      this.scoreBoard.dispose();
      this.scoreBoard = null;
    }
  }
  
  attachSounds(baseMesh) {
    let options = {
      loop: false,
      autoplay: false,
      streaming: false,
      panningModel: "linear",
      maxDistance: 100,
      spatialSound: true
    }
    let fail = new BABYLON.Sound(
      "fail",
      this.sounds.soundFail,
      this.scene, 
      null, // callback 
      options
    );
    fail.attachToMesh(baseMesh);
    baseMesh.soundFail = fail;

    let victory = new BABYLON.Sound(
      "victory",
      this.sounds.soundVictory,
      this.scene, 
      null, // callback 
      options
    );
    victory.attachToMesh(baseMesh);
    baseMesh.soundVictory = victory;

    options.loop = true;

    let alarm = new BABYLON.Sound(
      "alarm",
      this.sounds.soundAlarm,
      this.scene, 
      null, // callback 
      options
    );
    alarm.attachToMesh(baseMesh);
    baseMesh.soundAlarm = alarm;
    
    let seek = new BABYLON.Sound(
      "alarm",
      this.sounds.soundSeek,
      this.scene, 
      null, // callback 
      options
    );
    seek.attachToMesh(baseMesh);
    baseMesh.soundSeek = seek;
  }
  
  startCountdown(delay, chatLog) {
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
    
    if ( this.isMine() ) {
      if (chatLog) {
        chatLog.group.setEnabled(false);
      }
      this.enableMovement(false);
      this.curtain = BABYLON.MeshBuilder.CreatePlane("Curtain", {size:10}, this.scene);
      this.curtain.position = new BABYLON.Vector3(0,0,1);
      this.curtain.parent = this.camera;
      this.curtain.material = new BABYLON.StandardMaterial("CurtainMaterial",this.scene);
      this.curtain.material.diffuseColor=new BABYLON.Color4(0,0,0,0.9);
    }
    
    let countDown = setInterval( () => {
      if ( delay-- <= 0 ) {
        if (chatLog) {
          chatLog.group.setEnabled(true);
        }
        this.enableMovement(true);
        clearInterval(countDown);
        countForm.dispose();
        timerSound.dispose();
        tickSound.dispose();
        startSound.play();
        this.gameStarted = true;
        if ( this.curtain ) {
          this.curtain.dispose();
          delete this.curtain;
        }
        if ( this.isMine() ) {
          VRSPACE.sendCommand("Game", {id: this.vrObject.id, action:"start" });
          this.visibilityCheck = setInterval( () => this.checkVisibility(), 1000/this.fps);
        }
      } else {
        tickSound.play();
        countForm.update(delay);
      }
    }, 1000);
  }


  updateGameStatus(id, playerEvent, stateObject, sound, icon, color) {
    if ( ! stateObject.hasOwnProperty(id) ) {
      let player = this.changePlayerStatus(playerEvent, sound, icon, color);
      stateObject[id] = player;
    }
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
    } else if (changes.seen && this.playing) {
      this.updateStatus(changes.seen.className+" "+changes.seen.id, changes.seen, this.seen, "soundAlarm", this.foundIcon);
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
    } else if ( changes.start && this.playing) {
      this.gameStarted = true;
      this.seeker = this.changePlayerStatus(changes.start, "soundSeek", this.searchIcon);
    } else if (changes.won && this.playing) {
      let id = changes.won.className+" "+changes.won.id;
      this.updateGameStatus(id, changes.won, this.winners, "soundVictory", this.wonIcon, new BABYLON.Color4(0,1,0,1));
      delete this.seen[id];
      this.showGameStatus();
      this.checkEnd()
    } else if (changes.lost && this.playing) {
      let id = changes.lost.className+" "+changes.lost.id;
      this.updateGameStatus(id, changes.lost, this.losers, "soundFail", this.lostIcon, new BABYLON.Color4(1,0,0,1));
      delete this.seen[id];
      this.showGameStatus();
      this.checkEnd()
    } else if ( changes.end && this.playing) {
      this.playing = false;
      this.showGameStatus();
      let endSound = new BABYLON.Sound(
        "gong",
        this.sounds.soundEnd,
        this.scene,
        null,
        {loop: false, autoplay: true }
      );
      endSound.play();
    } else {
      console.log("Unknown/ignored notification: ", changes);
    }
  }
 
  inGoalRange(pos) {
    let dx = pos.x - this.goal.position.x;
    let dz = pos.z - this.goal.position.z;
    let radius = Math.sqrt( dx*dx + dz*dz );
    return radius <= this.goalRadius;
  }
  
  checkEnd() {
    if ( this.isMine() && Object.keys(this.winners).length + Object.keys(this.losers).length + 1 == this.players.length ) {
      VRSPACE.sendEvent(this.vrObject, {end: Date.now() - this.startTime });
    }
  }
  
  checkVisibility() {
    let visible = this.visibilityHelper.getVisibleUsers(this.players);
    if ( visible.length > 0 ) {
      // anyone not seen before?
      visible.forEach( (user) => {
        let id = user.className+" "+user.id;
        if ( ! this.seen.hasOwnProperty(id) && !this.winners.hasOwnProperty(id) && !this.losers.hasOwnProperty(id)) {
          this.updateGameStatus(id, user, this.seen, "soundAlarm", this.foundIcon);
          VRSPACE.sendEvent(this.vrObject, {seen: {className: user.className, id: user.id} });
        }
      });
      // anyone at the goal area?
      for ( let id in this.seen ) {
        let vrObject = this.seen[id];
        if ( !this.winners.hasOwnProperty(id) && !this.losers.hasOwnProperty(id) && this.inGoalRange(vrObject.avatar.baseMesh().position) ) {
          VRSPACE.sendEvent(this.vrObject, {won: {className: vrObject.className, id: vrObject.id} });
        }
      }
    }
    // am I at the goal area?
    if ( this.inGoalRange(this.avatarPosition()) ) {
      for ( let id in this.seen ) {
        if ( !this.winners.hasOwnProperty(id) && !this.losers.hasOwnProperty(id) ) {
          let vrObject = this.seen[id];
          this.updateGameStatus(id, vrObject, this.losers, "soundFail", this.lostIcon, new BABYLON.Color4(1,0,0,1));
          VRSPACE.sendEvent(this.vrObject, {lost: {className: vrObject.className, id: vrObject.id} });
       }
      }
    }
    
  }
 
  static createOrJoinInstance(callback) {
    if ( HideAndSeek.instance ) {
      // already exists
      if ( ! HideAndSeek.instance.callback ) {
        HideAndSeek.instance.callback = callback;
      }
      HideAndSeek.instance.startRequested();
    } else if (VRSPACE.me) {
      VRSPACE.createScriptedObject({
        name: "Hide and Seek",
        properties: { clientId: VRSPACE.me.id },
        active: true,
        script: '/babylon/js/games/hide-and-seek.js'
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
  
}