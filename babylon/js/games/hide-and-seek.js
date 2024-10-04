import { BasicScript } from "../scripts/basic-script.js";
import { VisibilitySensor } from "../world/visibility-sensor.js";
import { Dialogue } from "../ui/widget/dialogue.js";
import { VRSPACE } from "../client/vrspace.js";
import { ID } from "../client/vrspace.js";
import { VRSPACEUI } from '../ui/vrspace-ui.js';
import { Form } from '../ui/widget/form.js';

class GameStatus extends Form {
  constructor(isMine, callback) {
    super();
    this.text = "Players joined: ";
    this.callback = callback;
    this.isMine = isMine;
  }  
  
  init() {
    this.verticalPanel = true;
    this.createPanel();
    this.label = this.textBlock(this.text+"0");
    this.addControl(this.label);
    if ( this.isMine ) {
      let startButton = this.textButton("Start", () => this.close(true));
      this.addControl(startButton);
    }
    let quitButton = this.textButton("Quit", () => this.close(false), VRSPACEUI.contentBase+"/content/icons/close.png", "red");
    this.addControl(quitButton);

    VRSPACEUI.hud.showButtons(false);
    VRSPACEUI.hud.newRow();
    VRSPACEUI.hud.addForm(this,512,256);
  }
  
  close(start) {
    VRSPACEUI.hud.clearRow();
    VRSPACEUI.hud.showButtons(true);
    super.dispose();
    this.callback(start);
  }
  
  numberOfPlayers(num) {
    this.label.text = this.text+num;
  }
}

/**
 * Super original hide and seek game!
 * 
 * Player that started the game needs to search for other players.
 * If seen, both players rush to the place where the game started, first one to arrive, scores.
 */
export class HideAndSeek extends BasicScript {
  constructor( world, vrObject ) {
    super(world,vrObject);
    this.visibilitySensor = new VisibilitySensor();
    this.fps = 5;
    this.seconds = 20;
    this.totalPlayers = vrObject.numberOfPlayers;
    this.invitePlayers();
    this.seen = {};
    this.players = [];
  }
  
  dispose() {
    this.visibilitySensor.dispose();
    this.visibilitySensor = null;
    if ( this.visibilityCheck ) {
      clearInterval(this.visibilityCheck);
    }
  }
  
  markStartingPosition() {
  }
  
  invitePlayers() {
    if ( this.isMine() ) {
      this.showGameStatus();
    } else {
      let yesNo = new Dialogue("Join "+this.vrObject.name+" ?", (yes)=>this.joinGame(yes));
      yesNo.init();
    }
  }
  
  showGameStatus() {
    this.gameStatus = new GameStatus(this.isMine(), (start)=>{
      if ( start ) {
        this.startGame();
      } else {
        this.quitGame();
      }
    });
    this.gameStatus.init();
    this.gameStatus.numberOfPlayers(this.totalPlayers);
  }
  
  joinGame(yes) {
    if ( yes ) {
      VRSPACE.sendCommand("Game", {id: this.vrObject.id, action:"join"});
      // TODO replace current HUD with in-game HUD
      this.showGameStatus();
    }
  }

  quitGame() {
    VRSPACE.sendCommand("Game", {id: this.vrObject.id, action:"quit"});
    // TODO replace in-game HUD with previous one
  }
  
  remoteChange(vrObject, changes) {
    console.log("Remote changes for "+vrObject.id, changes);
    if ( changes.joined ) {
      this.totalPlayers++;
      let id = new ID(changes.joined.className,changes.joined.id);
      if ( id.className == VRSPACE.me.className && id.id == VRSPACE.me.id ) {
        console.log("that's me");
      } else {
        let user = VRSPACE.getScene().get(id.toString());
        if ( user ) {
          this.players.push(user.avatar.baseMesh());
        } else {
          console.error( id +" joined the game but is not in local scene");
        }
      }
    } else if ( changes.quit ) {
      this.totalPlayers--;
      let id = new ID(changes.quit.className,changes.quit.id);
      if ( id.className == VRSPACE.me.className && id.id == VRSPACE.me.id ) {
        console.log("that's me");
      } else {
        let user = VRSPACE.getScene().get(id.toString());
        if ( user ) {
          let pos = this.players.indexOf(user.avatar.baseMesh());
          if ( pos > -1 ) {
            this.players.splice(pos,1);
          }
        } else {
          console.error( id +" quit the game but is not in local scene");
        }
      }
    } else if ( changes.seen ) {
      if ( changes.seen.className == VRSPACE.me.className && changes.seen.id == VRSPACE.me.id ) {
        console.log("TODO I was seen");
      } else {
        console.log("Seen: "+changes.seen);
      }
    } else if ( changes.start ) {
    } else if ( changes.end ) {
    }
    this.gameStatus.numberOfPlayers(this.totalPlayers);
  }
 
  startGame() {
    console.log("TODO: countdown");
    // and then
    if ( this.isMine() ) {
      this.visibilityCheck = setInterval( () => {
        let visible = this.visibilitySensor.getVisibleOf(this.players);
        if ( visible.length > 0 ) {
          visible.forEach( (parentMesh) => {
            let id = parentMesh.VRObject.className+" "+parentMesh.VRObject.id;
            if ( ! this.seen[id]) {
              this.seen[id] = parentMesh.VRObject;
              VRSPACE.sendEvent(this.vrObject, {seen: {className: parentMesh.VRObject.className, id: parentMesh.VRObject.id} });
            }
          });
        }
      }, 1000/this.fps);
      VRSPACE.sendCommand("Game", {id: this.vrObject.id, action:"start"});
    }
    // TODO range check, victory conditions check
  }
  
}