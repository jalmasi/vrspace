import { VRSPACE } from '../client/vrspace.js';
import { VRSPACEUI } from './vrspace-ui.js';
import { MediaStreams } from '../core/media-streams.js';
import { SpeechInput } from '../core/speech-input.js';
import { WorldManager } from '../core/world-manager.js';
import { World } from '../world/world.js';
import { VRSpaceAPI } from '../client/rest-api.js';
import { VRHelper } from '../xr/vr-helper.js';
import { ServerFile } from '../core/server-folder.js';
import { EmojiParticleSystem } from './world/emoji-particle-system.js';
import { Screencast } from './world/screencast.js';
import { Whiteboard } from './world/whiteboard.js';
import { TextArea } from './widget/text-area.js';

/**
 * Adds default holographic buttons to the HUD.
 */
export class DefaultHud {
  constructor(scene) {
    this.scene = scene;
    this.hud = VRSPACEUI.hud;
    this.hud.verticalWeb = -0.15;
    this.contentBase = VRSPACEUI.contentBase;
    this.displayButtons = false;
    this.avatar = null;
    this.videoAvatar = null;
    this.isAuthenticated = false;
    this.xrMovementChangeEnabled = true;
    this.xrTeleport = true;
    this.portals = {};
    this.state = { mic: false, webcam: false, speech: SpeechInput.isEnabled() };
    this.movementButton = null;
    this.cameraButton = null;
    this.buttons = [];
    this.emojiParticleSystem = new EmojiParticleSystem(scene);
    this.screencast = null;
    this.whiteboard = null;
    this.creditArea = null;
  }
  
  init() {
    if ( this.settingsButton && this.displayButtons ) {
      this.clearRow();
      this.displayButtons = false;
    } else if (!this.settingsButton) {
      this.settingsButton = this.hud.addButton("Settings", this.contentBase + "/content/icons/settings.png", () => this.settings());
      this.emojiButton = this.hud.addButton("Emoji", this.contentBase + "/content/icons/emoji.png", () => this.emojis());
      this.shareButton = this.hud.addButton("Share", this.contentBase + "/content/icons/share.png", () => this.share());
      this.hud.enableSpeech(true);
    }
  }
  
  streamingAvailable() {
    // TODO check server capabilities
    // screen sharing unavailable on mobiles
    return this.isOnline() && ! WorldManager.instance.world.hasTouchScreen();
  }
  
  isOnline() {
    return WorldManager.instance && WorldManager.instance.isOnline();
  }
  
  settings() {
    this.displayButtons = !this.displayButtons;
    if ( this.displayButtons ) {
      this.hud.showButtons(false, this.settingsButton);
      this.hud.newRow();

      this.showCameraControls();
      // CHECKME: flying through everything, should not be enabled by default
      this.showXRMovementControls();
      
      /*
      // this is supposed to either change profile, or allow user to activate some avatar animation
      this.avatarButton = this.hud.addButton("Avatar", this.contentBase + "/content/icons/avatar.png", () => this.changeAvatar());
      this.avatarButton.isVisible = (this.avatar != null);
      this.avatarButton.tooltipText = "TODO";
      */

      this.micButton = this.hud.addButton("Microphone", this.contentBase + "/content/icons/microphone-off.png", () => this.toggleMic(), false);
      this.micButton.tooltipText = "Toggle Microphone";
      this.displayMic();

      this.webcamButton = this.hud.addButton("Camera", this.contentBase + "/content/icons/webcam-off.png", () => this.toggleWebcam(), false);
      this.webcamButton.tooltipText = "Toggle Webcam";
      this.toggleWebcam(this.state.webcam);

      this.speechButton = this.hud.addButton("Voice", this.contentBase + "/content/icons/voice-recognition-off.png", () => this.speech(), false);
      this.speechButton.tooltipText = "Voice Commands";
      this.speech(this.state.speech);

      this.authorsButton = this.hud.addButton("Credits", this.contentBase + "/content/icons/copyleft.png", () => this.credits(), false);
      this.authorsButton.tooltipText = "Authors";

      this.helpButton = this.hud.addButton("Help", this.contentBase + "/content/icons/help.png", () => this.help());
      this.helpButton.tooltipText = "TODO";
      this.hud.enableSpeech(true);
    } else {
      this.clearRow();
    }
  }

  clearRow() {
    this.hud.clearRow();
    if ( this.cameraButton ) {
      this.cameraButton.dispose();
      this.cameraButton = null;
    }
    if ( this.movementButton ) {
      this.movementButton.dispose();
      this.movementButton = null;
    }
    if ( this.screencastButton ) {
      this.screencastButton.dispose();
      this.whiteboardButton.dispose();
      this.fileButton.dispose();
      this.screencastButton = null;
      this.whiteboardButton = null;
      this.fileButton = null;
    }
    if ( this.creditArea ) {
      this.creditArea.dispose();
      this.creditArea = null;
    }
    this.buttons.forEach(b=>b.dispose());
    this.buttons = [];
    this.hud.showButtons(true);    
  }
  
  emojis() {
    this.displayButtons = !this.displayButtons;
    if ( this.displayButtons ) {
      this.hud.showButtons(false, this.emojiButton);
      this.hud.newRow();
      // FIXME: synchronize this
      VRSPACEUI.listDirectory(this.contentBase + "/content/emoji", emojis => {
        console.log(emojis);
        emojis.forEach( url=>{
          let sf=new ServerFile(url);
          // do not use full url here, use only path and file
          let button = this.hud.addButton(sf.baseName, sf.getPath(), () => this.playEmoji(sf.getPath()), false);
          button.backMaterial.alpha = 1;
          button.plateMaterial.disableLighting = true;
          button.plateMaterial.emissiveColor = new BABYLON.Color3(0.3,0.3,0.3);
          button.onPointerUpObservable.add( () => this.stopEmoji() );   
          this.buttons.push(button);   
        });
      });
    } else {
      this.clearRow();
    }
  }

  playEmoji(url) {
    console.log("Playing emoji "+url);
    
    this.stopEmoji();
    if (this.isOnline()) {
      // online, bind to camera in 1st person and to avatar in 3rd person view
      if ( WorldManager.instance.world.camera3p && this.scene.activeCamera == WorldManager.instance.world.camera3p ) {
        this.emojiParticleSystem.init(url, WorldManager.instance.world.avatarController.avatar).start();
      } else {
        this.emojiParticleSystem.init(url).start();
      }
      // start remote emoji here
      WorldManager.instance.publishChanges( [{field:'emoji',value:url}] );
    } else if (this.avatar) {
      // offline, avatar chosen
      this.emojiParticleSystem.init(url, this.avatar, -5).start();
    } else if ( this.videoAvatar) {
      this.emojiParticleSystem.init(url, this.videoAvatar, -5).start();
    } else {
      // offline, no avatar yet
      this.emojiParticleSystem.init(url).start();
    }
  }
  
  stopEmoji() {
    console.log("Stopping emoji");
    this.emojiParticleSystem.stop();
    // stop remote emoji here
    if (this.isOnline()) {
      WorldManager.instance.publishChanges( [{field:'emoji',value:null}] );
    }
  }
  
  setAvatar(avatar) {
    if ( this.avatarButton ) {
      this.avatarButton.isVisible = (avatar != null);
      // we can't stream to avatar anyway, not yet
      this.webcamButton.isVisible = (avatar == null);
    }
    this.avatar = avatar;
  }
  
  changeAvatar() {
    // TODO
  }
  
  setAuthenticated(arg=false) {
    this.isAuthenticated = arg;
    if ( !this.displayButtons  && this.isAuthenticated && ! this.worldButton) {
      // add this button only once, to the first row along with settings button
      this.worldButton = this.hud.addButton("World", this.contentBase + "/content/icons/world-add.png", () => {this.showWorldTemplates()});
    }
  }
  
  showCameraControls() {
    if ( WorldManager.instance && WorldManager.instance.world && WorldManager.instance.world.camera3p && WorldManager.instance.world.camera1p ) {
      if ( ! this.cameraButton ) {
        this.cameraButton = this.hud.addButton("View", VRSPACEUI.contentBase+"/content/icons/camera-1st-person.png", () => this.toggleCamera());        
      }
      if ( this.scene.activeCamera == WorldManager.instance.world.camera1p ) {
        this.cameraButton.imageUrl = VRSPACEUI.contentBase+"/content/icons/camera-3rd-person.png";
        this.cameraButton.tooltipText = "3rd Person";
      } else if ( this.scene.activeCamera == WorldManager.instance.world.camera3p ) {
        this.cameraButton.imageUrl = VRSPACEUI.contentBase+"/content/icons/camera-1st-person.png";
        this.cameraButton.tooltipText = "1st Person";
      }
    }
  }
  
  toggleCamera() {
    if ( WorldManager.instance && WorldManager.instance.world && WorldManager.instance.world.camera3p && WorldManager.instance.world.camera1p ) {
      if ( this.scene.activeCamera == WorldManager.instance.world.camera1p ) {
        WorldManager.instance.world.thirdPerson();
      } else if ( this.scene.activeCamera == WorldManager.instance.world.camera3p ) {
        WorldManager.instance.world.firstPerson();
      }
      this.showCameraControls();
    }
  }
  
  showXRMovementControls() {
    if ( this.scene.activeCamera.getClassName() == 'WebXRCamera' ) {
      if ( ! this.movementButton ) {
        this.movementButton = this.hud.addButton("Movement", VRSPACEUI.contentBase+"/content/icons/man-run.png.png", () => this.toggleXRMovement());
      }
      if ( this.xrTeleport ) {
        VRHelper.getInstance().enableTeleportation();
        this.movementButton.imageUrl = VRSPACEUI.contentBase+"/content/icons/man-run.png";
        this.movementButton.tooltipText = "Slide";
      } else {
        VRHelper.getInstance().enableSliding();
        this.movementButton.imageUrl = VRSPACEUI.contentBase+"/content/icons/man-jump.png";
        this.movementButton.tooltipText = "Teleport";
      }    
    }
  }
  
  toggleXRMovement() {
    this.xrTeleport = !this.xrTeleport;
    this.showXRMovementControls();
  }
  
  displayMic() {
    if ( MediaStreams.instance ) {
      this.state.mic = MediaStreams.instance.publishingAudio;
      if (this.state.mic) {
        this.micButton.imageUrl = this.contentBase + "/content/icons/microphone.png";
      } else {
        this.micButton.imageUrl = this.contentBase + "/content/icons/microphone-off.png";
      }
    } else {
      this.state.mic = false;
      this.hud.markDisabled(this.micButton);
    }    
  }

  toggleMic(enabled=!this.state.mic) {
    if ( MediaStreams.instance ) {
      MediaStreams.instance.publishAudio(enabled);
      this.displayMic();
    }
  }

  toggleWebcam(enable=!this.state.webcam, videoAvatar) {
    console.log("Webcam: "+enable);
    if ( videoAvatar ) {
      this.videoAvatar = videoAvatar;
    }
    this.state.webcam = enable;
    if ( this.webcamButton ) {
      // webcamButton may be created/destroyed any time
      if ( this.avatar ) {
        // no video streaming to the avatar
        this.webcamButton.isVisible = false;
        return;
      }
      this.webcamButton.isVisible = true;
      if (this.state.webcam) {
        this.webcamButton.imageUrl = this.contentBase + "/content/icons/webcam.png";
        if ( this.videoAvatar ) {
          this.videoAvatar.displayVideo();
        }
      } else {
        this.webcamButton.imageUrl = this.contentBase + "/content/icons/webcam-off.png";
        if ( this.videoAvatar ) {
          this.videoAvatar.displayAlt();
        }
      }
      if ( MediaStreams.instance ) {
        MediaStreams.instance.publishVideo(enable);
      }
    }
  }

  speech(enable=!this.state.speech) {
    if ( SpeechInput.available() ) {
      this.state.speech = enable;
      SpeechInput.enabled = enable;
      this.hud.enableSpeech(enable);
      if (this.state.speech) {
        this.speechButton.imageUrl = this.contentBase + "/content/icons/voice-recognition.png";
      } else {
        this.speechButton.imageUrl = this.contentBase + "/content/icons/voice-recognition-off.png";
      }
    } else {
      this.hud.markDisabled(this.speechButton);
    }
  }

  credits() {
    let assets = VRSPACEUI.assetLoader.assetInfos();
    if ( this.creditArea ) {
      this.hud.markEnabled(this.authorsButton, true);
      this.creditArea.dispose();
      this.creditArea = null;
      return;
    }
    if ( Object.keys(assets).length > 0 ) {
      this.hud.markActive(this.authorsButton, true);
      this.creditArea = new TextArea(this.scene, "TouchTextArea");
      let rows = Math.floor(Object.keys(assets).length / 4)+ 1;
      this.creditArea.width = 1024;
      this.creditArea.height = 512*rows;
      this.creditArea.text = "Credits:";
      this.creditArea.attachToHud();
      this.creditArea.size = .5;
      this.creditArea.position = new BABYLON.Vector3(0, .2, .5);
      this.creditArea.show();
      for ( let url in assets ) {
        this.creditArea.writeln();
        this.creditArea.writeln(url);
        let info = assets[url];
        if ( info ) {
          for ( let data in info ) {
            this.creditArea.println(data+": "+info[data]);
          }
        } else {
          this.creditArea.writeln('No author information available');
        }
      }    
    }
  }
  
  help() {
    // TODO
  }
  
  showWorldTemplates() {
    this.displayButtons = !this.displayButtons;
    if ( this.displayButtons ) {
      this.hud.showButtons(false, this.worldButton);
      this.hud.newRow();
      
      for (let name in this.portals) {
        let p = this.portals[name];
        let button = this.hud.addButton(p.name, p.imageUrl, () => {this.createWorld(p)});
        this.buttons.push(button);
      }
    } else {
      this.clearRow();
    }
  }
  
  async createWorld(portal) {
    console.log("TODO: creating new world from "+portal.name);
    const userName = this.avatar.name?this.avatar.name:this.videoAvatar.name;
    const worldName = userName+"'s world";
    const token = await VRSpaceAPI.getInstance().createWorldFromTemplate(worldName, portal.name);
    window.location.href = window.location.href+"?worldName="+worldName+"&worldToken="+token+"&worldThumbnail="+portal.name;
  }

  share() {
    this.displayButtons = !this.displayButtons;
    if ( this.displayButtons ) {
      this.hud.showButtons(false, this.shareButton);
      this.hud.newRow();
      this.screencastButton = this.hud.addButton("Share screen", this.contentBase + "/content/icons/share-screen.png", () => this.shareScreen(), false);
      this.whiteboardButton = this.hud.addButton("Whiteboard", this.contentBase + "/content/icons/whiteboard.png", () => this.toggleWhiteboard(), false);
      this.imageButton = this.hud.addButton("Share image", this.contentBase + "/content/icons/sky.png", () => this.image(), false);
      this.fileButton = this.hud.addButton("Share file", this.contentBase + "/content/icons/file.png", () => this.file(), false);
      this.modelButton = this.hud.addButton("Share model", this.contentBase + "/content/icons/cube.png", () => this.model(), false);
      if ( this.streamingAvailable() ) {
        this.hud.markEnabled(this.screencastButton);
      } else {
        this.hud.markDisabled(this.screencastButton);
      }
      if ( this.whiteboard ) {
        this.hud.markActive(this.whiteboardButton);
      } else {
        this.hud.markEnabled(this.whiteboardButton);
      }
      if ( this.isOnline() ) {
        this.hud.markEnabled(this.fileButton);
        this.hud.markEnabled(this.imageButton);
        this.hud.markEnabled(this.modelButton);
      } else {
        this.hud.markDisabled(this.fileButton);
        this.hud.markDisabled(this.imageButton);
        this.hud.markDisabled(this.modelButton);
      }
      if ( this.isOnline() ) {
        WorldManager.instance.world.addListener(this);
      }
    } else {
      if ( this.isOnline() ) {
        WorldManager.instance.world.removeListener(this);
      }
      this.clearRow();
    }
  }
  
  shareScreen() {
    if ( ! this.streamingAvailable() ) {
      return;
    }
    if ( this.screencast ) {
      this.hud.markEnabled(this.screencastButton)
      this.screencast.dispose();
      this.screencast = null;
      return;
    }
    this.hud.markActive(this.screencastButton)
    let world = WorldManager.instance.world;
    let camera = this.scene.activeCamera;
    this.screencast = new Screencast(world);
    this.screencast.position = camera.position.add(camera.getForwardRay(1).direction);
    this.screencast.size = 1;
    this.screencast.callback = state=>{ if(!state) this.hud.markEnabled(this.screencastButton)};
    this.screencast.init();
    this.screencast.startSharing();
  }

  toggleWhiteboard() {
    if ( this.whiteboard ) {
      this.hud.markEnabled(this.whiteboardButton)
      WorldManager.instance.world.removeListener(this.whiteboard);
      this.whiteboard.dispose();
      this.whiteboard = null;
      return;
    }
    let camera = this.scene.activeCamera;
    this.whiteboard = new Whiteboard(this.scene, "Whiteboard-"+WorldManager.myId());
    this.whiteboard.size = 2;
    this.whiteboard.position = camera.position.add(camera.getForwardRay(1).direction.scale(2));
    this.whiteboard.show();
    this.hud.markActive(this.whiteboardButton)
    this.whiteboard.closeCallback = () => {
      this.hud.markEnabled(this.whiteboardButton)
      this.whiteboard = null;
    }
    if ( this.isOnline() ) {
      WorldManager.instance.world.addListener(this.whiteboard);
      this.whiteboard.startSharing();
    }
    World.lastInstance.addSelectionPredicate(this.whiteboard.selectionPredicate);
  }
  
  image() {
    this.file(".jpg,.jpeg,.png");
  }
  
  model() {
    this.file(".glb,.zip");
  }
  
  file(accept) {
    if ( ! this.isOnline() ) {
      return;
    }
    let input = document.createElement("input");
    input.setAttribute('type', 'file');
    input.setAttribute('style','display:none');
    if ( accept ) {
      input.setAttribute('accept', accept);
    }
    document.body.appendChild(input);
    input.addEventListener("change", ()=>this.upload(input), false);
    input.addEventListener("cancel", ()=>this.upload(input), false);
    input.click();
  }
  
  upload(input) {
    console.log("Files: ", input.files);
    // we load only one, but still
    for ( let i = 0; i < input.files.length; i++) {
      const file = input.files[i];
      console.log("Uploading ",file);
      let camera = this.scene.activeCamera;
      let pos = camera.position.add(camera.getForwardRay(1).direction);

      VRSpaceAPI.getInstance().upload(file, pos, camera.rotation);
    };
    document.body.removeChild(input);
  }
  
  /** World LoadListener interface */
  loaded(vrObject) {
    console.log("Loaded ",vrObject);
    if ( vrObject.container ) {
      setTimeout(() => {
        let rootMesh = vrObject.container.meshes[0];
        var scale = 1 / WorldManager.instance.bBoxMax(rootMesh);
        //var scale = 1/this.worldManager.bBoxMax(this.worldManager.getRootNode(vrObject));
        VRSPACE.sendEvent(vrObject, { scale: { x: scale, y: scale, z: scale } });
      }, 100);
    }
  }
}