import { BasicGame } from './basic-game.js';
import { VRSPACE } from "../client/vrspace.js";

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
  }
  
  static createOrJoinInstance(callback) {
    if ( GameTag.instance ) {
      // already exists
      if ( ! GameTag.instance.callback ) {
        GameTag.instance.callback = callback;
      }
      // TODO start
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
 
  remoteChange(vrObject, changes) {
    console.log("Remote changes for "+vrObject.id, changes);
    if ( changes.joined ) {
      this.totalPlayers++;
      this.updateStatus();
    } else if ( changes.quit ) {
      this.totalPlayers--;
      this.updateStatus();
    }
  }

}