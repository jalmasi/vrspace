class AvatarMovement {
  constructor(world, avatar) {
    this.world = world;
    this.avatar = avatar;
    this.movementTracker = null; // world manager mesh
    this.vector = {
      left: new BABYLON.Vector3(1, 0, 0),
      right: new BABYLON.Vector3(-1, 0, 0),
      forward: new BABYLON.Vector3(0, 0, -1),
      back: new BABYLON.Vector3(0, 0, 1),
      up: new BABYLON.Vector3(0, .5, 0),
      down: new BABYLON.Vector3(0, -1, 0)
    };
    this.stop();
  }

  stop() {
    this.timestamp = 0;
    this.movingDirections = 0;
    this.direction = new BABYLON.Vector3(0,0,0);
    this.movingToTarget = false;
    this.movementTarget = null;
    this.xDist = null;
    this.zDist = null;
    this.movementTimeout = 5000;
    this.state = {
      left: false,
      right: false,
      forward: false,
      back: false,
      up: false
    }
  }

  addVector(direction) {
    if ( !this.state[direction] ) {
      this.direction.addInPlace( this.vector[direction] );
      this.state[direction] = true;
      this.movingDirections++;
    }
  }
  
  removeVector(direction) {
    if ( this.state[direction] ) {
      this.direction.subtractInPlace( this.vector[direction] );
      this.state[direction] = false;
      this.movingDirections--;
    }
  }

  stopTrackingRotation() {
    if ( this.applyRotationToMesh ) {
      this.world.scene.unregisterBeforeRender( this.applyRotationToMesh );
      this.applyRotationToMesh = null;
    }
  }

  startTrackingRotation() {
    this.applyRotationToMesh = () => {
      var rotY = .5*Math.PI-this.world.camera3p.alpha;
      // convert alpha and beta to mesh rotation.y and rotation.x
      //this.avatar.parentMesh.rotation.y = rotY;
      this.avatar.parentMesh.rotationQuaternion = new BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y,rotY);
      //movementTracker.rotation.y = rotY;
      // and now also apply rotation to 1st person camera
      //this.world.camera.rotation.z = 0;
      //this.world.camera.rotation.y = 1.5*Math.PI-this.world.camera3p.alpha;
      //this.world.camera.rotation.x = 0;
    }
    this.world.scene.registerBeforeRender( this.applyRotationToMesh );
  }
  
  moveToTarget(point) {
    if ( this.movingDirections > 0 ) {
      return;
    }
    this.movementTarget = new BABYLON.Vector3(point.x, point.y, point.z);
    this.direction = this.movementTarget.subtract(this.avatar.parentMesh.position);
    this.movingToTarget = true;
    this.stopTrackingRotation();
  }

  moveAvatar() {
    if ( this.world.scene.activeCamera !== this.world.camera3p || (this.movingDirections == 0 && !this.movingToTarget)) {
      return;
    }
    if ( this.timestamp == 0 ) {
      console.log('movement started');
      this.timestamp = Date.now();
      this.movementStart = Date.now();
      return;
    } else if ( this.movingToTarget && this.movementStart + this.movementTimeout < this.timestamp ) {
      // could not reach the destination, stop
      console.log("Stopping movement due to timeout");
      this.stop();
      this.startTrackingRotation();
      return;
    }
    var old = this.timestamp;
    this.timestamp = Date.now();
    var delta = (this.timestamp - old)/100; // CHECKME this was supposed to be 1000!
    var distance = this.world.camera3p.speed * delta;
    var gravity = new BABYLON.Vector3(0,this.world.scene.gravity.y,0);
    
    var avatarMesh = this.avatar.parentMesh;
    
    var direction = this.direction.add(gravity).normalize().scale(distance);
    if ( this.movingDirections > 0 ) {
      var angle = -1.5*Math.PI-this.world.camera3p.alpha;
      var rotation = BABYLON.Quaternion.RotationAxis( BABYLON.Axis.Y, angle);
      direction.rotateByQuaternionToRef( rotation, direction );
      avatarMesh.moveWithCollisions(direction);
    } else if ( this.movingToTarget ) {
      // on click, moving without gravity
      var xDist = Math.abs(avatarMesh.position.x - this.movementTarget.x);
      var zDist = Math.abs(avatarMesh.position.z - this.movementTarget.z);
      if ( xDist < 0.2 && zDist < 0.2) {
        console.log("Arrived to destination: "+avatarMesh.position);
        this.stop();
        this.startTrackingRotation();
      } else if ( this.xDist && this.zDist && xDist > this.xDist && zDist > this.zDist ) {
        console.log("Missed destination: "+avatarMesh.position+" by "+xDist+","+zDist);
        this.stop();
        this.startTrackingRotation();
      } else {
        avatarMesh.moveWithCollisions(direction);
        this.xDist = xDist;
        this.zDist = zDist;
      }
    }
    if ( this.movementTracker ) {
      this.movementTracker.position = avatarMesh.position;
    }
  }

}

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
    this.world = worldManager.world;
    this.scene = worldManager.scene;
    this.animations = [];
    var groups = avatar.getAnimationGroups();
    groups.forEach( group => this.animations.push(group.name));
    this.otherAnimations = [];
    this.processAnimations();
    this.setupIdleTimer();
    // event handlers
    this.keyboardHandler = (kbInfo) => this.handleKeyboard(kbInfo);
    this.cameraHandler = () => this.cameraChanged();
    this.scene.onActiveCameraChanged.add(this.cameraHandler);
    // movement state variables and constants
    this.movement = new AvatarMovement(this.world, avatar);
    this.movementHandler = () => this.movement.moveAvatar();
    this.clickHandler = (pointerInfo) => this.handleClick(pointerInfo);
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
  
  cameraChanged() {
    if ( this.scene.activeCamera === this.world.camera3p ) {
      this.scene.onKeyboardObservable.add( this.keyboardHandler );
      this.scene.onPointerObservable.add( this.clickHandler );
      this.scene.registerBeforeRender(this.movementHandler);
      this.movement.startTrackingRotation();
    } else {
      this.scene.onKeyboardObservable.remove(this.keyboardHandler);
      this.scene.onPointerObservable.remove( this.clickHandler );
      this.scene.unregisterBeforeRender(this.movementHandler);
      this.movement.stopTrackingRotation();
    }
  }
  
  handleKeyboard(kbInfo) {
    if (this.scene.activeCamera !== this.world.camera3p) {
      return;
    }
    switch (kbInfo.type) {
      case BABYLON.KeyboardEventTypes.KEYDOWN:
        switch (kbInfo.event.key) {
          case "a":
          case "A":
          case "ArrowLeft":
            this.movement.addVector('left');
            break;
          case "d":
          case "D":
          case "ArrowRight":
            this.movement.addVector('right');
            break;
          case "w":
          case "W":
          case "ArrowUp":
            this.movement.addVector('forward');
            break;
          case "s":
          case "S":
          case "ArrowDown":
            this.movement.addVector('back');
            break;
          case "PageUp":
          case " ":
            this.movement.addVector('up');
            break;
          default:
            break;
        }
        break;
      case BABYLON.KeyboardEventTypes.KEYUP:
        switch (kbInfo.event.key) {
          case "a":
          case "A":
          case "ArrowLeft":
            this.movement.removeVector('left');
            break;
          case "d":
          case "D":
          case "ArrowRight":
            this.movement.removeVector('right');
            break;
          case "w":
          case "W":
          case "ArrowUp":
            this.movement.removeVector('forward');
            break;
          case "s":
          case "S":
          case "ArrowDown":
            this.movement.removeVector('back');
            break;
          case "PageUp":
          case " ":
            this.movement.removeVector('up');
            break;
          default:
            break;
        }
        break;
    }
  }

  handleClick(pointerInfo) {
    if (pointerInfo.type == BABYLON.PointerEventTypes.POINTERUP ) {
      //console.log(pointerInfo);
      // LMB: 0, RMB: 2
      if ( pointerInfo.event.button == 0 ) {
        this.movement.moveToTarget(pointerInfo.pickInfo.pickedPoint);
      }
    }
  }

  // TODO
  dispose() {
  }
}