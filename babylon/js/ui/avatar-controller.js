/**
This is remote control for user's avatar. Installed as change listener to WorldManager, tracks position of all events that user 
sends - typically movement - and optinally adds some more - typically avatar animations.
 */
export class AvatarController {
  constructor( worldManager, avatar ) {
    /** Name of idle animation */
    this.idle = null;
    /** Name of walk animation */
    this.walk = null;
    /** Timestamp of last change */
    this.lastChange = Date.now();
    /** Idle timeout, default 10s */
    this.idleTimeout = 200;
    this.lastAnimation = null;
    this.worldManager = worldManager;
    this.animations = [];
    var groups = avatar.getAnimationGroups();
    groups.forEach( group => this.animations.push(group.name));
    this.otherAnimations = [];
    this.processAnimations();
    this.setupIdleTimer();
  }
  
  processAnimations() {
    this.animations.forEach( a => {
      console.log(a);
      var name = a.toLowerCase();
      if ( name.indexOf('walk') >= 0 ) {
        this.walk = a;
      } else if ( name.indexOf('idle') >= 0 ) {
        this.idle = a;
      } else {
        this.otherAnimations.push(a);
      }
    });
  }
  setupIdleTimer() {
    if ( this.idleTimerId ) {
      return;
    }
    this.idleTimerId = setInterval(() => {
      if ( this.worldManager.isOnline() && Date.now() - this.lastChange > this.idleTimeout ) {
        clearInterval(this.idleTimerId);
        this.idleTimerId = null;
        this.sendAnimation(this.idle);
      }
    }, this.idleTimeout);
  }
  sendAnimation(name, loop=false) {
    if ( this.animations.includes(name) && name != this.lastAnimation ) {
      this.worldManager.sendMy({animation:{name:name,loop:loop}});
      this.lastAnimation = name;
    }
  }
  /**
  Process locally generated changes to avatar. Called from WorldManager.trackChanges().
  @param changes array of field,value object pairs
   */
  processChanges(changes) {
    if ( this.worldManager.world.inXR ) {
      // do NOT send anything while in XR
      return;
    }
    for ( var change of changes ) {
      this.lastChange = Date.now();
      if ( change.field == "position" ) {
        this.setupIdleTimer();
        this.sendAnimation(this.walk,true);
        break;
      } else if ( change.field == "rotation") {
        // CHECKME anything?
      } else if ( change.field == "wrote") {
        // process text and try to find some meaninful animation
        var words = change.value.split(' ');
        for ( var word of words ) {
          if ( word.length > 1 ) {
            var match = this.otherAnimations.find( e => e.includes(word.toLowerCase()));
            if ( match ) {
              this.sendAnimation(match);
              break;
            }
          }
        }
      }
    }
  }
  
}