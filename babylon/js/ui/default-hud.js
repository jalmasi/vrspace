import { VRSPACEUI } from './vrspace-ui.js';
import { MediaStreams } from '../core/media-streams.js';
import { SpeechInput } from '../core/speech-input.js';
import { WorldManager } from '../core/world-manager.js';
import { VRSpaceAPI } from '../client/rest-api.js';
import { VRHelper } from '../xr/vr-helper.js';
import { ServerFile } from '../core/server-folder.js';
import { EmojiParticleSystem } from './emoji-particle-system.js';

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
  }
  
  init() {
    if ( this.settingsButton && this.displayButtons ) {
      this.clearRow();
      this.displayButtons = false;
    } else if (!this.settingsButton) {
      this.settingsButton = this.hud.addButton("Settings", this.contentBase + "/content/icons/settings.png", () => this.settings());
      this.emojiButton = this.hud.addButton("Emoji", this.contentBase + "/content/icons/emoji.png", () => this.emojis());
      this.hud.enableSpeech(true);
    }
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
    if (WorldManager.instance && WorldManager.instance.isOnline()) {
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
    if (WorldManager.instance && WorldManager.instance.isOnline()) {
      WorldManager.instance.publishChanges( [{field:'emoji',value:null}] );
    }
  }
  
  markDisabled(button) {
    if ( button ) {
      button.tooltipText = "N/A";
      button.backMaterial.albedoColor = new BABYLON.Color3(0.67, 0.29, 0.29);
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
      this.markDisabled(this.micButton);
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
      this.markDisabled(this.speechButton);
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
}