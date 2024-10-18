import { BasicScript } from "../scripts/basic-script.js";
import { VRSPACE } from "../client/vrspace.js";
import { VRSPACEUI } from '../ui/vrspace-ui.js';
import { Dialogue } from "../ui/widget/dialogue.js";
import { GameStatusForm } from "./game-status-form.js";

/**
 * Base class for a simple multiuser game.
 * Contains utility methods to create, join and quit the game, that open appropriate forms and dialogues.
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
    /** Callback executed with true/false when game starts/ends */
    this.callback = null;
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
    this.gameStatus.gameStarted = this.gameStarted;
    this.gameStatus.init();
    this.gameStatus.numberOfPlayers(this.totalPlayers);
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
   * Clean up dialogue and status form
   */
  dispose() {
    if ( this.joinDlg ) {
      this.joinDlg.close();
      this.joinDlg = null;
    }
    this.closeGameStatus();
  }
  
}