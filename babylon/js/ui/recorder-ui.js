import {VRSPACE} from '../client/vrspace.js';

/**
Event Recorder is server-side component.
This UI sends commands to the server that control recording and playback.
UI buttons (record, stop, play) are bound to current camera.
*/
export class RecorderUI {
  /** @param scene babylonjs scene */
  constructor( scene ) {
    // parameters
    this.scene = scene;
    this.recorder = null;
    // state variables
    scene.onActiveCameraChanged.add( (s) => this.cameraChanged() );
  }
  cameraChanged() {
    console.log("Camera changed: "+this.scene.activeCamera.getClassName()+" new position "+this.scene.activeCamera.position);
    this.camera = this.scene.activeCamera;
    this.recordButton.mesh.parent = this.camera;
    this.stopButton.mesh.parent = this.camera;
    this.playButton.mesh.parent = this.camera;
  }
  /** Shows the UI */
  showUI() {
    this.camera = this.scene.activeCamera;

    var manager = new BABYLON.GUI.GUI3DManager(this.scene);

    this.recordButton = new BABYLON.GUI.HolographicButton("RecordEvents");
    manager.addControl(this.recordButton);
    this.recordButton.imageUrl = "//www.babylonjs-playground.com/textures/icons/Dot.png"; // FIXME: cdn
    this.recordButton.text="REC";
    this.recordButton.position = new BABYLON.Vector3(-0.1,-0.1,.5);
    this.recordButton.scaling = new BABYLON.Vector3( .05, .05, .05 );
    this.recordButton.onPointerDownObservable.add( () => this.record());
    this.recordButton.mesh.parent = this.camera;
    
    this.stopButton = new BABYLON.GUI.HolographicButton("StopRecording");
    this.stopButton.imageUrl = "//www.babylonjs-playground.com/textures/icons/Pause.png"; // FIXME: cdn
    this.stopButton.text="Stop";
    manager.addControl(this.stopButton);
    this.stopButton.position = new BABYLON.Vector3(0,-0.1,.5);
    this.stopButton.scaling = new BABYLON.Vector3( .05, .05, .05 );
    this.stopButton.onPointerDownObservable.add( () => this.stop());
    this.stopButton.mesh.parent = this.camera;
    this.stopButton.isVisible = false;

    this.playButton = new BABYLON.GUI.HolographicButton("StartPlaying");
    this.playButton.imageUrl = "//www.babylonjs-playground.com/textures/icons/Play.png"; // FIXME: cdn
    manager.addControl(this.playButton);
    this.playButton.text="Play";
    this.playButton.position = new BABYLON.Vector3(0.1,-0.1,.5);
    this.playButton.scaling = new BABYLON.Vector3( .05, .05, .05 );
    this.playButton.onPointerDownObservable.add( () => this.play());
    this.playButton.mesh.parent = this.camera;
    this.playButton.isVisible = false;
  }
  
  /** Start recording */
  record() {
    console.log("Recording...");
    if ( ! this.recorder ) {
      // create recorder on the server
      VRSPACE.send('{"command":{"Recording":{"action":"record"}}}');
    }
    this.stopButton.isVisible = true;
    this.playButton.isVisible = false;
  }
  /** Stop recording */
  stop() {
    console.log('Stopped');
    VRSPACE.send('{"command":{"Recording":{"action":"stop"}}}');
    this.recordButton.isVisible = true;
    this.playButton.isVisible = true;
    this.stopButton.isVisible = false;
  }
  /** Start playing */
  play() {
    console.log('Playing...');
    VRSPACE.send('{"command":{"Recording":{"action":"play"}}}');
    this.recordButton.isVisible = false;
    this.stopButton.isVisible = true;
  }
  
}