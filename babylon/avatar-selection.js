import { VRSPACEUI, World, Buttons, LoadProgressIndicator, LogoRoom, Portal } from './vrspace-ui.js';
import { Avatar } from './avatar.js';

var trackTime = Date.now();
//var trackDelay = 1000; // 1 fps
//var trackDelay = 100; // 10 fps
//var trackDelay = 40; // 25 fps
var trackDelay = 20; // 50 fps

var mirror = true;

var animationSelection;

export class AvatarSelection extends World {
  async createScene(engine) {
    // Create the scene space
    var scene = new BABYLON.Scene(engine);
    scene.gravity = new BABYLON.Vector3(0, -9.81, 0);
    scene.collisionsEnabled = true;

    // Add a camera to the scene and attach it to the canvas
    this.camera = new BABYLON.UniversalCamera("UniversalCamera", new BABYLON.Vector3(0, 2, -5), scene);
    //camera = new BABYLON.ArcRotateCamera("Camera", 0, 2, -3, new BABYLON.Vector3(0, 1, 0), scene);
    //camera.setPosition(new BABYLON.Vector3(0, 2, -3));
    //var camera = new BABYLON.FlyCamera("FlyCamera", new BABYLON.Vector3(0, 5, -10), scene);
    this.camera.maxZ = 100000;
    this.camera.minZ = 0;
    this.camera.setTarget(new BABYLON.Vector3(0,1.5,0));
    this.camera.attachControl(canvas, true);
    this.camera.applyGravity = true;
    //Set the ellipsoid around the camera (e.g. your player's size)
    //camera.ellipsoid = new BABYLON.Vector3(.5, 1.8, .5);
    //camera.ellipsoidOffset = -0.2
    this.camera.checkCollisions = true;
    this.camera.speed = 0.1;

    // Add lights to the scene
    var light1 = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(1, 1, 0), scene);
    var light2 = new BABYLON.PointLight("light2", new BABYLON.Vector3(1, 3, -3), scene);

    // Shadows
    this.shadowGenerator = new BABYLON.ShadowGenerator(1024, light2);
    this.shadowGenerator.useExponentialShadowMap = true;
    // slower:
    //shadowGenerator.useBlurExponentialShadowMap = true;
    //shadowGenerator.blurKernel = 32;
    // hair is usually semi-transparent, this allows it to cast shadow:
    this.shadowGenerator.transparencyShadow = true;

    var skybox = BABYLON.Mesh.CreateBox("skyBox", 100.0, scene);
    skybox.rotation = new BABYLON.Vector3( 0, Math.PI, 0 );
    var skyboxMaterial = new BABYLON.StandardMaterial("skyBox", scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.disableLighting = true;
    skybox.material = skyboxMaterial;
    skybox.infiniteDistance = true;
    skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("../content/skybox/mp_drakeq/drakeq", scene);
    //skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("skybox/horizon_4", scene);
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;

    this.room = await new LogoRoom(scene).load();
    this.ground = this.room.ground;
    
    // Register a render loop to repeatedly render the scene
    engine.runRenderLoop(function () {
      if (scene) scene.render();
    });

    return scene;
  }
  
  isSelectableMesh(mesh) {
    return mesh == this.ground || mesh.name && mesh.name.startsWith("Button");;
  }
  
  getFloorMeshes() {
    return [this.ground];
  }
  
  load( name, file ) {
    //this.xrDeviceTracker = () => {this.trackXrDevices()}
    this.loaded(file, null);
  }
  
  trackXrDevices() {
    console.log(this);
    if ( trackTime + trackDelay < Date.now()
        && this.character
        && this.character.body
        && this.character.body.processed
        && ! this.character.activeAnimation
      ) {
      trackTime = Date.now();
      // CHECKME: mirror left-right
      if ( this.leftController ) {
        if ( mirror ) {
          var leftPos = this.calcControllerPos( this.character.body.leftArm, this.leftController );
          this.character.reachFor( this.character.body.leftArm, leftPos );
        } else {
          var leftPos = this.calcControllerPos( this.character.body.rightArm, this.leftController );
          this.character.reachFor( this.character.body.rightArm, leftPos );
        }
      }
      if ( this.rightController ) {
        if ( mirror ) {
          var rightPos = this.calcControllerPos( this.character.body.rightArm, this.rightController );
          this.character.reachFor( this.character.body.rightArm, rightPos );
        } else {
          var rightPos = this.calcControllerPos( this.character.body.leftArm, this.rightController );
          this.character.reachFor( this.character.body.leftArm, rightPos );
        }
      }
      this.character.lookAt( this.calcCameraTarget() );
      this.trackHeight();
    }
  }
  
  trackHeight() {
    //var cameraPos = xrHelper.input.xrCamera.position.y;
    var cameraPos = this.vrHelper.input.xrCamera.realWorldHeight;
    if ( this.maxCameraPos ) {
      var delta = cameraPos-this.prevCameraPos;
      var speed = delta/trackDelay*1000;
      if ( cameraPos > this.maxCameraPos && Math.abs(speed) > 1 ) {
        this.character.jump(cameraPos - this.maxCameraPos);
        this.jumping = Date.now();
      } else if ( this.jumping ) {
        var delay = Date.now() - this.jumping;
        if ( cameraPos <= this.maxCameraPos && delay > 300 ) {
          this.character.standUp();
          this.jumping = null;
        } else {
          this.character.jump(cameraPos - this.maxCameraPos);
        }
      } else {
        if ( delta > 0 ) {
          this.character.rise(delta);
        } else if ( delta < 0 ) {
          this.character.crouch(-delta);
        }
      }

    } else {
      this.maxCameraPos = cameraPos;
    }
    this.prevCameraPos = cameraPos;
  }
  
  calcCameraTarget() {
    var cameraQuat = this.vrHelper.input.xrCamera.rotationQuaternion;
    var target = new BABYLON.Vector3(0,this.vrHelper.input.xrCamera.realWorldHeight,1);
    target.rotateByQuaternionAroundPointToRef(cameraQuat,this.character.headPos(),target);
    if ( mirror ) {
      target.z = -target.z;
    }
    return target;
  }

  calcControllerPos( arm, xrController ) {
    var cameraPos = this.vrHelper.input.xrCamera.position;
    // this calc swaps front-back, like mirror image
    var pos = xrController.grip.absolutePosition.subtract( new BABYLON.Vector3(cameraPos.x, 0, cameraPos.z));
    var armLength = arm.lowerArmLength+arm.upperArmLength;
    if ( mirror ) {
      pos.z = - pos.z;
    }

    var pointerQuat = xrController.pointer.rotationQuaternion;
    arm.pointerQuat = pointerQuat;

    return pos;
  }
  
  createSelection() {
    this.indicator = new LoadProgressIndicator(scene, this.camera);
    VRSPACEUI.listCharacters( '../content/char/', (avatars) => {
      var buttons = new Buttons(scene,"Avatars",avatars,(dir) => this.loadCharacter(dir),"name");
      buttons.setHeight(2.6);
      buttons.group.position = new BABYLON.Vector3(1,3,-.5);
    });
  }

  loadCharacter(dir) {
    this.indicator.add(dir);
    this.indicator.animate();
    console.log("Loading character from "+dir.name);
    var loaded = new Avatar(scene, dir, this.shadowGenerator);
    loaded.load( (c) => {
      this.indicator.remove(dir);
      if ( ! this.character ) {
        this.addCharacterButtons();
        this.portalsEnabled(true);
      }
      this.character = loaded.replace(this.character);
      this.animationButtons(this.character);
    });
  }

  animationButtons(avatar) {
    var names = []
    var playing;
    for ( var i = 0; i < avatar.getAnimationGroups().length; i++ ) {
      var group = avatar.getAnimationGroups()[i];
      names.push(group.name);
      //console.log("Animation group: "+group.name+" "+group.isPlaying);
      if ( group.isPlaying ) {
        playing = i;
      }
      avatar.processAnimations(group.targetedAnimations);
    }
    console.log("Animations: "+names);
    if ( animationSelection ) {
      animationSelection.dispose();
    }
    animationSelection = new Buttons(scene,"Animations",names, (name)=>this.startAnimation(name));
    animationSelection.turnOff = true;
    animationSelection.setHeight(Math.min(2,names.length/10));
    animationSelection.group.position = new BABYLON.Vector3(-2,2.2,-.5);
  }

  startAnimation(name) {
    this.character.startAnimation(name);
  }

  addCharacterButtons() {
    var manager = new BABYLON.GUI.GUI3DManager(scene);
    var resizeButton = new BABYLON.GUI.HolographicButton("resizeButton");
    resizeButton.contentResolution = 128;
    resizeButton.contentScaleRatio = 1;
    resizeButton.text = "Resize";
    manager.addControl(resizeButton);

    resizeButton.position = new BABYLON.Vector3( -0.5,0.2,-1 );
    resizeButton.node.scaling = new BABYLON.Vector3(.2,.2,.2);
    resizeButton.onPointerDownObservable.add( function() {
      if ( this.inXR ) {
        var cameraPos = vrHelper.input.xrCamera.realWorldHeight;
        this.character.userHeight = cameraPos;
        this.character.resize();
        maxCameraPos = null;
      }
    });

    var mirrorButton = new BABYLON.GUI.HolographicButton("mirrorButton");
    mirrorButton.contentResolution = 128;
    mirrorButton.contentScaleRatio = 1;
    mirrorButton.text = "Mirroring";
    manager.addControl(mirrorButton);

    mirrorButton.position = new BABYLON.Vector3( 0.5,0.2,-1 );
    mirrorButton.node.scaling = new BABYLON.Vector3(.2,.2,.2);
    mirrorButton.onPointerDownObservable.add( () => {
        // TODO: rotate character, (un)set mirror var
        if ( mirrorButton.text == "Mirroring" ) {
          mirrorButton.text = "Copying";
          mirror = false;
          this.character.rootMesh.rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, 0);
        } else {
          mirrorButton.text = "Mirroring";
          mirror = true;
          this.character.rootMesh.rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, Math.PI);
        }
    });
  }
  
  showPortals() {
    this.portals = [];
    VRSPACEUI.listThumbnails('../content/worlds', (worlds) => {
      var radius = this.room.diameter/2;
      var angleIncrement = 2*Math.PI/worlds.length;
      var angle = 0;
      for ( var i=0; i < worlds.length; i++ ) {
        var x = Math.sin(angle)*radius;
        var z = Math.cos(angle)*radius;
        // heavy performance impact
        //new Portal( scene, worlds[i].name, worlds[i].relatedUrl(), this.shadowGenerator).loadAt( x,0,z, angle);
        var portal = new Portal( scene, worlds[i].name, worlds[i].relatedUrl());
        this.portals.push(portal);
        portal.loadAt( x,0,z, angle);
        angle += angleIncrement;
      }
    });
  }

  portalsEnabled(enable) {
    if (this.portals) {
      for ( var i = 0; i < this.portals.length; i++ ) {
        this.portals[i].enabled(enable);
      }
    }
  }

}

export const WORLD = new AvatarSelection();
