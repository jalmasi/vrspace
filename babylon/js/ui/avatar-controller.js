class AvatarAnimation {
  constructor(animations) {
    this.animations = animations;
    this.walk = null;
    this.idle = null;
    this.otherAnimations = [];
    this.processAnimations()
  }
  /**
   * Called from constructor to find walk and idle animations.
   */
  processAnimations() {
    this.animations.forEach( a => {
      console.log(a);
      var name = a.toLowerCase();
      if ( name.indexOf('walk') >= 0 ) {
        if ( this.walk ) {
          // already exists, we're not going to replace it just like that
          if ( name.indexOf('place') >= 0) {
            this.walk = a;
            console.log("Walk: "+name);
          } else if ( this.walk.length > name.length ) {
            this.walk = a;
            console.log("Walk: "+name);
          } else {
            this.otherAnimations.push(a);
          }
        } else {
          this.walk = a;
          console.log("Walk: "+name);
        }
      } else if ( name.indexOf('idle') >= 0 ) {
        // idle animation with shortest name
        if ( this.idle ) {
          if ( this.idle.length > name.length ) {
            this.idle = a;
            console.log("Idle: "+name);
          } else {
            this.otherAnimations.push(a);
          }
        } else {
          this.idle = a;
          console.log("Idle: "+name);
        }
      } else {
        this.otherAnimations.push(a);
      }
    });
  }

}

class AvatarMovement {
  constructor(world, avatar, animation) {
    this.world = world;
    this.avatar = avatar;
    this.animation = animation;
    this.movementTracker = null; // world manager mesh
    this.trackingCameraRotation = false;
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

  startAnimation(name) {
    if ( name != null ) {
      this.avatar.startAnimation(name);
    }
  }
  
  addVector(direction) {
    if ( !this.state[direction] ) {
      if ( this.movingDirections == 0 ) {
        // movement just starting
      }
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
    if ( this.movingDirections === 0 ) {
      this.stopMovement();
    }
  }

  stopMovement() {
    this.stop();
    console.log("movement stopped");
    this.startAnimation(this.animation.idle);
  }
  
  stopTrackingCameraRotation() {
    if ( this.applyRotationToMesh ) {
      this.world.scene.unregisterBeforeRender( this.applyRotationToMesh );
      this.applyRotationToMesh = null;
      this.trackingCameraRotation = false;
    }
  }

  startTrackingCameraRotation() {
    if ( ! this.applyRotationToMesh ) {
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
      this.trackingCameraRotation = true;
    }
  }
  
  moveToTarget(point) {
    if ( this.movingDirections > 0 ) {
      return;
    }
    this.movementTarget = new BABYLON.Vector3(point.x, point.y, point.z);
    this.direction = this.movementTarget.subtract(this.avatar.parentMesh.position);
    this.movingToTarget = true;
    console.log("moving to target ", point, " direction "+this.direction);
    
    let currentDirection = new BABYLON.Vector3(0,0,-1);
    currentDirection.rotateByQuaternionToRef(this.avatar.parentMesh.rotationQuaternion,currentDirection);
    let rotationMatrix = new BABYLON.Matrix();
    BABYLON.Matrix.RotationAlignToRef(currentDirection.normalizeToNew(), this.direction.normalizeToNew(), rotationMatrix);
    let quat = BABYLON.Quaternion.FromRotationMatrix(rotationMatrix);

    //this.stopTrackingCameraRotation(); // to test avatar rotation animation
    if ( this.trackingCameraRotation ) {
      // rotate 3p camera
      let angle = quat.toEulerAngles().y;
      if ( ! this.cameraAnimation ) {
        this.cameraAnimation = new BABYLON.Animation("camera-rotation-alpha", "alpha", 5, BABYLON.Animation.ANIMATIONTYPE_FLOAT);
        this.world.camera3p.animations.push(this.cameraAnimation);
      }
  
      let keys = [ 
        {frame: 0, value: this.world.camera3p.alpha},
        {frame: 1,value: this.world.camera3p.alpha-angle}
      ];
  
      this.cameraAnimation.setKeys(keys);
      this.world.scene.beginAnimation(this.world.camera3p, 0, 10, false, 1);
      
    } else {
      // rotate avatar
      //this.avatar.parentMesh.rotationQuaternion.multiplyInPlace(quat);
      if ( ! this.avatarRotationAnimation ) {
        this.avatarRotationAnimation = VRSPACEUI.createQuaternionAnimation(this.avatar.parentMesh, "rotationQuaternion", 5);
      }
      VRSPACEUI.updateQuaternionAnimation(this.avatarRotationAnimation, this.avatar.parentMesh.rotationQuaternion.clone(), this.avatar.parentMesh.rotationQuaternion.multiply(quat));
    }
  }

  moveAvatar() {
    if ( this.world.scene.activeCamera !== this.world.camera3p || (this.movingDirections == 0 && !this.movingToTarget)) {
      return;
    }
    if ( this.timestamp == 0 ) {
      console.log('movement started');
      this.timestamp = Date.now();
      this.movementStart = Date.now();
      this.startAnimation(this.animation.walk);
      return;
    } else if ( this.movingToTarget && this.movementStart + this.movementTimeout < this.timestamp ) {
      // could not reach the destination, stop
      console.log("Stopping movement due to timeout");
      this.stop();
      this.startTrackingCameraRotation();
      return;
    }
    var old = this.timestamp;
    this.timestamp = Date.now();
    var delta = (this.timestamp - old)/10; // FIXME depends on FPS?
    //var distance = this.world.camera3p.speed * delta;
    var distance = this.world.camera1p.speed * delta;
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
        this.stopMovement();
      } else if ( this.xDist && this.zDist && xDist > this.xDist && zDist > this.zDist ) {
        console.log("Missed destination: "+avatarMesh.position+" by "+xDist+","+zDist);
        this.stopMovement();
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

  dispose() {
    this.stopTrackingCameraRotation();
    if ( this.cameraAnimation ) {
      let pos = this.world.camera3p.animations.indexOf(this.cameraAnimation);
      if ( pos > -1 ) {
        this.world.camera3p.animations.splice(pos,1);
      }
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
    /** Timestamp of last change */
    this.lastChange = Date.now();
    /** After not receiving any events for this many millis, idle animation starts */
    this.idleTimeout = 200;
    this.lastAnimation = null;
    this.worldManager = worldManager;
    this.world = worldManager.world;
    this.scene = worldManager.scene;

    if ( this.world.camera3p ) {
      this.world.camera3p.setTarget(avatar.headPosition);
    }
    if ( this.world.camera1p ) {
      this.world.camera1p.parent = avatar.parentMesh;
    }
    
    avatar.parentMesh.ellipsoidOffset = new BABYLON.Vector3(0,1,0);
    
    this.animations = [];
    var groups = avatar.getAnimationGroups();
    groups.forEach( group => this.animations.push(group.name));
    this.animation = new AvatarAnimation(this.animations);
    
    this.setupIdleTimer();
    // event handlers
    this.keyboardHandler = (kbInfo) => this.handleKeyboard(kbInfo);
    this.cameraHandler = () => this.cameraChanged();
    this.scene.onActiveCameraChanged.add(this.cameraHandler);
    // movement state variables and constants
    this.movement = new AvatarMovement(this.world, avatar, this.animation);
    this.movementHandler = () => this.movement.moveAvatar();
    this.clickHandler = (pointerInfo) => this.handleClick(pointerInfo);

    this.cameraChanged();
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
        this.sendAnimation(this.animation.idle);
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
        this.sendAnimation(this.animation.walk,true);
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
      this.movement.startTrackingCameraRotation();
    } else {
      this.scene.onKeyboardObservable.remove(this.keyboardHandler);
      this.scene.onPointerObservable.remove( this.clickHandler );
      this.scene.unregisterBeforeRender(this.movementHandler);
      this.movement.stopTrackingCameraRotation();
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
      if (pointerInfo.event.button == 0 && this.world.getFloorMeshes().includes(pointerInfo.pickInfo.pickedMesh)) {
        this.movement.moveToTarget(pointerInfo.pickInfo.pickedPoint);
      }
    }
  }

  // TODO
  dispose() {
    this.scene.onKeyboardObservable.remove(this.keyboardHandler);
    this.scene.onPointerObservable.remove( this.clickHandler );
    this.scene.unregisterBeforeRender(this.movementHandler);
    this.movement.dispose();
  }
}