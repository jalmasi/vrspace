import { VRSPACE } from '../../client/vrspace.js';
import { VRSPACEUI } from '../vrspace-ui.js';
import { VRSpaceAPI } from '../../client/rest-api.js';

/**
Event Recorder is server-side component.
This UI sends commands to the server that control recording and playback.
UI buttons (record, stop, play) are bound to current camera.
*/
export class RecorderUI {
  /** 
   * @param scene babylonjs scene
   * @param name eventRecorder name, defaults to Recorder:userId on the server 
   */
  constructor(scene, name) {
    // parameters
    this.scene = scene;
    this.name = name;
    this.recorder = null;
    this.contentBase = VRSPACEUI.contentBase;
  }
  /** 
   * Shows the UI
   * @param {*} button option HUD button that activates this submenu  
   */
  show(button) {
    if (button) {
      VRSPACEUI.hud.showButtons(false, button);
      VRSPACEUI.hud.newRow();
    }
    
    this.recordButton = VRSPACEUI.hud.addButton("REC", this.contentBase + "/content/icons/dot.png", () => this.record(), false);
    VRSPACEUI.hud.markEnabled(this.recordButton);

    this.stopButton = VRSPACEUI.hud.addButton("Stop", this.contentBase + "/content/icons/pause.png", () => this.stop(), false);
    VRSPACEUI.hud.markDisabled(this.stopButton);

    this.playButton = VRSPACEUI.hud.addButton("Play", this.contentBase + "/content/icons/play.png", () => this.play(), false);
    VRSPACEUI.hud.markDisabled(this.playButton);

    this.deleteButton = VRSPACEUI.hud.addButton("Delete", this.contentBase + "/content/icons/delete.png", () => this.delete(), false);
    VRSPACEUI.hud.markDisabled(this.deleteButton);

    this.saveButton = VRSPACEUI.hud.addButton("Save", this.contentBase + "/content/icons/save.png", () => this.save(), false);
    VRSPACEUI.hud.markDisabled(this.saveButton);

    this.loadButton = VRSPACEUI.hud.addButton("Load", this.contentBase + "/content/icons/file.png", () => this.load(), false);
    VRSPACEUI.hud.markEnabled(this.loadButton);
  }

  /** Start recording */
  record() {
    console.log("Recording...");
    if (!this.recorder) {
      // create recorder on the server
      VRSPACE.send('{"command":{"Recording":{"action":"record", "name":"' + this.name + '"}}}');
    }
    VRSPACEUI.hud.markDisabled(this.recordButton);
    VRSPACEUI.hud.markEnabled(this.stopButton);
    VRSPACEUI.hud.markDisabled(this.playButton);
    VRSPACEUI.hud.markDisabled(this.deleteButton);
    VRSPACEUI.hud.markDisabled(this.saveButton);
    VRSPACEUI.hud.markDisabled(this.loadButton);
  }
  /** Stop recording */
  stop() {
    console.log('Stopped');
    VRSPACE.send('{"command":{"Recording":{"action":"stop", "name":"' + this.name + '"}}}');
    VRSPACEUI.hud.markEnabled(this.recordButton);
    VRSPACEUI.hud.markDisabled(this.stopButton);
    VRSPACEUI.hud.markEnabled(this.playButton);
    VRSPACEUI.hud.markEnabled(this.deleteButton);
    VRSPACEUI.hud.markEnabled(this.saveButton);
    VRSPACEUI.hud.markDisabled(this.loadButton);
  }
  /** Start playing */
  play() {
    console.log('Playing...');
    VRSPACE.send('{"command":{"Recording":{"action":"play", "name":"' + this.name + '"}}}');
    VRSPACEUI.hud.markDisabled(this.recordButton);
    VRSPACEUI.hud.markEnabled(this.stopButton);
    VRSPACEUI.hud.markActive(this.playButton);
    VRSPACEUI.hud.markDisabled(this.deleteButton);
    VRSPACEUI.hud.markDisabled(this.saveButton);
    VRSPACEUI.hud.markDisabled(this.loadButton);
  }
  /** Delete current recorder */
  delete() {
    console.log('Deleted');
    VRSPACE.send('{"command":{"Recording":{"action":"delete", "name":"' + this.name + '"}}}');
    VRSPACEUI.hud.markEnabled(this.recordButton);
    VRSPACEUI.hud.markDisabled(this.stopButton);
    VRSPACEUI.hud.markDisabled(this.playButton);
    VRSPACEUI.hud.markDisabled(this.deleteButton);
    VRSPACEUI.hud.markDisabled(this.saveButton);
    VRSPACEUI.hud.markEnabled(this.loadButton);
  }
  /** Save and download recording JSON */
  save() {
    VRSpaceAPI.getInstance().endpoint.recorder.save(this.name).then(recording => VRSPACEUI.saveFile(this.name + ".json", JSON.stringify(recording)));
  }
  /** Upload and load recording JSON */
  load() {
    let input = document.createElement("input");
    input.setAttribute('type', 'file');
    input.setAttribute('style', 'display:none');
    input.setAttribute('accept', '.json');
    document.body.appendChild(input);
    input.addEventListener("change", () => {
      for (let i = 0; i < input.files.length; i++) {
        const file = input.files[i];
        console.log("Uploading ", file);
        file.text().then(json => VRSpaceAPI.getInstance().endpoint.recorder.load(this.name, json)).catch(err => {
          console.error("Error reading " + file, err);
        });
      };
      document.body.removeChild(input);
      VRSPACEUI.hud.markDisabled(this.recordButton);
      VRSPACEUI.hud.markEnabled(this.stopButton);
      VRSPACEUI.hud.markActive(this.playButton);
      VRSPACEUI.hud.markDisabled(this.deleteButton);
      VRSPACEUI.hud.markDisabled(this.saveButton);
      VRSPACEUI.hud.markDisabled(this.loadButton);
    }, false);
    input.addEventListener("cancel", () => document.body.removeChild(input), false);
    input.click();
  }
  /** Clear current hud row and display all buttons */
  hide() {
    VRSPACEUI.hud.clearRow();
    VRSPACEUI.hud.showButtons(true);
  }
}