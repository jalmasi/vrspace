/**
This is remote control for user's avatar. Installed as change listener to WorldManager, tracks position of all events that user 
sends - typically movement - and optinally adds some more - typically avatar animations.
E.g. when position changes, it sends 'walk' animation, if current avatar has animation named 'walk'.
User stops, it sends 'idle' animation, if current avatar has animation named 'idle'.
So all other users see this avatar moving and idling. 
 */
export class AvatarController {
  constructor( worldManager, avatar ) {
    /** Name of idle animation */
    this.idle = null;
    /** Name of walk animation */
    this.walk = null;
    /** Timestamp of last change */
    this.lastChange = Date.now();
    /** After not receiving any events for this many millis, idle animation starts */
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
  
  /**
   * Called from constructor to find walk and idle animations.
   */
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
  /**
   * Create timer for idle animation, if it doesn't exist.
   */
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
  /**
   * Send an animation to the server, if the avatar has it.
   * @param name animation name
   * @param loop default false
   */
  sendAnimation(name, loop=false) {
    if ( this.animations.includes(name) && name != this.lastAnimation && this.worldManager.isOnline() ) {
      this.worldManager.sendMy({animation:{name:name,loop:loop}});
      this.lastAnimation = name;
    }
  }
  /**
  Process locally generated changes to avatar. Called from WorldManager.trackChanges().
  Position changes also change idle animation timer, and wrote event may trigger appropriate animation.
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