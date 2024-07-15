import { VRSPACEUI, VRSpaceAPI, World, Buttons, LogoRoom, Portal, WorldManager, HumanoidAvatar, VideoAvatar, AvatarController, OpenViduStreams, ServerFile, LoginForm, DefaultHud, ServerFolder } from './js/vrspace-min.js';

export class AvatarSelection extends World {
  constructor() {
    super();
    /** server to connect to */
    this.serverUrl = null;
    /** content base, defaults to VRSPACEUI.contentBase */
    this.contentBase = VRSPACEUI.contentBase;
    /** background base dir, null defaults to contentBase+"/content/skybox/mp_drakeq/drakeq" (box) 
    or "/content/skybox/eso_milkyway/eso0932a.jpg" (panoramic)*/
    this.backgroundPath = null;
    /** Is backgroundPath a panoramic image? Default false (directory containing 6 images) */
    this.backgroundPanorama = false;
    /** character base dir, null defaults to contentBase+'/content/char/' */
    this.characterPath = null;
    /** character animation folder, null defaults to contentBase+'/content/rpm-anim/' */
    this.animationPath = null;
    /** world base dir, null defaults to contentBase+'/content/worlds' */
    this.worldPath = null;
    /** function to call just before entering a world */
    this.beforeEnter = null;
    /** function to call after entering a world */
    this.afterEnter = null;
    /** function to call after exiting a world */
    this.afterExit = null;
    /** whether to list animations after character loads, default true */
    this.showAnimationButtons = true;
    /** enable oauth2 login form, default true */
    this.enableLogin = true;
    /** wheter to display own video avatar, default true */
    this.displayOwnVideo = true;
    /** custom video avatar options, default null */
    this.customOptions = null;
    /** movement tracking/animation frames per second */
    this.fps = 50;
    /** Enable Oauth2 login */
    this.oauth2enabled = true;
    /** default user height, 1.8 m */
    this.userHeight = 1.8;
    /** is anonymous entry (guest login) allowed */
    this.anonymousAllowed = true;
    /** enable plenty of debug info */
    this.debug = false;
    /** z position of character and animation buttons */
    this.buttonsZ = -1;
    // state variables
    this.mirror = true;
    this.authenticated = false;
    this.customAnimations = [];
    this.customAvatarFrame = document.getElementById('customAvatarFrame');
    this.trackTime = Date.now();
    this.trackDelay = 1000 / this.fps;
    this.api = new VRSpaceAPI(VRSPACEUI.contentBase + "/vrspace/api");
    this.tokens = {};
  }
  async createSkyBox() {
    if (this.backgroundPanorama) {
      var skybox = new BABYLON.PhotoDome("skyDome",
        this.backgroundDir(),
        {
          resolution: 32,
          size: 1000
        },
        this.scene
      );
    } else {
      var skybox = BABYLON.Mesh.CreateBox("skyBox", 100.0, this.scene);
      skybox.rotation = new BABYLON.Vector3(0, Math.PI, 0);
      var skyboxMaterial = new BABYLON.StandardMaterial("skyBox", this.scene);
      skyboxMaterial.backFaceCulling = false;
      skyboxMaterial.disableLighting = true;
      skybox.material = skyboxMaterial;
      skybox.infiniteDistance = true;
      skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture(this.backgroundDir(), this.scene);
      skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
      // CHECKME:
      this.environmentTexture = new BABYLON.CubeTexture(this.backgroundDir(), this.scene);
      this.environmentTexture.rotationY = Math.PI;
      this.scene.environmentTexture = this.environmentTexture
      this.scene.environmentIntensity = 1;
    }
    return skybox;
  }
  async createCamera() {
    // Add a camera to the scene and attach it to the canvas
    this.camera = this.universalCamera(new BABYLON.Vector3(0, 2, -5));
    this.camera.setTarget(new BABYLON.Vector3(0, 1.5, 0));
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
    super.createPhysics();
  }
  async createUI() {
    
    this.hud = new DefaultHud(this.scene);
    this.hud.init();

    let providers = await this.api.listOAuthProviders();
    this.loginForm = new LoginForm(
      (text) => this.setMyName(text),
      () => this.checkValidName(),
      (providerId, providerName) => {
        if (this.oauth2enabled) {
          this.api.oauth2login(providerId, this.userName, this.avatarUrl(""))
        }
      },
      providers
    );
    // position the form just in front of avatar
    // make room for virtual keyboard, and resize/mirror buttons
    if (this.enableLogin) {
      this.loginForm.position = new BABYLON.Vector3(.25, .6, -1);
      this.loginForm.init(); // starts speech recognition
    }
    // testing various REST calls here
    this.api.getAuthenticated().then(isAuthenticated => {
      this.hud.setAuthenticated(isAuthenticated);
      if (isAuthenticated) {
        this.authenticated = true;
        this.api.getUserName().then(name => {
          this.setMyName(name);
        });
        this.api.getUserObject().then(me => {
          if ( me ) {
            console.log("user mesh " + me.mesh, me);
            if (me.mesh) {
              if ( me.mesh == "video") {
                this.createVideoAvatar();
              } else {
                this.loadCharacterUrl(me.mesh);
              }
            }
          } else {
            console.log("WARNING: user is logged in but has no avatar");
            // TODO
            // apparently user can be authenticated via Oauth2 but not to vrspace server
          }
          this.loginForm.dispose();
        });
      }
    });

  }

  // CHECKME this is confusing as it enables/disables portals
  checkValidName() {
    let ret = true;
    if (this.authenticated) {
      this.portalsEnabled(true);
    } else {
      console.log('checking name ' + this.userName);
      if (this.userName) {
        this.api.verifyName(this.userName).then(validName => {
          console.log("Valid name: " + validName);
          if (validName) {
            this.loginForm.defaultLabel();
            canvas.focus();
          } else {
            //this.loginForm.setLabel("INVALID NAME, try another:");
            this.loginForm.setLabel("Existing name, log in:");
            ret = false;
          }
          this.portalsEnabled(validName);
        });
      } else {
        this.loginForm.defaultLabel();
        this.portalsEnabled(this.anonymousAllowed);
      }
    }
    return ret;
  }


  backgroundDir() {
    if (this.backgroundPath) {
      return this.backgroundPath;
    }
    if (this.backgroundPanorama) {
      return this.contentBase + "/content/skybox/eso_milkyway/eso0932a.jpg";
    }
    return this.contentBase + "/content/skybox/mp_drakeq/drakeq";
    //return this.contentBase + "/content/skybox/eso_milkyway/milkyway";
  }
  characterDir() {
    if (this.characterPath) {
      return this.characterPath;
    }
    return this.contentBase + '/content/char/';
  }
  animationDir() {
    if (this.animationPath) {
      return this.animationPath;
    }
    return this.contentBase + '/content/rpm-anim/';
  }
  worldDir() {
    if (this.worldPath) {
      return this.worldPath;
    }
    return this.contentBase + '/content/worlds';
  }

  isSelectableMesh(mesh) {
    return mesh == this.ground
      || this.loginForm && this.loginForm.isSelectableMesh(mesh)
      || mesh.name && (mesh.name.startsWith("Button")
      || mesh.name.startsWith("PortalEntrance"))
      || super.isSelectableMesh(mesh);
  }

  getFloorMeshes() {
    return [this.ground];
  }

  load(name, file) {
    this.loaded(file, null);
    this.initXR();
  }

  trackXrDevices() {
    if (this.tracking
      && this.trackTime + this.trackDelay < Date.now()
      && this.character
      && this.character.body
      && this.character.body.processed
      && !this.character.activeAnimation
    ) {
      this.trackTime = Date.now();
      // CHECKME: mirror left-right
      if (this.xrHelper.controller.left) {
        if (this.mirror) {
          var leftPos = this.calcControllerPos(this.character.body.leftArm, this.xrHelper.controller.left);
          leftPos.z = -leftPos.z;
          this.character.reachFor(this.character.body.leftArm, leftPos);
        } else {
          var leftPos = this.calcControllerPos(this.character.body.rightArm, this.xrHelper.controller.left);
          this.character.reachFor(this.character.body.rightArm, leftPos);
        }
      }
      if (this.xrHelper.controller.right) {
        if (this.mirror) {
          var rightPos = this.calcControllerPos(this.character.body.rightArm, this.xrHelper.controller.right);
          rightPos.z = -rightPos.z;
          this.character.reachFor(this.character.body.rightArm, rightPos);
        } else {
          var rightPos = this.calcControllerPos(this.character.body.leftArm, this.xrHelper.controller.right);
          this.character.reachFor(this.character.body.leftArm, rightPos);
        }
      }
      this.character.lookAt(this.calcCameraTarget());
      this.character.trackHeight(this.xrHelper.realWorldHeight());
    }
  }

  calcControllerPos(arm, xrController) {
    this.calcControllerRot(arm, xrController);
    var cameraPos = this.xrHelper.camera().position;
    var pos = xrController.grip.absolutePosition.subtract(new BABYLON.Vector3(cameraPos.x, 0, cameraPos.z));
    return pos;
  }

  calcControllerRot(arm, xrController) {
    arm.pointerQuat = xrController.pointer.rotationQuaternion.clone();
    if (!this.mirror) {
      // heuristics 1, mirrored arm rotation, works well below shoulder
      //arm.pointerQuat.y = - arm.pointerQuat.y;
      // heuristics 2, never point backwards
      //arm.pointerQuat.z = - arm.pointerQuat.z;
      arm.pointerQuat = BABYLON.Quaternion.Inverse(arm.pointerQuat);
      //if ( arm.pointerQuat.z < 0 ) {
      //arm.pointerQuat.z = 0;
      //}
    }
  }

  calcCameraTarget() {
    var cameraQuat = this.xrHelper.camera().rotationQuaternion;
    var target = new BABYLON.Vector3(0, this.xrHelper.realWorldHeight(), 1);
    target.rotateByQuaternionAroundPointToRef(cameraQuat, this.character.headPos(), target);
    if (this.mirror) {
      target.z = -target.z;
    }
    return target;
  }

  listAnimations() {
    VRSPACEUI.listDirectory(this.animationDir(), animations => {
      this.customAnimations = animations;
    });
  }

  createSelection(selectionCallback) {
    if (window.location.search) {
      var avatarUrl = new URLSearchParams(window.location.search).get("avatarUrl");
      if (avatarUrl) {
        this.loadCharacterUrl(avatarUrl);
      }
    }

    this.selectionCallback = selectionCallback;
    VRSPACEUI.listMatchingFilesAsync(this.characterDir()).then( (folders) => {
      folders.push({ name: "video" });
      if (this.customAvatarFrame) {
        folders.push({ name: "custom" });
      }
      var buttons = new Buttons(this.scene, "Avatars", folders, (dir) => this.createAvatarSelection(dir), "name");
      buttons.setHeight(.5);
      buttons.group.position = new BABYLON.Vector3(.3, 2.2, this.buttonsZ);
      buttons.select(0);
      this.mainButtons = buttons;
    });
    this.listAnimations();
  }

  async createAvatarSelection(folder) {
    if (this.characterButtons) {
      this.characterButtons.dispose();
    }
    if (folder.url) {
      VRSPACEUI.listCharactersAsync(folder.url()).then( avatars => {
        var buttons = new Buttons(this.scene, folder.name, avatars, (dir) => this.loadCharacter(dir), "name");
        buttons.setHeight(0.1 * Math.min(20, avatars.length));
        buttons.group.position = new BABYLON.Vector3(1, 2.2, this.buttonsZ);
        this.characterButtons = buttons;
      });
    } else if (folder.name == "video") {
      this.createVideoAvatar();
    } else if (folder.name == "custom") {
      this.createCustomAvatar();
    }

  }

  async createVideoAvatar() {
    if (this.video) {
      return;
    }
    // load video avatar and start streaming video
    this.video = new VideoAvatar(
      this.scene,
      () => {
        if (this.character) {
          this.character.dispose();
          delete this.character;
          // do NOT dispose one created by HUD
          //this.guiManager.dispose();
          //delete this.guiManager;
          this.removeCharacterButtons();
        }
        this.portalsEnabled(true);
        this.hud.setAvatar(null);
        this.hud.toggleWebcam(true, this.video);
      },
      this.customOptions
    );
    await this.video.show();
    this.video.setName(this.userName);
  }
  removeVideoAvatar() {
    this.hud.toggleWebcam(false);
    this.hud.videoAvatar = null;
    if (this.video) {
      this.video.dispose();
      delete this.video;
    }
  }

  async createCustomAvatar() {
    this.removeVideoAvatar();
    // based on example from
    // https://github.com/readyplayerme/Example-iframe/blob/develop/src/iframe.html   
    if (!this.customAvatarFrame) {
      return;
    }

    this.customAvatarFrame.src = `https://vrspace.readyplayer.me/avatar?frameApi`;
    this.customAvatarFrame.hidden = false;

    const subscribe = (event) => {
      //console.log(event.data);
      try {
        var json = JSON.parse(event.data);
      } catch (error) {
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
        console.log("Avatar URL: " + avatarUrl);
        this.customAvatarFrame.hidden = true;
        this.loadCharacterUrl(avatarUrl);
      }

      // Get user id
      if (json.eventName === 'v1.user.set') {
        console.log(`User with id ${json.data.id} set: ${JSON.stringify(json)}`);
      }
    }


    window.addEventListener('message', subscribe);
    document.addEventListener('message', subscribe);

  }

  loadCharacterUrl(url) {
    console.log('loading character from ' + url);
    var file = new ServerFile(url);
    this.loadCharacter(file, file.file);
  }

  loadCharacter(dir, file = "scene.gltf") {
    this.tracking = false;
    this.indicator.add(dir);
    this.indicator.animate();
    console.log("Loading character from " + dir.name);
    var loaded = new HumanoidAvatar(this.scene, dir, this.shadowGenerator);
    loaded.file = file;
    loaded.animations = this.customAnimations;
    // resize the character to real-world height
    if (this.inXR()) {
      this.userHeight = this.xrHelper.realWorldHeight();
    }
    loaded.userHeight = this.userHeight;
    loaded.generateAnimations = false;
    loaded.debug = this.debug;
    loaded.load((c) => {
      // on success
      this.removeVideoAvatar();
      this.tracking = true;
      this.indicator.remove(dir);
      if (!this.character) {
        this.addCharacterButtons();
        this.portalsEnabled(true);
      }
      this.character = loaded.replace(this.character);
      this.character.setName(this.userName);
      this.animationButtons(this.character);
      if (this.selectionCallback) {
        this.selectionCallback(this.character);
      }
      this.checkValidName(); // conditionally enables portals
      this.hud.setAvatar(this.character);
    },
      // on error
      (exception) => {
        console.log("Error loading " + dir.name, exception);
        this.indicator.remove(dir);
      }
    );
  }

  setMyName(name) {
    this.userName = name;
    if (this.character) {
      this.character.setName(this.userName);
    } else if ( this.video ) {
      this.video.setName(this.userName);
    }
  }

  getMyName() {
    return this.userName;
  }

  animationButtons(avatar) {
    if (!this.showAnimationButtons) {
      return;
    }
    var names = []
    var playing;
    for (var i = 0; i < avatar.getAnimationGroups().length; i++) {
      var group = avatar.getAnimationGroups()[i];
      names.push(group.name);
      //console.log("Animation group: "+group.name+" "+group.isPlaying);
      if (group.isPlaying) {
        playing = i;
      }
      avatar.processAnimations(group);
    }
    console.log("Animations: " + names);
    if (this.animationSelection) {
      this.animationSelection.dispose();
    }
    this.animationSelection = new Buttons(this.scene, "Animations", names, (name) => this.startAnimation(name));
    this.animationSelection.turnOff = true;
    this.animationSelection.setHeight(Math.min(2, names.length / 10));
    this.animationSelection.group.position = new BABYLON.Vector3(-1.5, 2.2, this.buttonsZ);
  }

  startAnimation(name) {
    this.character.stopAnimation(name);
    this.character.startAnimation(name, true);
  }

  addCharacterButtons() {
    //this.guiManager = new BABYLON.GUI.GUI3DManager(this.scene);
    this.guiManager = VRSPACEUI.hud.guiManager;
    var resizeButton = new BABYLON.GUI.HolographicButton("resizeButton");
    resizeButton.contentResolution = 256;
    resizeButton.contentScaleRatio = 1;
    resizeButton.text = "Resize";
    this.guiManager.addControl(resizeButton);
    this.resizeButton = resizeButton;

    resizeButton.position = new BABYLON.Vector3(-0.5, 0.2, -0.8);
    resizeButton.node.scaling = new BABYLON.Vector3(.2, .2, .2);
    resizeButton.onPointerDownObservable.add(() => {
      if (this.inXR()) {
        this.tracking = false;
        this.userHeight = this.xrHelper.realWorldHeight();
        console.log("Resizing to " + this.userHeight);
        this.character.userHeight = this.userHeight;
        this.character.standUp(); // CHECKME: move to resize()?
        this.character.resize();
        this.character.maxUserHeight = null;
        this.tracking = true;
      }
    });

    var mirrorButton = new BABYLON.GUI.HolographicButton("mirrorButton");
    mirrorButton.contentResolution = 256;
    mirrorButton.contentScaleRatio = 1;
    mirrorButton.text = "Mirroring";
    this.guiManager.addControl(mirrorButton);
    this.mirrorButton = mirrorButton;

    mirrorButton.position = new BABYLON.Vector3(0.5, 0.2, -0.8);
    mirrorButton.node.scaling = new BABYLON.Vector3(.2, .2, .2);
    mirrorButton.onPointerDownObservable.add(() => {
      if (mirrorButton.text == "Mirroring") {
        mirrorButton.text = "Copying";
        this.mirror = false;
        this.character.parentMesh.rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, Math.PI);
      } else {
        mirrorButton.text = "Mirroring";
        this.mirror = true;
        this.character.parentMesh.rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, 0);
      }
    });
  }
  
  removeCharacterButtons() {
    if ( this.resizeButton ) {
      this.resizeButton.dispose();
      this.resizeButton = null;
    }
    if ( this.mirrorButton ) {
      this.mirrorButton.dispose();
      this.mirrorButton = null;
    }
  }

  /**
   * Show portals, typically called from html.
   * Sets internal variable this.portals.
   */
  showPortals() {
    this.portals = {};

    if ( window.location.search ) {
      // use specified worlds
      // at the moment, world folder still has to exist on the server
      const params = new URLSearchParams(window.location.search);
      const worldToken = params.get("worldToken");
      const worldName = params.get("worldName");
      const template = params.get("worldThumbnail");
      // CHECKME: this ignores baseUrl
      var serverFolder = new ServerFolder(this.worldDir()+"/", template, template+".jpg");
      var portal = new Portal( this.scene, serverFolder, (p)=>this.enterPortal(p));
      portal.name = worldName;
      this.tokens[worldName] = worldToken;
      this.portals[portal.name] = portal;
      portal.loadAt( 0,0,this.room.diameter / 2, 0);
    } else {
      // by default, list worlds from /content/worlds directory
      this.showContentPortals();
    }
  }

  /**
   * Show portals to public worlds avaliable under content/worlds server directory.
   */
  showContentPortals() {
    var radius = this.room.diameter / 2;
    var angle = 0;
    VRSPACEUI.listThumbnails(this.worldDir(), (worlds) => {
      var angleIncrement = 2 * Math.PI / worlds.length;
      for (var i = 0; i < worlds.length; i++) {
        var x = Math.sin(angle) * radius;
        var z = Math.cos(angle) * radius;
        // heavy performance impact
        //new Portal( this.scene, worlds[i], this.enter, this.shadowGenerator).loadAt( x,0,z, angle);
        var portal = new Portal(this.scene, worlds[i], (p) => this.enterPortal(p));
        this.portals[portal.name] = portal;
        portal.loadAt(x, 0, z, angle);
        angle += angleIncrement;
      }
      this.hud.portals = this.portals;
      this.showActiveUsers();
    });
  }
  // TODO: API client class/library
  showActiveUsers() {
    fetch(this.api.endpoint.worlds + '/users').then(response => response.json().then(worldStats => {
      if (worldStats) {
        worldStats.forEach(stat => {
          //console.log(stat);
          if (this.portals[stat.worldName]) {
            if (stat.activeUsers > 0) {
              this.portals[stat.worldName].setTitle('Users: ' + stat.activeUsers + '/' + stat.totalUsers);
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
      for (var worldName in this.portals) {
        this.portals[worldName].enabled(enable && this.hasAvatar());
      }
    }
  }

  hasAvatar() {
    return this.video || this.character;
  }

  removePortals() {
    if (this.portals) {
      for (var worldName in this.portals) {
        console.log("Disposing of portal " + worldName);
        this.portals[worldName].dispose();
      }
      delete this.portals;
    }
  }

  avatarUrl(defaultUrl="video") {
    var url = defaultUrl;
    if (this.character) {
      url = this.character.getUrl();
    }
    return url;
  }

  async enterPortal(portal) {
    if (this.checkValidName()) {
      this.enterWorld(portal.worldUrl(), portal.name);
    }
  }

  /**
   * Enter a world.
   * TODO quite complex method, order matters. This needs to be moved to a utility method, to allow entering one world from another.
   */
  async enterWorld(worldUrl, worldName, avatarUrl = this.avatarUrl(), worldScript = 'world.js') {
    console.log("Entering world " + worldUrl + '/' + worldScript + ' as ' + avatarUrl);
    if (this.video && this.displayOwnVideo) {
      // CHECKME: dispose or attach?
      //this.video.dispose();
      //delete this.video;
      this.video.attachToCamera();
    }
    if (this.beforeEnter) {
      this.beforeEnter(this);
    }
    this.loginForm.dispose();
    import(worldUrl + '/' + worldScript).then((world) => {

      world.WORLD.inVR = this.inVR;
      world.WORLD.inAR = this.inAR;

      var afterLoad = (world) => {
        world.serverUrl = this.serverUrl;

        // TODO refactor this to WorldManager
        this.worldManager = new WorldManager(world);
        this.worldManager.tokens = this.tokens;
        this.worldManager.customOptons = this.customOptions;
        this.worldManager.customAnimations = this.customAnimations;
        this.worldManager.debug = this.debug; // scene debug
        this.worldManager.VRSPACE.debug = this.debug; // network debug
        this.worldManager.remoteLogging = false;

        this.worldManager.mediaStreams = new OpenViduStreams(this.scene, 'videos');
        let avatar = this.video;
        if (this.character) {
          // character is null for e.g. video avatar
          // CHECKME this should be safe to do even earlier, before enter
          this.character.turnAround = true;
          avatar = this.character;
        }

        this.worldManager.enterAs(
          avatar
        ).then((welcome) => {
          world.initXR(this.vrHelper, this.arHelper, this.xrHelper);
          if (this.inXR()) {
            console.log("Tracking, " + this.inXR());
            this.worldManager.trackCamera(this.xrHelper.camera());
            this.xrHelper.startTracking();
            this.xrHelper.enableBackground(false);
          }

          let controller = new AvatarController(this.worldManager, avatar);
          this.worldManager.addMyChangeListener(changes => controller.processChanges(changes));
          // CHECKME better way to flag publishing video?
          this.worldManager.pubSub(welcome.client.User, 'video' === avatarUrl);
          this.hud.init();
          if (this.afterEnter) {
            this.afterEnter(this, world);
          }
        }).catch((e) => {
          console.log("TODO: disconnected", e);
          if (this.afterExit) {
            this.afterExit(this);
          }
        });
        //var recorder = new RecorderUI(world.scene);
        //recorder.showUI();
      }

      // CHECKME: may be a babylonjs bug, but new camera has null gamepad
      // TODO: new camera may be of type that doesn't support gamepad
      var gamepad = this.camera.inputs.attached.gamepad.gamepad;
      // other components (e.g. AvatarController) may require this
      this.xrHelper.stopTracking();

      world.WORLD.init(this.engine, worldName, this.scene, afterLoad, worldUrl + "/").then((newScene) => {

        try {
          this.camera.detachControl(this.canvas);

          console.log("Loaded ", world);
          // TODO install world's xr device tracker
          if (this.inXR()) {
            // for some reason, this sets Y to 0:
            this.xrHelper.camera().setTransformationFromNonVRCamera(world.WORLD.camera);
            this.xrHelper.camera().position.y = world.WORLD.camera.position.y;
          } else {
            console.log('New world camera:');
            console.log(world.WORLD.camera);
            // CHECKME: workaround, gamepad stops working
            // https://github.com/BabylonJS/Babylon.js/blob/master/src/Cameras/Inputs/freeCameraGamepadInput.ts
            // scene.gamepadManager does not emit event to the new camera
            if (gamepad) {
              world.WORLD.camera.inputs.attached.gamepad.gamepad = gamepad;
            }
            // CHECKME: why?
            this.scene.activeCamera = world.WORLD.camera;
          }
          this.dispose();
        } catch (err) {
          console.error(err);
        }

      });
    });
  }

  enableBackground(enabled) {
    this.room.floorGroup.setEnabled(enabled);
  }
  dispose() {
    super.dispose();
    this.hemisphere.dispose();
    this.removePortals();
    this.room.dispose(); // AKA ground
    // CHECKME properly dispose of avatar
    // disposing of own character effectively disables 3rd person view etc
    if (this.character) {
      //this.character.dispose();
      //VRSPACEUI.assetLoader.unloadAsset(this.character.getUrl());
      //this.character = null;
      this.character.hide();
    }

    if (this.mainButtons) {
      this.mainButtons.dispose();
    }
    if (this.characterButtons) {
      this.characterButtons.dispose();
    }

    if (this.animationSelection) {
      this.animationSelection.dispose();
    }
    if (this.guiManager) {
      // do NOT dispose one created by HUD
      //this.guiManager.dispose();
    }
    this.removeCharacterButtons();
    if (this.environmentTexture) {
      this.scene.environmentTexture = null;
      this.environmentTexture.dispose();
    }
    // CHECKME: this scene should be cleaned up, but when?
    //this.scene = null; // next call to render loop stops the current loop
  }
}

export const WORLD = new AvatarSelection();
