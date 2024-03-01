import { VRSPACEUI } from './vrspace-ui.js';
import { MediaStreams } from './media-streams.js';
import { SpeechInput } from './speech-input.js';

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
    this.state = { mic: false, camera: false, speech: SpeechInput.isEnabled() }
  }
  init() {
    if ( this.settingsButton && this.displayButtons ) {
      this.hud.clearRow();
      this.displayButtons = false;
    } else if (!this.settingsButton) {
      this.settingsButton = this.hud.addButton("Settings", this.contentBase + "/content/icons/settings.png", () => this.settings());
      this.hud.enableSpeech(true);
    }
  }
  settings() {
    this.displayButtons = !this.displayButtons;
    if ( this.displayButtons ) {
      this.hud.showButtons(false, this.settingsButton);
      this.hud.newRow();
      this.avatarButton = this.hud.addButton("Avatar", this.contentBase + "/content/icons/avatar.png", () => this.changeAvatar());
      this.avatarButton.isVisible = (this.avatar != null);
      this.micButton = this.hud.addButton("Microphone", this.contentBase + "/content/icons/microphone-off.png", () => this.toggleMic(), false);
      this.displayMic();
      this.camButton = this.hud.addButton("Camera", this.contentBase + "/content/icons/webcam-off.png", () => this.camera(), false);
      this.camera(this.state.camera);
      this.speechButton = this.hud.addButton("Voice", this.contentBase + "/content/icons/voice-recognition-off.png", () => this.speech(), false);
      this.speech(this.state.speech);
      this.helpButton = this.hud.addButton("Help", this.contentBase + "/content/icons/help.png", () => this.help());
      this.hud.enableSpeech(true);
    } else {
      this.hud.clearRow();
      this.hud.showButtons(true);
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
      this.camButton.isVisible = (avatar == null);
    }
    this.avatar = avatar;
  }
  changeAvatar() {
    // TODO
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
  camera(enable=!this.state.camera, videoAvatar) {
    console.log("Webcam: "+enable);
    if ( videoAvatar ) {
      this.videoAvatar = videoAvatar;
    }
    this.state.camera = enable;
    if ( this.camButton ) {
      // camButton may be created/destroyed any time
      if ( this.avatar ) {
        // no video streaming to the avatar
        this.camButton.isVisible = false;
        return;
      }
      this.camButton.isVisible = true;
      if (this.state.camera) {
        this.camButton.imageUrl = this.contentBase + "/content/icons/webcam.png";
        if ( this.videoAvatar ) {
          this.videoAvatar.displayVideo();
        }
      } else {
        this.camButton.imageUrl = this.contentBase + "/content/icons/webcam-off.png";
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
        this.speechButton.tooltipText = "Disable";
      } else {
        this.speechButton.imageUrl = this.contentBase + "/content/icons/voice-recognition-off.png";
        this.speechButton.tooltipText = "Enable";
      }
    } else {
      this.markDisabled(this.speechButton);
    }
  }
  help() {
    // TODO
  }
}