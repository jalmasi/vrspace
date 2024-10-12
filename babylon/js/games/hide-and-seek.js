import { BasicScript } from "../scripts/basic-script.js";
import { VisibilitySensor } from "../world/visibility-sensor.js";
import { Dialogue } from "../ui/widget/dialogue.js";
import { VRSPACE } from "../client/vrspace.js";
import { ID } from "../client/vrspace.js";
import { VRSPACEUI } from '../ui/vrspace-ui.js';
import { Form } from '../ui/widget/form.js';
import { HorizontalSliderPanel } from "../ui/widget/slider-panel.js";

class GameStatus extends Form {
  constructor(isMine, callback) {
    super();
    this.text = "Players joined: ";
    this.delayText = "Count";
    this.callback = callback;
    this.isMine = isMine;
    this.gameStarted = false;
  }  
  
  init() {
    this.verticalPanel = true;
    this.createPanel();
    this.label = this.textBlock(this.text+"0");
    this.addControl(this.label);
    this.padding = 8;
    if (this.isMine && ! this.gameStarted) {
      this.sliderPanel = new HorizontalSliderPanel(.5,this.delayText,10,30,10);
      this.sliderPanel.decimals = 0;
      this.addControl(this.sliderPanel.panel);
      let startButton = this.textButton("Start", () => this.callback(true));
      this.addControl(startButton);
    }
    let quitButton = this.textButton("Quit", () => this.callback(false), VRSPACEUI.contentBase+"/content/icons/close.png", "red");
    this.addControl(quitButton);

    VRSPACEUI.hud.addForm(this,512,256);
  }
  
  numberOfPlayers(num) {
    this.label.text = this.text+num;
  }
  getDelay() {
    if ( this.sliderPanel ) {
      return this.sliderPanel.slider.value;
    }
    return 0;
  }
}

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
    this.addControl(this.grid);
    
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
    let loserIcon = this.makeIcon("winnerIcon", this.game.lostIcon);
    let seenIcon = this.makeIcon("winnerIcon", this.game.foundIcon);
    
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
  
  makeIcon(name, url) {
    let ret = new BABYLON.GUI.Image(name, url);
    ret.stretch = BABYLON.GUI.Image.STRETCH_UNIFORM;
    return ret;
  }
  
  playerName(vrObject) {
    if ( vrObject.name ) {
      return vrObject.name;
    }
    return "Player "+vrObject.id;
  }
}

class CountDown extends Form {
  constructor(count, isMine) {
    super();
    this.fontSize = 128;
    this.count = count;
    this.isMine = isMine;
  }
  init() {
    this.createPanel();
    this.label = this.textBlock(" ");
    this.update(this.count);
    this.label.width = "256px";
    this.label.height = "256px";
    this.addControl(this.label);
    VRSPACEUI.hud.showButtons(false);
    VRSPACEUI.hud.newRow();
    VRSPACEUI.hud.addForm(this,256,128);
    this.plane.position.y += 0.1;
    if ( this.isMine ) {
      this.texture.background = "black";
    }
  }
  update(count) {
    // FIXME ugly way to justify right
    if ( count >= 10 ) {
      this.label.text = " "+count;
    } else {
      this.label.text = "  "+count;
    }
  }
  dispose() {
    super.dispose();
    VRSPACEUI.hud.clearRow();
    VRSPACEUI.hud.showButtons(true);
  }
}

/**
 * Super original hide and seek game!
 * 
 * Player that started the game needs to search for other players.
 * If seen, both players rush to the place where the game started, first one to arrive, scores.
 */
export class HideAndSeek extends BasicScript {
  static instance = null;
  
  constructor( world, vrObject ) {
    super(world,vrObject);
    this.camera = this.scene.activeCamera;
    this.visibilitySensor = new VisibilitySensor();
    this.fps = 5;
    this.seconds = 20;
    this.goalRadius = 1.5;
    this.delay = 10;
    this.gameIcon = VRSPACEUI.contentBase + "/content/emoji/cool.png";
    this.searchIcon = VRSPACEUI.contentBase + "/content/icons/search.png";
    this.foundIcon = VRSPACEUI.contentBase + "/content/icons/eye.png";
    this.wonIcon = VRSPACEUI.contentBase + "/content/icons/tick.png";
    this.lostIcon = VRSPACEUI.contentBase + "/content/icons/close.png";
    this.soundSeek = VRSPACEUI.contentBase + "/content/sound/sergeyionov__cr-water-sonar.wav";
    this.soundFail = VRSPACEUI.contentBase + "/content/sound/kevinvg207__wrong-buzzer.wav";
    this.soundVictory = VRSPACEUI.contentBase + "/content/sound/colorscrimsontears__fanfare-3-rpg.wav";
    this.soundAlarm = VRSPACEUI.contentBase + "/content/sound/bowesy__alarm.wav";
    this.soundClock = VRSPACEUI.contentBase + "/content/sound/deadrobotmusic__sprinkler-timer-loop.wav";
    this.soundTick = VRSPACEUI.contentBase + "/content/sound/fupicat__videogame-menu-highlight.wav";
    this.soundStart = VRSPACEUI.contentBase + "/content/sound/ricardus__zildjian-4ft-gong.wav";
    this.soundEnd = VRSPACEUI.contentBase + "/content/sound/ricardus__zildjian-4ft-gong.wav";
    this.totalPlayers = vrObject.numberOfPlayers;
    this.startTime = 0;
    this.playing = false;
    this.gameStarted = false;
    this.invitePlayers();
    this.markStartingPosition();
    this.seeker = null;
    this.seen = {};
    this.winners = {};
    this.losers = {};
    this.players = [];
    this.indicators = [];
    this.materials = [];
    console.log("Players already in the game:", this.vrObject.players );
    if ( HideAndSeek.instance ) {
      throw "There can be only one";
    } else {
      HideAndSeek.instance = this;
    }
  }
  
  dispose() {
    this.closeGameStatus();
    this.visibilitySensor.dispose();
    this.visibilitySensor = null;
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
    this.indicators.forEach( i => {
      if ( i.parent ) {
        i.parent.GameIndicator = null;
        delete i.parent.GameIndicator;
      }
      i.dispose();
    });
    if ( this.joinDlg ) {
      this.joinDlg.close();
      this.joinDlg = null;
    }
    this.materials.forEach( m => m.dispose());
    this.players.forEach(client=>{client.avatar && this.detachSounds(client.avatar.baseMesh())});
    this.detachSounds(VRSPACEUI.hud.root);
    HideAndSeek.instance = null;
  }
  
  markStartingPosition() {
    if ( BABYLON.GPUParticleSystem.IsSupported ) {
      this.particleSystem = new BABYLON.GPUParticleSystem("GoalParticles", {capacity: 200}, this.scene);
    } else {
      this.particleSystem = new BABYLON.ParticleSystem("GoalParticles", 200, this.scene);
    }
    this.particleSystem.disposeOnStop = true;
    this.particleSystem.particleTexture = new BABYLON.Texture(this.gameIcon, this.scene);
    this.particleSource = BABYLON.MeshBuilder.CreateSphere("particlePositon",{diameter: 0.1},this.scene);
    this.particleSource.isVisible = false;

    let pos = this.vrObject.position;
    this.particleSource.position = new BABYLON.Vector3(pos.x, pos.y, pos.z);

    this.particleSystem.emitter = this.particleSource;
    this.particleSystem.addColorGradient(0, new BABYLON.Color4(.1, .1, .1, .5), new BABYLON.Color4(.2, .2, .2, .5));
    this.particleSystem.addColorGradient(0.1, new BABYLON.Color4(1, 1, 1, 1), new BABYLON.Color4(0.9, 0.9, 0.9, 1));
    this.particleSystem.addColorGradient(0.5, new BABYLON.Color4(.5, .5, .5, 1), new BABYLON.Color4(0.9, 0.9, 0.9, 1));
    this.particleSystem.addColorGradient(1, new BABYLON.Color4(.1, .1, .1, .5), new BABYLON.Color4(.2, .2, .2, .5));

    this.particleSystem.addSizeGradient(0, 0.05); //size at start of particle lifetime
    this.particleSystem.addSizeGradient(.5, .3); //size at half lifetime
    this.particleSystem.addSizeGradient(1, .1); //size at end of particle lifetime

    this.particleSystem.addVelocityGradient(0, 1);
    this.particleSystem.addVelocityGradient(1, 0);
    this.particleSystem.maxInitialRotation=Math.PI;
    this.particleSystem.maxAngularSpeed=5*Math.PI;

    this.particleSystem.minLifeTime = 3;
    this.particleSystem.maxLifeTime = 4;

    this.particleSystem.emitRate = 50;
    
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
  
  invitePlayers() {
    if ( this.isMine() ) {
      this.joinGame(true);
    } else if ( this.vrObject.status != "started" ) {
      this.joinDlg = new Dialogue("Join "+this.vrObject.name+" ?", (yes)=>this.joinGame(yes));
      this.joinDlg.init();
    }
  }
  
  showGameStatus() {
    this.closeGameStatus();
    if ( ! this.gameStarted ) {
      VRSPACEUI.hud.showButtons(false);
      VRSPACEUI.hud.newRow();
      this.gameStatus = new GameStatus(this.isMine(), (start)=>{
        if ( start ) {
          this.startGame();
        } else {
          this.quitGame();
        }
      });
      this.gameStatus.gameStarted = this.gameStarted;
      this.gameStatus.init();
      this.gameStatus.numberOfPlayers(this.totalPlayers);
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
  
  startRequested() {
    if ( this.isMine() || this.gameStarted ) {
      // player has already joined
      this.showGameStatus();
    } else if ( ! this.gameStarted ) {
      // player wants to join
      this.invitePlayers();
    }
  }
  
  closeGameStatus() {
    if ( this.gameStatus ) {
      VRSPACEUI.hud.clearRow();
      VRSPACEUI.hud.showButtons(true);
      this.gameStatus.dispose();
      this.gameStatus = null;
    }
    if ( this.scoreBoard ) {
      VRSPACEUI.hud.clearRow();
      VRSPACEUI.hud.showButtons(true);
      this.scoreBoard.dispose();
      this.scoreBoard = null;
    }
  }
  
  joinGame(yes) {
    this.playing = yes;
    if ( yes ) {
      this.showGameStatus();
      VRSPACE.sendCommand("Game", {id: this.vrObject.id, action:"join"});
      // TODO replace current HUD with in-game HUD
    }
    this.joinDlg = null;
  }

  quitGame() {
    this.playing = false;
    VRSPACE.sendCommand("Game", {id: this.vrObject.id, action:"quit"});
    // TODO replace in-game HUD with previous one
  }
  
  addIndicator(baseMesh,icon,color=new BABYLON.Color4(1,1,1,1)) {
    if ( typeof baseMesh.GameIndicator !== "undefined") {
      //baseMesh.GameIndicator.material.emissiveTexture = new BABYLON.Texture(icon, this.scene);
      baseMesh.GameIndicator.material.diffuseTexture = new BABYLON.Texture(icon, this.scene);
    } else {
      let indicator = BABYLON.MeshBuilder.CreatePlane("IndicatorIcon", {}, this.scene);
      indicator.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;
      let material = new BABYLON.StandardMaterial("IndicatorMaterial",this.scene);
      //material.emissiveTexture = new BABYLON.Texture(icon, this.scene);
      material.diffuseTexture = new BABYLON.Texture(icon, this.scene);
      material.disableLighting = true;
      material.alpha = 0;
      material.alphaMode = BABYLON.Constants.ALPHA_ONEONE;
      //material.backFaceCulling = false;
      indicator.material = material;
      indicator.position = new BABYLON.Vector3(0,2.5,0);
      //indicator.rotation = new BABYLON.Vector3(Math.PI,0,0);
      indicator.parent = baseMesh;
      baseMesh.GameIndicator = indicator;
      this.indicators.push(indicator);
    }
    baseMesh.GameIndicator.material.emissiveColor = color;
  }
  
  updateStatus() {
    // may not be displayed before this player joins/after quit/etc
    if ( this.gameStatus ) {
      this.gameStatus.numberOfPlayers(this.totalPlayers);
    }
  }

  playSound( avatarBase, soundName ) {
    if ( typeof avatarBase.SoundPlaying !== "undefined" ) {
      avatarBase.SoundPlaying.stop();
      delete avatarBase.SoundPlaying;
    }
    if ( soundName && avatarBase[soundName] ) {
      avatarBase[soundName].play();
      avatarBase.SoundPlaying = avatarBase[soundName];
    }
  }
  changePlayerStatus( playerEvent, soundName, icon, color ) {
    if ( playerEvent.className == VRSPACE.me.className && playerEvent.id == VRSPACE.me.id ) {
      // my avatar
      this.addIndicator( this.world.avatar.baseMesh(), icon, color);
      //this.playSound(this.camera, soundName); // this can't be right
      return VRSPACE.me;
    } else {
      // someone else
      let user = this.players.find(user => user.id == playerEvent.id);
      // CHECKME in some cases this avatar may not exist
      this.addIndicator( user.avatar.baseMesh(), icon, color );
      this.playSound( user.avatar.baseMesh(), soundName);
      return user;
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
      this.soundFail,
      this.scene, 
      null, // callback 
      options
    );
    fail.attachToMesh(baseMesh);
    baseMesh.SoundFail = fail;

    let victory = new BABYLON.Sound(
      "victory",
      this.soundVictory,
      this.scene, 
      null, // callback 
      options
    );
    victory.attachToMesh(baseMesh);
    baseMesh.SoundVictory = victory;

    options.loop = true;

    let alarm = new BABYLON.Sound(
      "alarm",
      this.soundAlarm,
      this.scene, 
      null, // callback 
      options
    );
    alarm.attachToMesh(baseMesh);
    baseMesh.SoundAlarm = alarm;
    
    let seek = new BABYLON.Sound(
      "alarm",
      this.soundSeek,
      this.scene, 
      null, // callback 
      options
    );
    seek.attachToMesh(baseMesh);
    baseMesh.SoundSeek = seek;

  }
  
  removeSound(baseMesh, soundName) {
    // non-existing sound is fine, it may have been removed (user quit)
    // or was never attached (SoundPlaying)
    if ( typeof baseMesh[soundName] != "undefined") {
      //console.log("Removing sound "+soundName+" from ",baseMesh);
      baseMesh[soundName].detachFromMesh();
      baseMesh[soundName].dispose();
      delete baseMesh[soundName];
    } else {
      //console.error("Undefined sound "+soundName+" for ",baseMesh);
    }
  }
  
  detachSounds(baseMesh) {
    this.removeSound(baseMesh, "SoundVictory");
    this.removeSound(baseMesh, "SoundFail");
    this.removeSound(baseMesh, "SoundAlarm");
    this.removeSound(baseMesh, "SoundSeek");
    this.removeSound(baseMesh, "SoundPlaying");
  }

  // requires player avatar to be already loaded - may not be safe for async usage
  playerJoins(player) {
    let id = new ID(player.className,player.id);
    if ( id.className == VRSPACE.me.className && id.id == VRSPACE.me.id ) {
      this.attachSounds(VRSPACEUI.hud.root);
      // CHECKME: players list contains my avatar?
      this.players.push(VRSPACE.me);
    } else {
      let user = VRSPACE.getScene().get(id.toString());
      if ( user ) {
        this.players.push(user);
        this.attachSounds(user.avatar.baseMesh());
      } else {
        console.error( id +" joined the game but is not in local scene");
      }
    }
  }
  
  startCountDown(delay, chatLog) {
    let countForm = new CountDown(delay, this.isMine());
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
      if (chatLog) {
        chatLog.group.setEnabled(false);
      }
      this.camera.detachControl();
      this.pipeline = new BABYLON.LensRenderingPipeline('lens', {
        edge_blur: 1.0,
        chromatic_aberration: 1.0,
        distortion: 2.0,
        dof_focus_distance: 0.5,
        dof_aperture: 3.0,
        grain_amount: 1.0,
        dof_pentagon: true,
        dof_gain: 1.0,
        dof_threshold: 1.0,
        dof_darken: 0.35
      }, this.scene, 1.0, this.scene.cameras);
     
    }
    
    let countDown = setInterval( () => {
      if ( delay-- <= 0 ) {
        if (chatLog) {
          chatLog.group.setEnabled(true);
        }
        this.camera.attachControl();
        clearInterval(countDown);
        countForm.dispose();
        timerSound.dispose();
        tickSound.dispose();
        startSound.play();
        this.gameStarted = true;
        if ( this.pipeline ) {
          this.pipeline.dispose();
          delete this.pipeline;
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
  
  remoteChange(vrObject, changes) {
    console.log("Remote changes for "+vrObject.id, changes);
    if ( changes.joined ) {
      this.totalPlayers++;
      this.updateStatus();
      this.playerJoins(changes.joined);
    } else if ( changes.quit ) {
      this.totalPlayers--;
      this.updateStatus();
      let id = new ID(changes.quit.className,changes.quit.id);
      if ( id.className == VRSPACE.me.className && id.id == VRSPACE.me.id ) {
        // I quit
        this.closeGameStatus();
        this.detachSounds(VRSPACEUI.hud.root);
      } else {
        // CHECKME this may fail if user has disconnected (avatar removed from the scene)
        let user = VRSPACE.getScene().get(id.toString());
        if ( user ) {
          let pos = this.players.indexOf(user);
          if ( pos > -1 ) {
            this.detachSounds(user.avatar.baseMesh());
            this.players.splice(pos,1);
          }
        } else {
          console.error( id +" quit the game but is not in local scene");
        }
      }
    } else if (changes.seen && this.playing) {
      let id = changes.seen.className+" "+changes.seen.id;
      if ( ! this.seen.hasOwnProperty(id) ) {
        let player = this.changePlayerStatus(changes.seen, "SoundAlarm", this.foundIcon);
        this.seen[id] = player;
      }
    } else if ( changes.starting ) {
      if ( this.playing ) {
        this.closeGameStatus();
        this.delay = changes.starting;
        this.startCountDown(this.delay, this.world.chatLog);
        // also add all players that joined the game before this instance was created
        this.vrObject.players.forEach(player=>this.playerJoins(player));
      } else if ( this.joinDlg ) {
        this.joinDlg.close();
        this.joinDlg = null;
      }
    } else if ( changes.start && this.playing) {
      this.gameStarted = true;
      this.seeker = this.changePlayerStatus(changes.start, "SoundSeek", this.searchIcon);
    } else if (changes.won && this.playing) {
      let id = changes.won.className+" "+changes.won.id;
      let player = this.changePlayerStatus(changes.won, "SoundVictory", this.wonIcon, new BABYLON.Color4(0,1,0,1));
      this.winners[id] = player;
      delete this.seen[id];
      this.showGameStatus();
      this.checkEnd()
    } else if (changes.lost && this.playing) {
      let id = changes.lost.className+" "+changes.lost.id;
      let player = this.changePlayerStatus(changes.lost, "SoundFail", this.lostIcon, new BABYLON.Color4(1,0,0,1));
      this.losers[id] = player;
      delete this.seen[id];
      this.showGameStatus();
      this.checkEnd()
    } else if ( changes.end && this.playing) {
      this.playing = false;
      this.showGameStatus();
      let endSound = new BABYLON.Sound(
        "gong",
        this.soundEnd,
        this.scene,
        null,
        {loop: false, autoplay: true }
      );
      endSound.play();
    } else {
      console.log("Unknown/ignored notification: ", changes);
    }
  }
 
  startGame() {
    // and then
    if ( this.isMine() ) {
      this.startTime = Date.now();
      VRSPACE.sendEvent(this.vrObject, {status: "started", starting: this.gameStatus.getDelay() });
    }
  }
  
  inGoalRange(pos) {
    let dx = pos.x - this.goal.position.x;
    let dz = pos.z - this.goal.position.z;
    let radius = Math.sqrt( dx*dx + dz*dz );
    return radius <= this.goalRadius;
  }
  
  avatarPosition() {
    if ( typeof this.world.camera3p !== "undefined" && this.scene.activeCamera == this.world.camera3p ) {
      return this.world.avatar.baseMesh().position;
    }
    return this.scene.activeCamera.position;
  }
 
  checkEnd() {
    if ( this.isMine() && Object.keys(this.winners).length + Object.keys(this.losers).length + 1 == this.players.length ) {
      VRSPACE.sendEvent(this.vrObject, {end: Date.now() - this.startTime });
    }
  }
  
  checkVisibility() {
    let visible = this.visibilitySensor.getVisibleUsers(this.players);
    if ( visible.length > 0 ) {
      // anyone not seen before?
      visible.forEach( (user) => {
        let id = user.className+" "+user.id;
        if ( ! this.seen.hasOwnProperty(id) && !this.winners.hasOwnProperty(id) && !this.losers.hasOwnProperty(id)) {
          let player = this.changePlayerStatus(user, "SoundAlarm", this.foundIcon);
          this.seen[id] = player;
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
      // am I at the goal area?
      if ( this.inGoalRange(this.avatarPosition()) ) {
        for ( let id in this.seen ) {
          if ( !this.winners.hasOwnProperty(id) && !this.losers.hasOwnProperty(id) ) {
            let vrObject = this.seen[id];
            VRSPACE.sendEvent(this.vrObject, {lost: {className: vrObject.className, id: vrObject.id} });
         }
        }
      }
      
    }
  }
  
}