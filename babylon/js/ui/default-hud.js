import { VRSPACEUI } from './vrspace-ui.js';
import { MediaStreams } from './media-streams.js';
import { SpeechInput } from './speech-input.js';
import { WorldManager } from './world-manager.js';
import { VRSpaceAPI } from '../client/rest-api.js';
import { VRHelper } from './vr-helper.js';
import { ServerFile } from './server-folder.js';

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
    this.particleSystem = null;
    this.particleSource = null;
    this.buttons = [];
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
          let button = this.hud.addButton(sf.baseName, url, () => this.playEmoji(url), false);
          button.backMaterial.alpha = 1;
          button.plateMaterial.disableLighting = true;
          button.plateMaterial.emissiveColor = new BABYLON.Color3(0.3,0.3,0.3);
          button.onPointerUpObservable.add( () => this.stopEmoji(false) );   
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
    
    if ( BABYLON.GPUParticleSystem.IsSupported ) {
      this.particleSystem = new BABYLON.GPUParticleSystem("Emojis", {capacity: 100}, scene);
    } else {
      this.particleSystem = new BABYLON.ParticleSystem("Emojis", 100, scene);
    }
    this.particleSystem.particleTexture = new BABYLON.Texture(url, this.scene);

    // fixed position    
    //let pos = this.scene.activeCamera.position.add(this.scene.activeCamera.getForwardRay(1).direction.scale(2));
    //this.particleSystem.emitter = pos;
    // position bound to the camera
    if ( ! this.particleSource ) {
      this.particleSource = BABYLON.MeshBuilder.CreateSphere("particlePositon",{diameter: 0.1},this.scene);
      this.particleSource.isVisible = false;
    }
    let particleDirection = 5;
    // CHECKME: this may change with camera change, should be bound to avatar
    if (WorldManager.instance && WorldManager.instance.isOnline()) {
      // online, bind to camera in 1st person and to avatar in 3rd person view
      if ( WorldManager.instance.world.camera3p && this.scene.activeCamera == WorldManager.instance.world.camera3p ) {
        let avatar = WorldManager.instance.world.avatarController.avatar;
        this.particleSource.parent = avatar.parentMesh;
        this.particleSource.position = avatar.headPos().subtract(avatar.parentMesh.position);
        particleDirection = 5;
      } else {
        this.particleSource.parent = this.scene.activeCamera;
        this.particleSource.position = new BABYLON.Vector3(0,0,0.5);        
      }
    } else {
      // offline, bind to avatar in avatar choice room, or camera if no avatar chosen yet
      if ( this.avatar ) {
        this.particleSource.parent = this.avatar.parentMesh;
        this.particleSource.position = this.avatar.headPos();
        particleDirection = -5;
      } else {
        this.particleSource.parent = this.scene.activeCamera;
        this.particleSource.position = new BABYLON.Vector3(0,0,0.5);
      }      
    }
    this.particleSystem.emitter = this.particleSource;

    this.particleSystem.color1 = new BABYLON.Color4(1, 1, 1, 1.0);
    this.particleSystem.color2 = new BABYLON.Color4(1, 1, 1, 1.0);
    this.particleSystem.colorDead = new BABYLON.Color4(0.1, 0.1, 0.1, .5);
    // these make particles not disappear:
    //this.particleSystem.addColorGradient(0, new BABYLON.Color4(.2, .2, .2, 0.2), new BABYLON.Color4(.5, .5, .5, .5));
    //this.particleSystem.addColorGradient(0.2, new BABYLON.Color4(1, 1, 1, 1), new BABYLON.Color4(1, 1, 1, 1));
    //this.particleSystem.addColorGradient(0.8, new BABYLON.Color4(1, 1, 1, 1), new BABYLON.Color4(1, 1, 1, 1));
    //this.particleSystem.addColorGradient(1, new BABYLON.Color4(.2, .2, .2, 0), new BABYLON.Color4(.5, .5, .5, 0));

    // either randomize the size or animate the size all the same
    //this.particleSystem.minSize = 0.01;
    //this.particleSystem.maxSize = 0.1;
    this.particleSystem.addSizeGradient(0, 0.05); //size at start of particle lifetime
    this.particleSystem.addSizeGradient(0.5, 0.5); //size at half lifetime
    this.particleSystem.addSizeGradient(1, 1); //size at end of particle lifetime

    // and they slow down over time
    this.particleSystem.addVelocityGradient(0, 5);
    this.particleSystem.addVelocityGradient(1, 1);

    this.particleSystem.minLifeTime = 0.5;
    this.particleSystem.maxLifeTime = 3;

    this.particleSystem.emitRate = 20;
    
    this.particleSystem.createDirectedSphereEmitter(0.5, new BABYLON.Vector3(-0.5, -0.5, particleDirection), new BABYLON.Vector3(0.5, 0.5, particleDirection));

    this.particleSystem.minEmitPower = 1;
    this.particleSystem.maxEmitPower = 5;
    this.particleSystem.updateSpeed = 0.005;
    this.particleSystem.gravity = new BABYLON.Vector3(0,2,0);

    this.particleSystem.start();
  }
  
  stopEmoji(dispose=true) {
    if ( this.particleSystem ) {
      console.log("Stopping emoji");
      this.particleSystem.stop();
      if ( dispose ) {
        this.particleSystem.dispose();
        if ( this.particleSource ) {
          this.particleSource.dispose();
          this.particleSource = null;
        }
      }
      this.particleSystem = null;
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