import { VRSPACEUI, World, Buttons, LogoRoom, Portal, WorldManager, Avatar, VideoAvatar, OpenViduStreams, ServerFolder, ServerFile } from './js/vrspace-min.js';

export class AvatarSelection extends World {
  constructor() {
    super();
    /** server to connect to */
    this.serverUrl = null;
    /** content base, defaults to VRSPACEUI.contentBase */
    this.contentBase = VRSPACEUI.contentBase;
    /** background base dir, null defaults to contentBase+"/content/skybox/mp_drakeq/drakeq" */
    this.backgroundPath = null;
    /** character base dir, null defaults to contentBase+'/content/char/' */
    this.characterPath = null;
    /** world base dir, null defaults to contentBase+'/content/worlds' */
    this.worldPath = null;
    /** function to call just before entering a world */
    this.beforeEnter = null;
    /** function to call after entering a world */
    this.afterEnter = null;
    /** function to call after exiting a world */
    this.afterExit = null;
    /** whether to list animations after character loads, default true */
    this.showAnimationButtons=true;
    /** wheter to display own video avatar, default true */
    this.displayOwnVideo=true;
    /** custom video avatar options, default null */
    this.customOptions=null;
    /** movement tracking/animation frames per second */
    this.fps = 50;
    /** default user height, 1.8 m */
    this.userHeight = 1.8;
    /** enable plenty of debug info */
    this.debug=false;
    // state variables
    this.mirror = true;
    this.customAvatarFrame = document.getElementById('customAvatarFrame');
    this.trackTime = Date.now();
    this.trackDelay = 1000/this.fps;
  }
  async createSkyBox() {
    var skybox = BABYLON.Mesh.CreateBox("skyBox", 100.0, this.scene);
    skybox.rotation = new BABYLON.Vector3( 0, Math.PI, 0 );
    var skyboxMaterial = new BABYLON.StandardMaterial("skyBox", this.scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.disableLighting = true;
    skybox.material = skyboxMaterial;
    skybox.infiniteDistance = true;
    skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture(this.backgroundDir(), this.scene);
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
    this.hemisphere = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(1, 1, 0), this.scene);
    var point = new BABYLON.PointLight("light2", new BABYLON.Vector3(1, 3, -3), this.scene);
    return point;
  }
  async createShadows() {
    // Shadows
    this.shadowGenerator = new BABYLON.ShadowGenerator(1024, this.light);
    this.shadowGenerator.useExponentialShadowMap = true;
    // slower:
    //this.shadowGenerator.useBlurExponentialShadowMap = true;
    //this.shadowGenerator.blurKernel = 32;
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
  
  backgroundDir() {
    if ( this.backgroundPath ) {
      return this.backgroundPath;
    }
    return this.contentBase+"/content/skybox/mp_drakeq/drakeq";
  }
  characterDir() {
    if ( this.characterPath ) {
      return this.characterPath;
    }
    return this.contentBase+'/content/char/';
  }
  worldDir() {
    if ( this.worldPath ) {
      return this.worldPath;
    }
    return this.contentBase+'/content/worlds';
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
        && this.trackTime + this.trackDelay < Date.now()
        && this.character
        && this.character.body
        && this.character.body.processed
        && ! this.character.activeAnimation
      ) {
      this.trackTime = Date.now();
      // CHECKME: mirror left-right
      if ( this.vrHelper.leftController ) {
        if ( this.mirror ) {
          var leftPos = this.calcControllerPos( this.character.body.leftArm, this.vrHelper.leftController);
          this.character.reachFor( this.character.body.leftArm, leftPos );
        } else {
          var leftPos = this.calcControllerPos( this.character.body.rightArm, this.vrHelper.leftController);
          this.character.reachFor( this.character.body.rightArm, leftPos );
        }
      }
      if ( this.vrHelper.rightController ) {
        if ( this.mirror ) {
          var rightPos = this.calcControllerPos( this.character.body.rightArm, this.vrHelper.rightController );
          this.character.reachFor( this.character.body.rightArm, rightPos );
        } else {
          var rightPos = this.calcControllerPos( this.character.body.leftArm, this.vrHelper.rightController );
          this.character.reachFor( this.character.body.leftArm, rightPos );
        }
      }
      this.character.lookAt( this.calcCameraTarget() );
      this.character.trackHeight( this.vrHelper.camera().realWorldHeight );
    }
  }
  
  calcControllerPos( arm, xrController ) {
    arm.pointerQuat = xrController.pointer.rotationQuaternion;
    var cameraPos = this.vrHelper.camera().position;
    // this calc swaps front-back, like mirror image
    var pos = xrController.grip.absolutePosition.subtract( new BABYLON.Vector3(cameraPos.x, 0, cameraPos.z));
    if ( this.mirror ) {
      pos.z = - pos.z;
    }
    return pos;
  }
  
  calcCameraTarget() {
    var cameraQuat = this.vrHelper.camera().rotationQuaternion;
    var target = new BABYLON.Vector3(0,this.vrHelper.camera().realWorldHeight,1);
    target.rotateByQuaternionAroundPointToRef(cameraQuat,this.character.headPos(),target);
    if ( this.mirror ) {
      target.z = -target.z;
    }
    return target;
  }

  createSelection(selectionCallback) {
    this.selectionCallback = selectionCallback;
    VRSPACEUI.listMatchingFiles( this.characterDir(), (folders) => {
      folders.push({name:"video"});
      if ( this.customAvatarFrame ) {
        folders.push({name:"custom"});
      }
      var buttons = new Buttons(this.scene,"Avatars",folders,(dir) => this.createAvatarSelection(dir),"name");
      buttons.setHeight(.5);
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
    } else if (folder.name == "video") {
      this.createVideoAvatar();
    } else if (folder.name == "custom") {
      this.createCustomAvatar();
    }
            
  }
  
  async createVideoAvatar() {
    if ( this.video ) {
      return;
    }
    // load video avatar and start streaming video
    this.video = new VideoAvatar( 
      this.scene, 
      () => {
        if ( this.character ) {
          this.character.dispose();
          delete this.character;
          this.guiManager.dispose();
          delete this.guiManager;
        }
        this.portalsEnabled(true);        
      }, 
      this.customOptions
    );
    await this.video.show();
  }
  removeVideoAvatar() {
    if ( this.video ) {
      this.video.dispose();
      delete this.video;
    }
  }

  async createCustomAvatar() {
    this.removeVideoAvatar();
    // based on example from
    // https://github.com/readyplayerme/Example-iframe/blob/develop/src/iframe.html   
    if ( !this.customAvatarFrame ) {
      return;
    }
    
    this.customAvatarFrame.src = `https://vrspace.readyplayer.me/avatar?frameApi`;
    this.customAvatarFrame.hidden = false;

    const subscribe = (event) => {
      //console.log(event.data);
      try {
        var json = JSON.parse(event.data);
      } catch ( error ) {
        return;
      }

      if (json?.source !== 'readyplayerme') {
        return;
      }

      // Susbribe to all events sent from Ready Player Me once frame is ready
      if (json.eventName === 'v1.frame.ready') {
        this.customAvatarFrame.contentWindow.postMessage(
          JSON.stringify({
            target: 'readyplayerme',
            type: 'subscribe',
            eventName: 'v1.**'
          }),
          '*'
        );
      }

      // Get avatar GLB URL
      if (json.eventName === 'v1.avatar.exported') {
        var avatarUrl = json.data.url;
        // something like
        // https://d1a370nemizbjq.cloudfront.net/a13ab5dc-358d-45e4-a602-446b9c840155.glb
        console.log("Avatar URL: "+avatarUrl);
        this.customAvatarFrame.hidden = true;
        var pos = avatarUrl.lastIndexOf('/');
        var path = avatarUrl.substring(0,pos);
        var file = avatarUrl.substring(pos+1);
        var folder = new ServerFolder( path, "");
        this.loadCharacter(folder, file);
      }

      // Get user id
      if (json.eventName === 'v1.user.set') {
        console.log(`User with id ${json.data.id} set: ${JSON.stringify(json)}`);
      }
    }


    window.addEventListener('message', subscribe);
    document.addEventListener('message', subscribe);
    
  }

  loadCharacterUrl( url ) {
    console.log('loading character from '+url);
    var file = new ServerFile( url );
    this.loadCharacter( file, file.file);
  }
  
  loadCharacter(dir, file="scene.gltf") {
    this.tracking = false;
    this.indicator.add(dir);
    this.indicator.animate();
    console.log("Loading character from "+dir.name);
    var loaded = new Avatar(this.scene, dir, this.shadowGenerator);
    loaded.file = file;
    // resize the character to real-world height
    if ( this.inXR ) {
      this.userHeight = this.vrHelper.camera().realWorldHeight;
    }
    loaded.userHeight = this.userHeight;
    loaded.animateArms = false;
    loaded.debug = this.debug;
    loaded.load( (c) => {
      this.removeVideoAvatar();
      this.tracking = true;
      this.indicator.remove(dir);
      if ( ! this.character ) {
        this.addCharacterButtons();
        this.portalsEnabled(true);
      }
      this.character = loaded.replace(this.character);
      this.character.setName(this.userName);
      this.animationButtons(this.character);
      if ( this.selectionCallback ) {
        this.selectionCallback(this.character);
      }
    });
  }

  setMyName(name) {
    this.userName = name;
    if ( this.character ) {
      this.character.setName(this.userName);
    }
  }
  
  getMyName() {
    return this.userName;
  }

  // TODO: provide API calls lib
  async getJson(url){
    let data = await this.getText(url);
    try {
      console.log( url+' returned '+data);
      return JSON.parse(data);
    } catch ( err ) {
      console.log("JSON error: ", err);
    }
  }
  
  async getText(url){
    let data = await (fetch(url)
      .then(res => {
        return res.text();
      })
      .catch(err => {
        console.log("Fetch error: ", err);
      })
    );
    return data;
  }

  async setLoginName(name) {
    var validName = await this.getText("/user/available?name="+name);
    console.log("Valid name: "+validName);
    if ( validName ) {
      this.userName = name;
    }
    return validName;
  }
  
  oauth2login() {
    window.open('/oauth2/login?name='+this.userName, '_top');
  }
  
  async getUserName() {
    var loginName = await this.getText("/user/name");
    console.log("User name: "+loginName);
    return loginName;
  }
  
  async getUserObject() {
    var userObject = await this.getJson("/user/object");
    console.log("User object ", userObject);
    return userObject.Client;
  }
  
  async getAuthenticated() {
    var isAuthenticated = await this.getText("/user/authenticated");
    console.log("User is authenticated: "+isAuthenticated);
    return 'true' === isAuthenticated;
  }
  
  animationButtons(avatar) {
    if ( ! this.showAnimationButtons ) {
      return;
    }
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
    this.animationSelection = new Buttons(this.scene,"Animations",names, (name)=>this.startAnimation(name));
    this.animationSelection.turnOff = true;
    this.animationSelection.setHeight(Math.min(2,names.length/10));
    this.animationSelection.group.position = new BABYLON.Vector3(-2,2.2,-.5);
  }

  startAnimation(name) {
    this.character.startAnimation(name);
  }

  addCharacterButtons() {
    this.guiManager = new BABYLON.GUI.GUI3DManager(this.scene);
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
        this.userHeight = this.vrHelper.camera().realWorldHeight;
        console.log("Resizing to "+this.userHeight);
        this.character.userHeight = this.userHeight;
        this.character.standUp(); // CHECKME: move to resize()?
        this.character.resize();
        this.character.maxUserHeight = null;
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
          this.mirror = false;
          this.character.rootMesh.rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, 0);
        } else {
          mirrorButton.text = "Mirroring";
          this.mirror = true;
          this.character.rootMesh.rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, Math.PI);
        }
    });
  }
  
  showPortals() {
    this.portals = {};
    VRSPACEUI.listThumbnails(this.worldDir(), (worlds) => {
      var radius = this.room.diameter/2;
      var angleIncrement = 2*Math.PI/worlds.length;
      var angle = 0;
      for ( var i=0; i < worlds.length; i++ ) {
        var x = Math.sin(angle)*radius;
        var z = Math.cos(angle)*radius;
        // heavy performance impact
        //new Portal( scene, worlds[i], this.enter, this.shadowGenerator).loadAt( x,0,z, angle);
        var portal = new Portal( scene, worlds[i], (p)=>this.enterPortal(p));
        this.portals[portal.name] = portal;
        portal.loadAt( x,0,z, angle);
        angle += angleIncrement;
      }
      this.showActiveUsers();
    });
  }

  showActiveUsers() {
    fetch('/worlds/users').then(response=>response.json().then(worldStats=>{
      if ( worldStats ) {
        worldStats.forEach(stat=>{
          //console.log(stat);
          if ( this.portals[stat.worldName] ) {
            if ( stat.activeUsers > 0 ) {
              this.portals[stat.worldName].setTitle('Users: '+stat.activeUsers+'/'+stat.totalUsers);
            } else {
              this.portals[stat.worldName].setTitle(null);
            }
          }
        });
      }
    }));
  }
  portalsEnabled(enable) {
    if (this.portals) {
      for ( var worldName in this.portals ) {
        this.portals[worldName].enabled(enable&&this.hasAvatar());
      }
    }
  }
  
  hasAvatar() {
    return this.video || this.character;
  }
  
  removePortals() {
    if (this.portals) {
      for ( var worldName in this.portals) {
        this.portals[worldName].dispose();
      }
      delete this.portals;
    }
  }

  avatarUrl() {
    var url = "video";
    if ( this.character ) {
      url = this.character.getUrl(); 
    }
    return url;
  }
  
  async enterPortal( portal ) {
    this.enterWorld(portal.worldUrl(), portal.name );
  }
  
  async enterWorld( worldUrl, worldName, avatarUrl = this.avatarUrl(), worldScript  = 'world.js') {
    console.log("Entering world "+worldUrl+'/'+ worldScript+' as '+avatarUrl);
    if ( this.video && this.displayOwnVideo ) {
      // CHECKME: dispose or attach?
      //this.video.dispose();
      //delete this.video;
      this.video.attachToCamera();
    }
    if ( this.beforeEnter ) {
      this.beforeEnter(this);
    }
    import(worldUrl+'/'+worldScript).then((world)=>{
      var afterLoad = (world) => {
        world.serverUrl = this.serverUrl;
        
        console.log(world);
        
        // TODO refactor this to WorldManager
        this.worldManager = new WorldManager(world);
        this.worldManager.customOptons = this.customOptions;
        this.worldManager.debug = this.debug; // scene debug
        this.worldManager.VRSPACE.debug = this.debug; // network debug
        
        if ( this.inXR ) {
          console.log("Tracking, "+this.inXR);
          this.worldManager.trackCamera(this.vrHelper.camera());
          // floors that exist only after load
          this.vrHelper.addFloors();
        }
        this.worldManager.mediaStreams = new OpenViduStreams(this.scene, 'videos');
        var myProperties = {
          mesh:avatarUrl, 
          userHeight:this.userHeight, 
          // send custom shared transient properties like this:
          properties:{string:'string', number:123.456}
        };
        if ( this.userName ) {
          myProperties.name = this.userName;
        }
        this.worldManager.enter( 
          myProperties
        ).then( (welcome) => {
          // CHECKME better way to flag publishing video?
          this.worldManager.pubSub(welcome.client, 'video' === avatarUrl);
          if ( this.afterEnter ) {
            this.afterEnter(this, world);
          }
        }).catch((e)=>{
          console.log("TODO: disconnected", e);
          if ( this.afterExit ) {
            this.afterExit(this);
          }
        });
        //var recorder = new RecorderUI(world.scene);
        //recorder.showUI();
      }
      
      // CHECKME: may be a babylonjs bug, but new camera has null gamepad
      // TODO: new camera may be of type that doesn't support gamepad
      var gamepad = this.camera.inputs.attached.gamepad.gamepad;

      world.WORLD.init(this.engine, worldName, this.scene, afterLoad, worldUrl+"/").then((newScene)=>{
        this.vrHelper.stopTracking();
        this.camera.detachControl(this.canvas);

        console.log("Loaded ", world);
        this.vrHelper.clearFloors();
        world.WORLD.initXR(this.vrHelper);
        
        // TODO install world's xr device tracker
        if ( this.inXR ) {
          // for some reason, this sets Y to 0:
          this.vrHelper.camera().setTransformationFromNonVRCamera(world.WORLD.camera);
          this.vrHelper.camera().position.y = world.WORLD.camera.position.y;
          this.vrHelper.startTracking();
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
        this.dispose();
        
      });
    });
  }

  dispose() {
    super.dispose();
    this.hemisphere.dispose();
    this.removePortals();
    this.room.dispose(); // AKA ground
    // CHECKME properly dispose of avatar
    if ( this.character ) {
      this.character.dispose();
      //VRSPACEUI.assetLoader.unloadAsset(this.character.getUrl());
      this.character = null;
    }
    
    if ( this.mainButtons ) {
      this.mainButtons.dispose();
    }
    if ( this.characterButtons ) {
      this.characterButtons.dispose();
    }
    
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
