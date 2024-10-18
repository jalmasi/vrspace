import { BasicScript } from "../scripts/basic-script.js";
import { VRSPACE } from "../client/vrspace.js";
import { VRSPACEUI } from '../ui/vrspace-ui.js';
import { Dialogue } from "../ui/widget/dialogue.js";
import { GameStatusForm } from "./game-status-form.js";

export class BasicGame extends BasicScript {
  constructor( world, vrObject ) {
    super(world,vrObject);
    this.gameStatus = null;
    this.playing = false;
  }

  showGameStatus() {
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

  closeGameStatus() {
    if ( this.gameStatus ) {
      VRSPACEUI.hud.clearRow();
      VRSPACEUI.hud.showButtons(true);
      this.gameStatus.dispose();
      this.gameStatus = null;
    }
  }
  
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
  
  invitePlayers() {
    if ( this.isMine() ) {
      this.joinGame(true);
    } else if ( this.vrObject.status != "started" ) {
      this.joinDlg = new Dialogue("Join "+this.vrObject.name+" ?", (yes)=>this.joinGame(yes));
      this.joinDlg.init();
    }
  }

  dispose() {
    if ( this.joinDlg ) {
      this.joinDlg.close();
      this.joinDlg = null;
    }
    this.closeGameStatus();
  }
  
}