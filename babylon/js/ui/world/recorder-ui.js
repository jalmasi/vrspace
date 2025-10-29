import { VRSPACE } from '../../client/vrspace.js';
import { VRSPACEUI } from '../vrspace-ui.js';

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
  /** Shows the UI */
  showUI() {
    this.recordButton = VRSPACEUI.hud.addButton("REC", this.contentBase + "/content/icons/dot.png", () => this.record(), false);
    VRSPACEUI.hud.markEnabled(this.recordButton);

    this.stopButton = VRSPACEUI.hud.addButton("Stop", this.contentBase + "/content/icons/pause.png", () => this.stop(), false);
    VRSPACEUI.hud.markDisabled(this.stopButton);

    this.playButton = VRSPACEUI.hud.addButton("Play", this.contentBase + "/content/icons/play.png", () => this.play(), false);
    VRSPACEUI.hud.markDisabled(this.playButton);
    
    this.deleteButton = VRSPACEUI.hud.addButton("Delete", this.contentBase + "/content/icons/delete.png", () => this.delete(), false);
    VRSPACEUI.hud.markDisabled(this.deleteButton);
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
  }
  /** Stop recording */
  stop() {
    console.log('Stopped');
    VRSPACE.send('{"command":{"Recording":{"action":"stop", "name":"' + this.name + '"}}}');
    VRSPACEUI.hud.markEnabled(this.recordButton);
    VRSPACEUI.hud.markDisabled(this.stopButton);
    VRSPACEUI.hud.markEnabled(this.playButton);
    VRSPACEUI.hud.markEnabled(this.deleteButton);
  }
  /** Start playing */
  play() {
    console.log('Playing...');
    VRSPACE.send('{"command":{"Recording":{"action":"play", "name":"' + this.name + '"}}}');
    VRSPACEUI.hud.markDisabled(this.recordButton);
    VRSPACEUI.hud.markEnabled(this.stopButton);
    VRSPACEUI.hud.markActive(this.playButton);
    VRSPACEUI.hud.markDisabled(this.deleteButton);
  }
  delete() {
    console.log('Deleted');
    VRSPACE.send('{"command":{"Recording":{"action":"delete", "name":"' + this.name + '"}}}');
    VRSPACEUI.hud.markEnabled(this.recordButton);
    VRSPACEUI.hud.markDisabled(this.stopButton);
    VRSPACEUI.hud.markDisabled(this.playButton);
    VRSPACEUI.hud.markDisabled(this.deleteButton);   
  }

}