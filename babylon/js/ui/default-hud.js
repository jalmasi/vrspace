import { VRSPACEUI } from './vrspace-ui.js';
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
      this.profileButton = this.hud.addButton("Avatar", this.contentBase + "/content/icons/avatar.png", () => this.avatar());
      this.micButton = this.hud.addButton("Microphone", this.contentBase + "/content/icons/microphone-off.png", () => this.microphone(), false);
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
  avatar() {
    // TODO
  }
  microphone() {
    this.state.mic = !this.state.mic;
    if (this.state.mic) {
      this.micButton.imageUrl = this.contentBase + "/content/icons/microphone.png";
    } else {
      this.micButton.imageUrl = this.contentBase + "/content/icons/microphone-off.png";
    }
  }
  camera(enable=!this.state.camera, videoAvatar) {
    console.log("Webcam: "+enable);
    if ( videoAvatar ) {
      this.videoAvatar = videoAvatar;
    }
    //if ( this.state.camera != enable ) {
      this.state.camera = enable;
      if ( this.camButton ) {
        // camButton may be created/destroyed any time
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
      }
    //}
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
      this.speechButton.tooltipText = "N/A";
      this.speechButton.backMaterial.albedoColor = new BABYLON.Color3(0.67, 0.29, 0.29);
    }
  }
  help() {
    // TODO
  }
}