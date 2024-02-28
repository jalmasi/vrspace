import { VRSPACEUI } from './vrspace-ui.js';
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
    this.state = { mic: false, cam: false, speech: false }
  }
  init() {
    if ( this.settingsButton && this.displayButtons ) {
      this.hud.clearRow();
      this.displayButtons = false;
    } else if (!this.settingsButton) {
      this.settingsButton = this.hud.addButton("Settings", this.contentBase + "/content/icons/settings.png", () => this.settings());
    }
  }
  settings() {
    this.displayButtons = !this.displayButtons;
    if ( this.displayButtons ) {
      this.hud.showButtons(false, this.settingsButton);
      this.hud.newRow();
      this.profileButton = this.hud.addButton("Avatar", this.contentBase + "/content/icons/avatar.png", () => this.avatar());
      this.micButton = this.hud.addButton("Mic", this.contentBase + "/content/icons/microphone-off.png", () => this.microphone(), false);
      this.camButton = this.hud.addButton("Cam", this.contentBase + "/content/icons/webcam-off.png", () => this.webcam(), false);
      this.speechButton = this.hud.addButton("Voice", this.contentBase + "/content/icons/voice-recognition-off.png", () => this.speech(), false);
      this.speechButton.tooltipText = "N/A";
      this.speechButton.backMaterial.albedoColor = new BABYLON.Color3(0.67, 0.29, 0.29);
      this.helpButton = this.hud.addButton("Help", this.contentBase + "/content/icons/help.png", () => this.help());
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
  webcam() {
    this.state.cam = !this.state.cam;
    if (this.state.cam) {
      this.camButton.imageUrl = this.contentBase + "/content/icons/webcam.png";
    } else {
      this.camButton.imageUrl = this.contentBase + "/content/icons/webcam-off.png";
    }
  }
  speech() {
    this.state.speech = !this.state.speech;
    if (this.state.speech) {
      this.speechButton.imageUrl = this.contentBase + "/content/icons/voice-recognition.png";
    } else {
      this.speechButton.imageUrl = this.contentBase + "/content/icons/voice-recognition-off.png";
    }
  }
  help() {
    // TODO
  }
}