import { BasicScript } from "../scripts/basic-script.js";
import { VRSPACE } from "../client/vrspace.js";
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
   * Main method of the game. Receives all events that happen in the game, and is supposed to implement scene changes.
   * @param {Game} vrObject game object
   * @param {Object} changes custom game event
   */
  remoteChange(vrObject, changes) {
    console.log("TODO Remote changes for "+vrObject.id, changes);
  }
   
}