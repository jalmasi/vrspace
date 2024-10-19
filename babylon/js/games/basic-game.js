import { BasicScript } from "../scripts/basic-script.js";
import { VRSPACE } from "../client/vrspace.js";
import { ID } from "../client/vrspace.js";
import { VRSPACEUI } from '../ui/vrspace-ui.js';
import { Dialogue } from "../ui/widget/dialogue.js";
import { GameStatusForm } from "./game-status-form.js";

/**
 * Base class for a simple multiuser game.
 * Contains utility methods to create, join and quit the game, that open appropriate forms and dialogues.
 * Whoever created the game owns it: only their browser executes all of game logic, 
 * and is allowed to change game state by sending events to the game object.
 * All players receive game all events, and execute the same presentation logic.
 */
export class BasicGame extends BasicScript {
  constructor( world, vrObject ) {
    super(world,vrObject);
    /** GameStatusForm, created and destroyed by show/close game status methods */
    this.gameStatus = null;
    /** Dialogue, created and destroyed by invitePlayers/joinGame methods */
    this.joinDlg = null;
    /** Status flag, set in joinGame method */
    this.playing = false;
    /** Game status flag, supposed to be set on remote event */
    this.gameStarted = false;
    /** Callback executed with true/false when game starts/ends */
    this.callback = null;
    /** Number of players at the moment of creation, copied from the shared object */
    this.totalPlayers = vrObject.numberOfPlayers;
    /** Shared delay, set initially and updated once the game starts */
    this.delay = 10;
    /** Minumum delay, limits the slider */
    this.minDelay = 10;
    /** Maximum delay, limits the slider */
    this.maxDelay = 30;
    /** Start time in milliseconds, set once the game starts - owner only */
    this.startTime = 0;
    /** Player list, contains User objects */
    this.players = [];
    this.indicators = [];
  }

  /**
   * Creates a new HUD row, and opens a new GameStatusForm to start or join the game.
   */
  showGameStatus() {
    this.closeGameStatus(); // just in case
    VRSPACEUI.hud.showButtons(false);
    VRSPACEUI.hud.newRow();
    this.gameStatus = new GameStatusForm(this.isMine(), (start)=>{
      if ( start ) {
        this.startGame();
      } else {
        this.quitGame();
      }
    });
    this.gameStatus.delayMin = this.minDelay;
    this.gameStatus.delayMax = this.maxDelay;
    this.gameStatus.delay = this.delay;
    this.gameStatus.gameStarted = this.gameStarted;
    this.gameStatus.init();
    this.gameStatus.numberOfPlayers(this.totalPlayers);
  }

  /**
   * Sets number of players in game status form, if currently open.
   */
  updateStatus() {
    // may not be displayed before this player joins/after quit/etc
    if ( this.gameStatus ) {
      this.gameStatus.numberOfPlayers(this.totalPlayers);
    }
  }

  
  /**
   * If the game is owned by current user, sends start event.
   */
  startGame() {
    // and then
    if ( this.isMine() ) {
      this.startTime = Date.now();
      VRSPACE.sendEvent(this.vrObject, {status: "started", starting: this.gameStatus.getDelay() });
    }
  }
  
  /**
   * Close GameStatusForm if currently open, and restore the HUD.
   */
  closeGameStatus() {
    if ( this.gameStatus ) {
      VRSPACEUI.hud.clearRow();
      VRSPACEUI.hud.showButtons(true);
      this.gameStatus.dispose();
      this.gameStatus = null;
    }
  }
  
  /**
   * Join the game - shows game status and sends game join command to the server.
   * @param {boolean} yes  
   */
  joinGame(yes) {
    this.playing = yes;
    if ( yes ) {
      this.showGameStatus();
      VRSPACE.sendCommand("Game", {id: this.vrObject.id, action:"join"});
    }
    this.joinDlg = null;
  }

  /**
   * Quit the game - sends the command to the server, optionally calls this.callback with false.
   */
  quitGame() {
    this.playing = false;
    VRSPACE.sendCommand("Game", {id: this.vrObject.id, action:"quit"});
    if ( this.callback ) {
      this.callback(false);
    }
  }
  
  /**
   * Typically the first thing to do. Game owner joins the game at once, everyone else gets the dialogue,
   * that triggers this.joinGame() as callback. 
   */
  invitePlayers() {
    if ( this.isMine() ) {
      this.joinGame(true);
    } else if ( this.vrObject.status != "started" ) {
      this.joinDlg = new Dialogue("Join "+this.vrObject.name+" ?", (yes)=>this.joinGame(yes));
      this.joinDlg.init();
    }
  }

  /**
   * Calls either showGameStatus, or invitePlayers, as appropriate.
   * Supposed to be executed on button click, if game instance already exists.
   */
  startRequested() {
    if ( this.isMine() || this.gameStarted ) {
      // player has already joined
      this.showGameStatus();
    } else if ( ! this.gameStarted ) {
      // player wants to join
      this.invitePlayers();
    }
  }

  /**
   * Clean up dialogue and status form
   */
  dispose() {
    if ( this.joinDlg ) {
      this.joinDlg.close();
      this.joinDlg = null;
    }
    this.closeGameStatus();
  }

  /**
   * Helper method, returns current position the avatar, in either 1st or 3rd person view.
   */
  avatarPosition() {
    if ( typeof this.world.camera3p !== "undefined" && this.scene.activeCamera == this.world.camera3p ) {
      return this.world.avatar.baseMesh().position;
    }
    return this.scene.activeCamera.position;
  }

  /** Helper method to attach an icon above the avatar */
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

  /** 
   * Removes and disposes indicator from the base mesh and from list of indicators.
  */
  removeIndicator(baseMesh) {
    if ( typeof baseMesh.GameIndicator != undefined ) {
      let indicator = baseMesh.GameIndicator;
      let pos = this.indicators.indexOf(indicator);
      if ( pos > -1 ) {
        // TODO also remove indicators
        this.indicators.splice(pos,1);
      }
      indicator.dispose();
      delete baseMesh.GameIndicator;
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
      return VRSPACE.me;
    } else {
      // someone else
      let user = this.players.find(user => user.id == playerEvent.id);
      // CHECKME in some cases this avatar may not exist
      this.addIndicator( user.avatar.baseMesh(), icon, color );
      if ( soundName ) {
        this.playSound( user.avatar.baseMesh(), soundName);
      }
      return user;
    }
  }

  /**
   * Attach sounds to avatar mesh, called when player joins; this implementation does nothing.
   */
  attachSounds( avatarMesh ) {
  }

  /**
   * Remove sounds from avatar mesh, called when player quits; this implementation does nothing.
   */
  removeSounds( avatarMesh ) {
  }

  /**
   * Helper method to be executed when a player joins the game, including the one that starts the game.
   * Adds the player to the player list, and calls attachSounds witht he player avatar.
   * When local player joins the game, the callback is called with true (if set).
   * Requires player avatar to be already loaded - may not be safe for async usage.
   * @param {Object} player object containing className and id of the player (User object will do) 
   */
  playerJoins(player) {
    let id = new ID(player.className,player.id);
    if ( id.className == VRSPACE.me.className && id.id == VRSPACE.me.id ) {
      this.attachSounds(VRSPACEUI.hud.root);
      this.players.push(VRSPACE.me);
      if ( this.callback ) {
        this.callback(true);
      }
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

  /**
   * Helper method to be executed when a player quits the game, including the game owner.
   * Finds the player avatar and detaches attached sounds and indicator, then removes it from the player list.
   * If this player has quit, also closes the the game status.
   * @param {Object} player object containing className and id of the player (User object will do) 
   */
  playerQuits(player) {
    let id = new ID(player.className,player.id);
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
          this.removeIndicator(user.avatar.baseMesh());
          this.players.splice(pos,1);
        }
      } else {
        console.error( id +" quit the game but is not in local scene");
      }
    }
  }
 
  /**
   * Main method of the game. Receives all events that happen in the game, and is supposed to implement scene changes.
   * @param {Game} vrObject game object
   * @param {Object} changes custom game event
   */
  remoteChange(vrObject, changes) {
    console.log("TODO Remote changes for "+vrObject.id, changes);
  }
   
}