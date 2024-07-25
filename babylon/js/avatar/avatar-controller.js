import { AvatarAnimation } from './avatar-animation.js';

class AvatarMovement {
  constructor(avatarController, avatar, animation) {
    this.controller = avatarController;
    this.world = avatarController.world;
    this.avatar = avatar;
    this.animation = animation;
     // world manager mesh
    this.movementTracker = BABYLON.MeshBuilder.CreateSphere("avatar movement tracker", {diameter:0.1}, this.world.scene);
    this.movementTracker.isVisible = false;
    this.movementTracker.position = this.world.camera1p.position.clone();
    //this.movementTracker.ellipsoid = null;
    
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
    // we only track walk if the avatar can walk
    this.trackWalk = this.animation.canWalk();
    this.findFeet();
  }
  
  findFeet() {
    if ( ! this.avatar.body ) {
      // video avatar or mesh
      return;
    }
    // we need both feet to determine step length
    this.trackWalk &= (this.avatar.body.leftLeg.foot.length > 0) && (this.avatar.body.rightLeg.length > 0);
    if (this.trackWalk) {
      this.leftFoot = this.avatar.skeleton.bones[this.avatar.body.leftLeg.foot[0]].getTransformNode();
      this.rightFoot = this.avatar.skeleton.bones[this.avatar.body.rightLeg.foot[0]].getTransformNode();
    }
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

  startAnimation(animation) {
    if ( animation.group && animation !== this.activeAnimation ) {
      //console.log("Starting animation "+animation.group.name);
      if ( ! animation.stepLength ) {
        animation.stepLength = 0;
      }
      this.avatar.startAnimation(animation.group.name, true);
      this.activeAnimation = animation;
      this.controller.sendAnimation(animation.group, true);
    }
  }

  setSpeed(speed) {
    if ( this.activeAnimation && this.activeAnimation != this.animation.idle() && this.activeAnimation.stepLength > 0 ) {
      // assuming full animation cycle is one step with each leg
      let cycles = 1/(2*this.activeAnimation.stepLength); // that many animation cycles to walk 1m
      // so to cross 1m in 1s,
      //let animationSpeed = cycles/this.animation.animations.walk.cycleDuration;
      let animationSpeed = cycles/this.activeAnimation.cycleDuration;
      // but in babylon, camera speed 1 means 10m/s
      //this.animation.walk().speedRatio = animationSpeed*speed*10;
      this.activeAnimation.group.speedRatio = animationSpeed*speed*10;
      //console.log(this.activeAnimation.group.name+" speed "+this.activeAnimation.group.speedRatio+" step length "+this.activeAnimation.stepLength);
    }
  }
  
  addVector(direction) {
    if ( !this.state[direction] ) {
      if ( this.movingToTarget ) {
        this.stopMovement();
      }
      this.state[direction] = true;
      let capitalized = direction[0].toUpperCase() + direction.slice(1);
      if ( this.movingDirections == 0 ) {
        // movement just starting
        if ( direction == 'forward') {
          this.startMovement(this.animation.animations.walk);
        } else {
          this.startAnimation(this.animation.animations['walk'+capitalized]);
        }
      } else if ( ! this.state.back ) {
        if ( direction == 'left') {
          this.startAnimation(this.animation.animations.walkLeft);
        } else if ( direction == 'right') {
          this.startAnimation(this.animation.animations.walkRight);
        }
      }
      this.direction.addInPlace( this.vector[direction] );
      this.movingDirections++;
    }
  }
  
  removeVector(direction) {
    if ( this.state[direction] ) {
      this.direction.subtractInPlace( this.vector[direction] );
      this.state[direction] = false;
      this.movingDirections--;
      if ( this.movingDirections === 0 ) {
        this.stopMovement();
      } else if ( this.state.back ) {
        this.startAnimation(this.animation.animations.walkBack);
      } else {
        this.startAnimation(this.animation.walk());
      }
    }
  }

  stopMovement() {
    console.log("Movement stopped");
    this.stop();
    this.startAnimation(this.animation.idle());
    this.controller.sendAnimation(this.animation.idle().group, true);
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
        //console.log("avatar turnaround: "+this.avatar.turnAround);
        let ref = .5;
        if ( this.avatar.turnAround ) {
          ref = 1.5;
        }
        let rotY = ref*Math.PI-this.world.camera3p.alpha;
        let avatarMesh = this.avatar.baseMesh();
        // convert alpha and beta to mesh rotation.y and rotation.x
        avatarMesh.rotationQuaternion = new BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y,rotY);
        this.movementTracker.rotation.y = rotY;
      }
      this.world.scene.registerBeforeRender( this.applyRotationToMesh );
      this.trackingCameraRotation = true;
    }
  }
  
  startMovement(animation) {
    this.timestamp = Date.now();
    this.movementStart = Date.now();
    this.startAnimation(animation);
    this.setSpeed(this.world.camera1p.speed); // requires activeAnimation
  }
  
  moveToTarget(point) {
    if ( this.movingDirections > 0 ) {
      return;
    }
    if ( this.movingToTarget ) {
      //this.stopMovement();
      this.timestamp = Date.now();
      this.movementStart = Date.now();
      this.xDist = null;
      this.zDist = null;
    } else {
      this.startMovement(this.animation.walk());
      this.movingToTarget = true;
    }
    let avatarMesh = this.avatar.baseMesh();
    
    this.movementTarget = new BABYLON.Vector3(point.x, point.y, point.z);
    this.direction = this.movementTarget.subtract(avatarMesh.position);
    //this.stopTrackingCameraRotation();
    console.log("moving to target ", point, " direction "+this.direction);
    
    // all of below is about avatar rotation
    // none of it needed for avatar in billboard mode (e.g. video avatar)
    if ( avatarMesh.billboardMode != BABYLON.Mesh.BILLBOARDMODE_NONE ) {
      return;
    }
    
    let currentDirection = new BABYLON.Vector3(0,0,-1);
    if ( this.avatar.turnAround ) {
      currentDirection = new BABYLON.Vector3(0,0,1);
    }
    currentDirection.rotateByQuaternionToRef(avatarMesh.rotationQuaternion,currentDirection);
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
      if ( ! this.avatarRotationAnimation ) {
        this.avatarRotationAnimation = VRSPACEUI.createQuaternionAnimation(avatarMesh, "rotationQuaternion", 5);
      }
      VRSPACEUI.updateQuaternionAnimation(this.avatarRotationAnimation, avatarMesh.rotationQuaternion.clone(), avatarMesh.rotationQuaternion.multiply(quat));
    }
  }

  moveAvatar() {
    if ( this.world.scene.activeCamera === this.world.camera1p
      // this.world.scene.activeCamera !== this.world.camera3p // disables movement in XR 
       //|| (this.movingDirections == 0 && !this.movingToTarget) // disables free fall
      )
    {
      return;
    }

    if ( this.movingToTarget && this.movementStart + this.movementTimeout < this.timestamp ) {
      // could not reach the destination, stop
      console.log("Stopping movement due to timeout");
      this.stopMovement();
      return;
    }
    var old = this.timestamp;
    this.timestamp = Date.now();
    var delta = (this.timestamp - old)/100;
    //var distance = this.world.camera3p.speed * delta;
    var distance = this.world.camera1p.speed * delta; // v=s/t, s=v*t
    var gravity = new BABYLON.Vector3(0,this.world.scene.gravity.y,0); //.scale(delta);

    var direction = this.direction.clone().normalize().scale(distance).add(gravity);
    
    var avatarMesh = this.avatar.baseMesh();
    
    if ( this.movingDirections > 0 ) {
      var angle = -1.5*Math.PI-this.world.camera3p.alpha;
      var rotation = BABYLON.Quaternion.RotationAxis( BABYLON.Axis.Y, angle);
      direction.rotateByQuaternionToRef( rotation, direction );
      avatarMesh.moveWithCollisions(direction);
    } else if ( this.movingToTarget ) {
      var xDist = Math.abs(avatarMesh.position.x - this.movementTarget.x);
      var zDist = Math.abs(avatarMesh.position.z - this.movementTarget.z);
      if ( xDist < 0.2 && zDist < 0.2) {
        //console.log("Arrived to destination: "+avatarMesh.position);
        this.stopMovement();
      } else if ( this.xDist && this.zDist && xDist > this.xDist && zDist > this.zDist ) {
        console.log("Missed destination: "+avatarMesh.position+" by "+xDist+","+zDist);
        this.stopMovement();
      } else {
        avatarMesh.moveWithCollisions(direction);
        this.xDist = xDist;
        this.zDist = zDist;
      }
    } else {
      // only apply gravity
      avatarMesh.moveWithCollisions(direction);
    }
    this.movementTracker.position = this.avatar.basePosition();
    
    if ( this.trackWalk && this.activeAnimation ) {
      let length = this.leftFoot.getAbsolutePosition().subtract(this.rightFoot.getAbsolutePosition()).length();
      if (  length > this.activeAnimation.stepLength ) {
        this.activeAnimation.stepLength = length;
        this.setSpeed(this.world.camera1p.speed);
      }
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
This is control for user's avatar, both local and remote:
propagates local avatar events to the network, and acts as remote controller for all remote instances.
Installed as change listener to WorldManager, tracks position of all events that user 
sends - typically movement - and optinally adds some more - typically avatar animations.
E.g. when position changes, it sends 'walk' animation, if current avatar has animation named 'walk'.
User stops, it sends 'idle' animation, if current avatar has animation named 'idle', 
so all other users see this avatar moving and idling.
Provides methods to switch between 1st and 3rd person view, and manages movement of own avatar.
Use World.firstPersonCamera() and World.thirdPersonCamera() to ensure equal movement speeds.
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
    this.world.avatarController = this;
    this.world.avatar = avatar;
    this.scene = worldManager.scene;
    this.avatar = avatar;

    // video avatar has no parent mesh
    if ( avatar.parentMesh ) {
      avatar.parentMesh.ellipsoidOffset = new BABYLON.Vector3(0,1,0);
    }
    
    this.animation = new AvatarAnimation(avatar);
    
    this.setupIdleTimer();
    // event handlers
    this.keyboardHandler = (kbInfo) => this.handleKeyboard(kbInfo);
    // movement state variables and constants
    this.movement = new AvatarMovement(this, avatar, this.animation);
    this.movementHandler = () => this.movement.moveAvatar();
    this.clickHandler = (pointerInfo) => this.handleClick(pointerInfo);
    
    this.activeCamera = null;
    // CHECKME: unless we call firstPerson here, first call to thirdPerson turns camera wildly
    // and then firstPerson() hides the avatar, we have to reactivate it
    let tmp = this.scene.activeCamera;
    //this.firstPerson();
    if ( tmp != this.scene.activeCamera ) {
      this.activateCamera(tmp);
      this.showAvatar();
    }
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
        this.sendAnimation(this.animation.idle().group, true);
      }
    }, this.idleTimeout);
  }

  /**
   * Send an animation to the server, if the avatar has it.
   * @param animation AnimationGroup to activate remotely
   * @param loop default false
   */
  sendAnimation(animation, loop=false) {
    if ( animation && this.animation.contains(animation.name) && animation.name != this.lastAnimation && this.worldManager.isOnline() ) {
      //console.log("Sending animation "+animation.name+" loop: "+loop+" speed "+animation.speedRatio);
      this.worldManager.sendMy({animation:{name:animation.name,loop:loop, speed: animation.speedRatio}});
      this.lastAnimation = animation.name;
    }
  }

  /**
  Process locally generated changes to avatar. Called from WorldManager.trackChanges().
  Position changes also change idle animation timer, and wrote event may trigger appropriate animation.
  @param changes array of field,value object pairs
   */
  processChanges(changes) {
    if ( this.world.inXR() ) {
      // do NOT send anything while in XR
      return;
    }
    for ( var change of changes ) {
      this.lastChange = Date.now();
      if ( change.field == "position" ) {
        if ( this.scene.activeCamera != this.world.camera3p ) {
          this.setupIdleTimer();
          this.sendAnimation(this.animation.walk().group,true);
          break;
        }
      } else if ( change.field == "rotation") {
        // CHECKME anything?
      } else if ( change.field == "wrote" ) {
        let animation = this.animation.processText(change.value);
        if ( animation ) {
          this.sendAnimation(animation,false);
        }
      }
    }
  }

  deactivateCamera(camera = this.scene.activeCamera) {
    if ( !this.world.inXR() ) {
      camera.detachControl();
    }
  }
  activateCamera(camera) {
    if ( !this.world.inXR() ) {
      this.scene.activeCamera = camera;
      this.scene.activeCamera.attachControl();
    } else {
      let pos = camera.position;
      console.log("Applying coordinates: "+pos);
      //this.world.xrHelper.camera().setTransformationFromNonVRCamera(camera);
      this.world.xrHelper.camera().position.x = pos.x;
      this.world.xrHelper.camera().position.y = pos.y;
      this.world.xrHelper.camera().position.z = pos.z;
      // TODO 
      //this.world.xrHelper.camera().rotationQuaternion = this.world.camera1p.rotationQuaternion.clone();
    }
    this.activeCamera = camera;
  }
  
  showAvatar() {
    if ( this.avatar.parentMesh ) {
      this.avatar.parentMesh.setEnabled(true);
    } else {
      this.avatar.detachFromCamera();
    }
  }
  
  hideAvatar() {
    if ( this.avatar.parentMesh ) {
      // video avatar has no parentMesh
      this.avatar.parentMesh.setEnabled(false);
    } else {
      this.avatar.attachToCamera();
    }
  }
  
  processGamepadStick(stickValues) {
    if ( stickValues.y > 0.1 ) {
      this.movement.addVector("back");
    } else if ( stickValues.y < -0.1 ) {
      this.movement.addVector("forward");
    } else {
      this.movement.removeVector("forward");
      this.movement.removeVector("back");
    }
    if ( stickValues.x > 0.1 ) {
      this.movement.addVector("right");
    } else if ( stickValues.x < -0.1 ) {
      this.movement.addVector("left");
    } else {
      this.movement.removeVector("left");
      this.movement.removeVector("right");
    }
  }
  
  /** Performs coordinate transformation and other bookkeeping required to switch from 1st to 3rd person camera. */
  thirdPerson() {
    if ( this.activeCamera == this.world.camera3p ) {
      return;
    }
    this.deactivateCamera();
    this.showAvatar();
    // video avatar has no parentMesh
    if ( this.avatar.parentMesh ) {
      // TODO XR camera position
      let camera = this.world.camera1p;
      if ( this.world.inXR() ) {
        camera = this.world.xrHelper.camera();
        let pos = this.world.xrHelper.camera().position;
        this.world.camera1p.position.x = pos.x;
        this.world.camera1p.position.y = pos.y + this.world.xrHelper.camera().ellipsoid.y*2-this.world.xrHelper.camera().ellipsoidOffset.y;
        this.world.camera1p.position.z = pos.z;
      } 
      let y = camera.position.y - camera.ellipsoid.y*2 + camera.ellipsoidOffset.y;
      this.avatar.parentMesh.position = new BABYLON.Vector3(this.world.camera1p.position.x, y, this.world.camera1p.position.z);
      this.world.camera3p.setTarget(this.avatar.headPosition);
      this.movement.startTrackingCameraRotation();
    } else {
      this.world.camera3p.setTarget(this.avatar.mesh);
    }
  
    this.world.camera3p.alpha = 1.5*Math.PI-this.world.camera1p.rotation.y;
    this.world.camera3p.computeWorldMatrix();

    this.scene.onKeyboardObservable.add(this.keyboardHandler);
    this.scene.onPointerObservable.add(this.clickHandler);
    this.scene.registerBeforeRender(this.movementHandler);
    
    this.movement.stopMovement();
    
    this.worldManager.trackMesh(this.movement.movementTracker);
    
    this.activateCamera(this.world.camera3p);
  }
  
  /** Performs coordinate transformation and other bookkeeping required to switch from 3rd to 1st person camera. */
  firstPerson() {
    if ( this.activeCamera == this.world.camera1p ) {
      return;
    }
    this.deactivateCamera();
    this.scene.onKeyboardObservable.remove(this.keyboardHandler);
    this.scene.onPointerObservable.remove( this.clickHandler );
    this.scene.unregisterBeforeRender(this.movementHandler);
    this.movement.stopTrackingCameraRotation();

    this.worldManager.trackMesh(null);
    this.hideAvatar();

    if ( this.world.inXR() ) {
      let pos = this.movement.movementTracker.position;
      this.world.camera1p.position.x = pos.x;
      this.world.camera1p.position.y = pos.y + this.world.xrHelper.camera().ellipsoid.y*2-this.world.xrHelper.camera().ellipsoidOffset.y;
      this.world.camera1p.position.z = pos.z;
      // messes up pretty much everything
      //let rotY = this.movement.movementTracker.rotation.y;
      //this.world.xrHelper.camera().rotationQuaternion = new BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y,rotY);
    }

    // apply rotation to 1st person camera
    if ( this.world.camera3p ) {
      this.world.camera1p.rotation = new BABYLON.Vector3(0,1.5*Math.PI-this.world.camera3p.alpha,0);
    }

    this.activateCamera(this.world.camera1p);
  }

  /** Internal: add movement direction */  
  addDirection( direction ) {
    this.movement.addVector(direction);
  }
  
  /** Default keyboard handler, WASD keys for movement */  
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
            this.addDirection('left');
            break;
          case "d":
          case "D":
          case "ArrowRight":
            this.addDirection('right');
            break;
          case "w":
          case "W":
          case "ArrowUp":
            this.addDirection('forward');
            break;
          case "s":
          case "S":
          case "ArrowDown":
            this.addDirection('back');
            break;
          case "PageUp":
          case " ":
            this.addDirection('up');
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

  /** Default pointer handler, calls moveToTarget on LMB click */
  handleClick(pointerInfo) {
    if (pointerInfo.type == BABYLON.PointerEventTypes.POINTERDOWN ) {
      this.clickTarget = pointerInfo.pickInfo.pickedMesh;
    } else if (pointerInfo.type == BABYLON.PointerEventTypes.POINTERUP ) {
      // LMB: 0, RMB: 2
      try {
        if (pointerInfo.pickInfo.pickedMesh && pointerInfo.pickInfo.pickedMesh == this.clickTarget ) {
          this.clickTarget = null;
          if (pointerInfo.event.button == 0 && this.world.getFloorMeshes().includes(pointerInfo.pickInfo.pickedMesh)) {
            this.movement.moveToTarget(pointerInfo.pickInfo.pickedPoint);
         }
        }
      } catch (error) {
        console.error(error);
      }
    }
  }

  /** Cleanup, CHECKME */
  dispose() {
    this.scene.onKeyboardObservable.remove(this.keyboardHandler);
    this.scene.onPointerObservable.remove(this.clickHandler);
    this.scene.unregisterBeforeRender(this.movementHandler);
    this.movement.dispose();
  }
}