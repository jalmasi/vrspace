import { VRSPACEUI, World, Buttons, LoadProgressIndicator, LogoRoom, Portal, WorldManager, RecorderUI, MediaStreams } from './vrspace-ui.js';
import { Avatar } from './avatar.js';

var trackTime = Date.now();
//var trackDelay = 1000; // 1 fps
//var trackDelay = 100; // 10 fps
//var trackDelay = 40; // 25 fps
var trackDelay = 20; // 50 fps

var mirror = true;

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
    this.camera = new BABYLON.UniversalCamera("UniversalCamera", new BABYLON.Vector3(0, 2, -5), this.scene);
    //camera = new BABYLON.ArcRotateCamera("Camera", 0, 2, -3, new BABYLON.Vector3(0, 1, 0), scene);
    //camera.setPosition(new BABYLON.Vector3(0, 2, -3));
    //var camera = new BABYLON.FlyCamera("FlyCamera", new BABYLON.Vector3(0, 5, -10), scene);
    this.camera.maxZ = 100000;
    this.camera.minZ = 0;
    this.camera.setTarget(new BABYLON.Vector3(0,1.5,0));
    // not required, world.init() does that
    //this.camera.attachControl(canvas, true);
    this.camera.applyGravity = true;
    //Set the ellipsoid around the camera (e.g. your player's size)
    //camera.ellipsoid = new BABYLON.Vector3(.5, 1.8, .5);
    //camera.ellipsoidOffset = -0.2
    this.camera.checkCollisions = true;
    this.camera.speed = 0.1;
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
    if ( trackTime + trackDelay < Date.now()
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
    this.indicator = new LoadProgressIndicator(scene, this.camera);
    VRSPACEUI.listCharacters( '../content/char/', (avatars) => {
      this.buttons = new Buttons(scene,"Avatars",avatars,(dir) => this.loadCharacter(dir),"name");
      this.buttons.setHeight(2.6);
      this.buttons.group.position = new BABYLON.Vector3(1,3,-.5);
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
    resizeButton.onPointerDownObservable.add( function() {
      if ( this.inXR ) {
        var cameraPos = vrHelper.camera().realWorldHeight;
        this.character.userHeight = cameraPos;
        this.character.resize();
        maxCameraPos = null;
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
    console.log("Entering world "+portal.worldUrl()+'/world.js as '+this.character.getUrl());
    var avatarUrl = this.character.getUrl();
    import(portal.worldUrl()+'/world.js').then((world)=>{
      var afterLoad = (world) => {
        console.log(world);
        world.vrHelper = this.vrHelper;
        world.initXR();
        
        // TODO refactor this to WorldManager
        var worldManager = new WorldManager(world);
        if ( this.inXR ) {
          console.log("Tracking, "+this.inXR);
          worldManager.setCamera(this.vrHelper.camera()); 
        }
        var enter = () => {
          worldManager.VRSPACE.removeWelcomeListener(enter);
          worldManager.VRSPACE.sendMy('mesh', avatarUrl)
          worldManager.VRSPACE.addWelcomeListener((welcome)=>{
            // obtain token and start pub/sub voices
            var token = welcome.client.token.replaceAll('&amp;','&');
            console.log('token: '+token);
            var streams = new MediaStreams('videos');
            streams.connect(token).then(() => streams.publish());
            worldManager.mediaStreams = streams;
          });
          worldManager.VRSPACE.send('{"command":{"Enter":{"world":"'+portal.name+'"}}}');
        };
        worldManager.VRSPACE.addWelcomeListener(enter);
        worldManager.VRSPACE.connect();
        //var recorder = new RecorderUI(world.scene);
        //recorder.showUI();
      }
      
      this.vrHelper.stopTracking();
      world.WORLD.init(this.engine, portal.name, this.scene, afterLoad, portal.worldUrl()+"/").then((newScene)=>{
        console.log(world);
        this.vrHelper.clearFloors();
        // TODO install world's xr device tracker
        if ( this.inXR ) {
          this.vrHelper.camera().setTransformationFromNonVRCamera(world.WORLD.camera);
        } else {
          this.scene.activeCamera = world.WORLD.camera;
        }
        this.camera.dispose();
        this.removePortals();
        this.room.dispose(); // AKA ground
        this.skyBox.dispose();
        this.skyBox.material.dispose();
        this.light.dispose();
        this.shadowGenerator.dispose();
        
        // TODO properly dispose of avatar
        this.character.dispose(); 
        this.character = null;
        
        this.buttons.dispose();
        if ( this.animationSelection ) {
          this.animationSelection.dispose();
        }
        this.guiManager.dispose();
        this.scene = null; // next call to render loop stops the current loop
      });
    })
  }
  
  // copied from https://github.com/BabylonJS/Babylon.js/blob/master/src/scene.ts
  clearScene(scene) {
      scene.beforeRender = null;
      scene.afterRender = null;

      //if (EngineStore._LastCreatedScene === scene) {
        //  EngineStore._LastCreatedScene = null;
      //}

      scene.skeletons = [];
      scene.morphTargetManagers = [];
      scene._transientComponents = [];
      scene._isReadyForMeshStage.clear();
      scene._beforeEvaluateActiveMeshStage.clear();
      scene._evaluateSubMeshStage.clear();
      scene._activeMeshStage.clear();
      scene._cameraDrawRenderTargetStage.clear();
      scene._beforeCameraDrawStage.clear();
      scene._beforeRenderTargetDrawStage.clear();
      scene._beforeRenderingGroupDrawStage.clear();
      scene._beforeRenderingMeshStage.clear();
      scene._afterRenderingMeshStage.clear();
      scene._afterRenderingGroupDrawStage.clear();
      scene._afterCameraDrawStage.clear();
      scene._afterRenderTargetDrawStage.clear();
      scene._afterRenderStage.clear();
      scene._beforeCameraUpdateStage.clear();
      scene._beforeClearStage.clear();
      scene._gatherRenderTargetsStage.clear();
      scene._gatherActiveCameraRenderTargetsStage.clear();
      scene._pointerMoveStage.clear();
      scene._pointerDownStage.clear();
      scene._pointerUpStage.clear();

      for (let component of scene._components) {
          component.dispose();
      }

      scene.importedMeshesFiles = [];

      if (scene.stopAllAnimations) {
          scene.stopAllAnimations();
      }

      scene.resetCachedMaterial();

      // Smart arrays
      if (scene.activeCamera) {
          scene.activeCamera._activeMeshes.dispose();
          scene.activeCamera = null;
      }
      scene._activeMeshes.dispose();
      scene._renderingManager.dispose();
      scene._processedMaterials.dispose();
      scene._activeParticleSystems.dispose();
      scene._activeSkeletons.dispose();
      scene._softwareSkinnedMeshes.dispose();
      scene._renderTargets.dispose();
      scene._registeredForLateAnimationBindings.dispose();
      scene._meshesForIntersections.dispose();
      scene._toBeDisposed = [];

      // Abort active requests
      for (let request of scene._activeRequests) {
          request.abort();
      }

      // Events
      scene.onDisposeObservable.notifyObservers(scene);

      scene.onDisposeObservable.clear();
      scene.onBeforeRenderObservable.clear();
      scene.onAfterRenderObservable.clear();
      scene.onBeforeRenderTargetsRenderObservable.clear();
      scene.onAfterRenderTargetsRenderObservable.clear();
      scene.onAfterStepObservable.clear();
      scene.onBeforeStepObservable.clear();
      scene.onBeforeActiveMeshesEvaluationObservable.clear();
      scene.onAfterActiveMeshesEvaluationObservable.clear();
      scene.onBeforeParticlesRenderingObservable.clear();
      scene.onAfterParticlesRenderingObservable.clear();
      scene.onBeforeDrawPhaseObservable.clear();
      scene.onAfterDrawPhaseObservable.clear();
      scene.onBeforeAnimationsObservable.clear();
      scene.onAfterAnimationsObservable.clear();
      scene.onDataLoadedObservable.clear();
      scene.onBeforeRenderingGroupObservable.clear();
      scene.onAfterRenderingGroupObservable.clear();
      scene.onMeshImportedObservable.clear();
      scene.onBeforeCameraRenderObservable.clear();
      scene.onAfterCameraRenderObservable.clear();
      scene.onReadyObservable.clear();
      scene.onNewCameraAddedObservable.clear();
      scene.onCameraRemovedObservable.clear();
      scene.onNewLightAddedObservable.clear();
      scene.onLightRemovedObservable.clear();
      scene.onNewGeometryAddedObservable.clear();
      scene.onGeometryRemovedObservable.clear();
      scene.onNewTransformNodeAddedObservable.clear();
      scene.onTransformNodeRemovedObservable.clear();
      scene.onNewMeshAddedObservable.clear();
      scene.onMeshRemovedObservable.clear();
      scene.onNewSkeletonAddedObservable.clear();
      scene.onSkeletonRemovedObservable.clear();
      scene.onNewMaterialAddedObservable.clear();
      scene.onMaterialRemovedObservable.clear();
      scene.onNewTextureAddedObservable.clear();
      scene.onTextureRemovedObservable.clear();
      scene.onPrePointerObservable.clear();
      scene.onPointerObservable.clear();
      scene.onPreKeyboardObservable.clear();
      scene.onKeyboardObservable.clear();
      scene.onActiveCameraChanged.clear();

      scene.detachControl();

      // Detach cameras
      var canvas = scene._engine.getInputElement();

      if (canvas) {
          var index;
          for (index = 0; index < scene.cameras.length; index++) {
              scene.cameras[index].detachControl(canvas);
          }
      }

      // Release animation groups
      while (scene.animationGroups.length) {
          scene.animationGroups[0].dispose();
      }

      // Release lights
      while (scene.lights.length) {
          scene.lights[0].dispose();
      }

      // Release meshes
      while (scene.meshes.length) {
          scene.meshes[0].dispose(true);
      }
      // CHECKME: WORKAROUND
      var i = 0;
      while (i < scene.transformNodes.length) {
        console.log("Disposing transformNode "+i+"/"+scene.transformNodes.length);
        if ( scene.transformNodes[i].isDisposed() ) {
          i++;
        }
        console.log(scene.transformNodes[i]);
          scene.transformNodes[i].dispose(true);
      }

      // Release cameras
      while (scene.cameras.length) {
          scene.cameras[0].dispose();
      }

      // Release materials
      if (scene._defaultMaterial) {
          scene._defaultMaterial.dispose();
      }
      while (scene.multiMaterials.length) {
          scene.multiMaterials[0].dispose();
      }
      while (scene.materials.length) {
          scene.materials[0].dispose();
      }

      // Release particles
      while (scene.particleSystems.length) {
          scene.particleSystems[0].dispose();
      }

      // Release postProcesses
      while (scene.postProcesses.length) {
          scene.postProcesses[0].dispose();
      }

      // Release textures
      while (scene.textures.length) {
          scene.textures[0].dispose();
      }

      // Release UBO
      scene._sceneUbo.dispose();

      if (scene._multiviewSceneUbo) {
          scene._multiviewSceneUbo.dispose();
      }

      // Post-processes
      scene.postProcessManager.dispose();

      // Remove from engine
      index = scene._engine.scenes.indexOf(scene);

      if (index > -1) {
          scene._engine.scenes.splice(index, 1);
      }

      scene._engine.wipeCaches(true);
      scene._isDisposed = true;
    
  }
}

export const WORLD = new AvatarSelection();
