/**
 * Tag has a lot of meanings and uses, class name contains Game to avoid confusion.
 * 
 * In the game of tag, players try to catch each other. Player caught becomes the hunter.
 */
export class GameTag extends BasicScript {
 
  static createOrJoinInstance(callback) {
    if ( GameTag.instance ) {
      // already exists
      if ( ! HideAndSeek.instance.callback ) {
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
 
}