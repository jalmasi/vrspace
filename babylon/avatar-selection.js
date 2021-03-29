import { VRSPACEUI, World, Buttons, LoadProgressIndicator, LogoRoom, Portal, WorldManager, VideoAvatar } from './vrspace-ui.js';
import { Avatar } from './avatar.js';

var trackTime = Date.now();
//var trackDelay = 1000; // 1 fps
//var trackDelay = 100; // 10 fps
//var trackDelay = 40; // 25 fps
var trackDelay = 20; // 50 fps

var mirror = true;
var userHeight = 1.8; // by default

export class AvatarSelection extends World {
  async createSkyBox() {
    var skybox = BABYLON.Mesh.CreateBox("skyBox", 100.0, this.scene);
    skybox.rotation = new BABYLON.Vector3( 0, Math.PI, 0 );
    var skyboxMaterial = new BABYLON.StandardMaterial("skyBox", this.scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.disableLighting = true;
    skybox.material = skyboxMaterial;
    skybox.infiniteDistance = true;
    skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("../content/skybox/mp_drakeq/drakeq", this.scene);
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
    return skybox;
  }
  async createCamera() {
    // Add a camera to the scene and attach it to the canvas
    this.camera = this.universalCamera(new BABYLON.Vector3(0, 2, -5));
    this.camera.setTarget(new BABYLON.Vector3(0,1.5,0));
  }
  async createLights() {
    // Add lights to the scene
    var light1 = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(1, 1, 0), this.scene);
    var light2 = new BABYLON.PointLight("light2", new BABYLON.Vector3(1, 3, -3), this.scene);
    return light2;
  }
  async createShadows() {
    // Shadows
    this.shadowGenerator = new BABYLON.ShadowGenerator(1024, this.light);
    this.shadowGenerator.useExponentialShadowMap = true;
    // slower:
    //shadowGenerator.useBlurExponentialShadowMap = true;
    //shadowGenerator.blurKernel = 32;
    // hair is usually semi-transparent, this allows it to cast shadow:
    this.shadowGenerator.transparencyShadow = true;
  }
  async createGround() {
    this.room = await new LogoRoom(this.scene).load();
    this.ground = this.room.ground;
  }
  async createPhysics() {
    // 1g makes nasty floor collisions
    this.scene.gravity = new BABYLON.Vector3(0, -0.1, 0);
  }  
  
  isSelectableMesh(mesh) {
    return mesh == this.ground || mesh.name && (mesh.name.startsWith("Button") || mesh.name.startsWith("PortalEntrance"));
  }
  
  getFloorMeshes() {
    return [this.ground];
  }
  
  load( name, file ) {
    //this.xrDeviceTracker = () => {this.trackXrDevices()}
    this.loaded(file, null);
  }
  
  trackXrDevices() {
    if ( this.tracking 
        && trackTime + trackDelay < Date.now()
        && this.character
        && this.character.body
        && this.character.body.processed
        && ! this.character.activeAnimation
      ) {
      trackTime = Date.now();
      // CHECKME: mirror left-right
      if ( this.vrHelper.leftController ) {
        if ( mirror ) {
          var leftPos = this.calcControllerPos( this.character.body.leftArm, this.vrHelper.leftController );
          this.character.reachFor( this.character.body.leftArm, leftPos );
        } else {
          var leftPos = this.calcControllerPos( this.character.body.rightArm, this.vrHelper.leftController );
          this.character.reachFor( this.character.body.rightArm, leftPos );
        }
      }
      if ( this.vrHelper.rightController ) {
        if ( mirror ) {
          var rightPos = this.calcControllerPos( this.character.body.rightArm, this.vrHelper.rightController );
          this.character.reachFor( this.character.body.rightArm, rightPos );
        } else {
          var rightPos = this.calcControllerPos( this.character.body.leftArm, this.vrHelper.rightController );
          this.character.reachFor( this.character.body.leftArm, rightPos );
        }
      }
      this.character.lookAt( this.calcCameraTarget() );
      this.trackHeight();
    }
  }
  
  trackHeight() {
    //var cameraPos = xrHelper.input.xrCamera.position.y;
    var cameraPos = this.vrHelper.camera().realWorldHeight;
    if ( this.maxCameraPos && cameraPos != this.prevCameraPos ) {
      var delta = cameraPos-this.prevCameraPos;
      var speed = delta/trackDelay*1000; // speed in m/s
      if ( this.jumping ) {
        var delay = Date.now() - this.jumping;
        if ( cameraPos <= this.maxCameraPos && delay > 300 ) {
          this.character.standUp();
          this.jumping = null;
          console.log("jump stopped")
        } else if ( delay > 500 ) {
          // CHECKME we can auto-resize here
          console.log("jump stopped - timeout")
          this.character.standUp();
          this.jumping = null;
        } else {
          this.character.jump(cameraPos - this.maxCameraPos);
        }
      } else if ( cameraPos > this.maxCameraPos && Math.abs(speed) > 1 ) {
        // CHECKME speed is not really important here
        this.character.jump(cameraPos - this.maxCameraPos);
        this.jumping = Date.now();
        console.log("jump starting")
      } else {
        // ignoring anything less than 1mm
        if ( delta > 0.001 ) {
          this.character.rise(delta);
        } else if ( delta < -0.001 ) {
          this.character.crouch(-delta);
        }
      }

    } else {
      this.maxCameraPos = cameraPos;
    }
    this.prevCameraPos = cameraPos;
  }
  
  calcCameraTarget() {
    var cameraQuat = this.vrHelper.camera().rotationQuaternion;
    var target = new BABYLON.Vector3(0,this.vrHelper.camera().realWorldHeight,1);
    target.rotateByQuaternionAroundPointToRef(cameraQuat,this.character.headPos(),target);
    if ( mirror ) {
      target.z = -target.z;
    }
    return target;
  }

  calcControllerPos( arm, xrController ) {
    var cameraPos = this.vrHelper.camera().position;
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
  
  createSelection(selectionCallback) {
    this.selectionCallback = selectionCallback;
    this.indicator = new LoadProgressIndicator(this.scene, this.camera);
    VRSPACEUI.listMatchingFiles( '../content/char/', (folders) => {
      folders.push({name:"video"});
      var buttons = new Buttons(this.scene,"Avatars",folders,(dir) => this.createAvatarSelection(dir),"name");
      buttons.setHeight(.3);
      buttons.group.position = new BABYLON.Vector3(.5,2.2,-.5);
      buttons.select(0);
      this.mainButtons = buttons;
    });
  }
  
  async createAvatarSelection(folder) {
    if ( this.characterButtons ) {
      this.characterButtons.dispose();
    }
    if ( folder.url ) {
      VRSPACEUI.listCharacters( folder.url(), (avatars) => {
        var buttons = new Buttons(this.scene,folder.name,avatars,(dir) => this.loadCharacter(dir),"name");
        buttons.setHeight(0.1 * Math.min(20,avatars.length));
        buttons.group.position = new BABYLON.Vector3(1.3,2.2,-.5);
        this.characterButtons = buttons;
      });
    } else if (! this.video ) {
      // load video avatar and start streaming video
      this.video = new VideoAvatar( this.scene, () => {
        if ( this.character ) {
          this.character.dispose();
          delete this.character;
          this.guiManager.dispose();
          delete this.guiManager;
        }
        this.portalsEnabled(true);        
      });
      await this.video.show();
      
    }
            
  }

  loadCharacter(dir) {
    this.tracking = false;
    this.indicator.add(dir);
    this.indicator.animate();
    console.log("Loading character from "+dir.name);
    var loaded = new Avatar(scene, dir, this.shadowGenerator);
    loaded.userHeight = userHeight;
    loaded.animateArms = false;
    //loaded.debug = true;
    loaded.load( (c) => {
      if ( this.video ) {
        this.video.dispose();
        delete this.video;
      }
      this.tracking = true;
      this.indicator.remove(dir);
      if ( ! this.character ) {
        this.addCharacterButtons();
        this.portalsEnabled(true);
      }
      this.character = loaded.replace(this.character);
      this.animationButtons(this.character);
      if ( this.selectionCallback ) {
        this.selectionCallback(this.character);
      }
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
    if ( this.animationSelection ) {
      this.animationSelection.dispose();
    }
    this.animationSelection = new Buttons(scene,"Animations",names, (name)=>this.startAnimation(name));
    this.animationSelection.turnOff = true;
    this.animationSelection.setHeight(Math.min(2,names.length/10));
    this.animationSelection.group.position = new BABYLON.Vector3(-2,2.2,-.5);
  }

  startAnimation(name) {
    this.character.startAnimation(name);
  }

  addCharacterButtons() {
    this.guiManager = new BABYLON.GUI.GUI3DManager(scene);
    var resizeButton = new BABYLON.GUI.HolographicButton("resizeButton");
    resizeButton.contentResolution = 128;
    resizeButton.contentScaleRatio = 1;
    resizeButton.text = "Resize";
    this.guiManager.addControl(resizeButton);

    resizeButton.position = new BABYLON.Vector3( -0.5,0.2,-1 );
    resizeButton.node.scaling = new BABYLON.Vector3(.2,.2,.2);
    resizeButton.onPointerDownObservable.add( () => {
      if ( this.inXR ) {
        this.tracking = false;
        userHeight = this.vrHelper.camera().realWorldHeight;
        console.log("Resizing to "+userHeight)
        this.character.userHeight = userHeight;
        this.character.standUp(); // CHECKME: move to resize()?
        this.character.resize();
        this.maxCameraPos = null;
        this.tracking = true;
      }
    });

    var mirrorButton = new BABYLON.GUI.HolographicButton("mirrorButton");
    mirrorButton.contentResolution = 128;
    mirrorButton.contentScaleRatio = 1;
    mirrorButton.text = "Mirroring";
    this.guiManager.addControl(mirrorButton);

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
        //new Portal( scene, worlds[i], this.enter, this.shadowGenerator).loadAt( x,0,z, angle);
        var portal = new Portal( scene, worlds[i], (p)=>this.enter(p));
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
  
  removePortals() {
    if (this.portals) {
      for ( var i = 0; i < this.portals.length; i++ ) {
        this.portals[i].dispose();
      }
      delete this.portals;
    }
  }

  enter( portal ) {
    var avatarUrl = "video";
    if ( this.character ) {
      avatarUrl = this.character.getUrl(); 
    } else if ( this.video ) {
      // CHECKME: dispose or attach?
      //this.video.dispose();
      //delete this.video;
      this.video.attachToCamera();
    }
    console.log("Entering world "+portal.worldUrl()+'/world.js as '+avatarUrl);
    import(portal.worldUrl()+'/world.js').then((world)=>{
      var afterLoad = (world) => {
        console.log(world);
        world.vrHelper = this.vrHelper;
        world.initXR();
        
        // TODO refactor this to WorldManager
        var worldManager = new WorldManager(world);
        if ( this.inXR ) {
          console.log("Tracking, "+this.inXR);
          worldManager.trackCamera(this.vrHelper.camera()); 
        }
        var enter = () => {
          worldManager.VRSPACE.removeWelcomeListener(enter);
          worldManager.VRSPACE.sendMy('mesh', avatarUrl);
          worldManager.VRSPACE.sendMy('userHeight', userHeight);
          // CHECKME better way to flag publishing video?
          worldManager.VRSPACE.addWelcomeListener((welcome)=>worldManager.pubSub(welcome.client, 'video' === avatarUrl));
          // TODO add enter command to API
          worldManager.VRSPACE.sendCommand("Enter",{world:portal.name});
          worldManager.VRSPACE.sendCommand("Session");
        };
        worldManager.VRSPACE.addWelcomeListener(enter);
        worldManager.VRSPACE.connect();
        //var recorder = new RecorderUI(world.scene);
        //recorder.showUI();
      }
      
      // CHECKME: may be a babylonjs bug, but new camera has null gamepad
      // TODO: new camera may be of type that doesn't support gamepad
      var gamepad = this.camera.inputs.attached.gamepad.gamepad;

      this.vrHelper.stopTracking();
      this.camera.detachControl(this.canvas);
      this.dispose();
      world.WORLD.init(this.engine, portal.name, this.scene, afterLoad, portal.worldUrl()+"/").then((newScene)=>{
        console.log(world);
        this.vrHelper.clearFloors();
        // TODO install world's xr device tracker
        if ( this.inXR ) {
          this.vrHelper.camera().setTransformationFromNonVRCamera(world.WORLD.camera);
        } else {
          console.log('New world camera:');
          console.log(world.WORLD.camera);
          // CHECKME: workaround, gamepad stops working
          // https://github.com/BabylonJS/Babylon.js/blob/master/src/Cameras/Inputs/freeCameraGamepadInput.ts
          // scene.gamepadManager does not emit event to the new camera
          if ( gamepad ) {
            world.WORLD.camera.inputs.attached.gamepad.gamepad = gamepad;
            // TODO: this is to simulate mouse click/screen tap
            gamepad.onButtonUpObservable.add( (number) => console.log(number) );          
          }
          // CHECKME: why?
          this.scene.activeCamera = world.WORLD.camera;
        }
        
      });
    })
  }

  dispose() {
    super.dispose();
    this.removePortals();
    this.room.dispose(); // AKA ground
    // TODO properly dispose of avatar
    if ( this.character ) {
      this.character.dispose();
      this.character = null;          
    }
    
    this.mainButtons.dispose();
    this.characterButtons.dispose();
    
    if ( this.animationSelection ) {
      this.animationSelection.dispose();
    }
    if ( this.guiManager ) {
      this.guiManager.dispose();          
    }
    // CHECKME: this scene should be cleaned up, but when?
    //this.scene = null; // next call to render loop stops the current loop
  }  
}

export const WORLD = new AvatarSelection();
