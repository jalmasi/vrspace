import {Form} from './form.js';

class MixerForm extends Form {
  init() {
    this.createPanel();
    this.grid = new BABYLON.GUI.Grid();
    this.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.grid.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;

    this.grid.addColumnDefinition(0.3);
    this.grid.addColumnDefinition(0.7);

    this.grid.addRowDefinition(this.heightInPixels, true);
    this.grid.addControl(this.textBlock("Avatar sounds"), 0, 0);
    
    this.grid.addRowDefinition(this.heightInPixels, true);
    this.grid.addControl(this.textBlock("Spatial sounds"), 1, 0);
    
    this.grid.addRowDefinition(this.heightInPixels, true);
    this.grid.addControl(this.textBlock("Other sounds"), 2, 0);

    this.addControl(this.grid);

    // CHECKME: HUD?
    VRSPACEUI.hud.addForm(this,1024,this.heightInPixels*(this.grid.rowCount+1));
    //VRSPACEUI.hud.addForm(this,512,512);
  }
}

/**
 * Sound mixer component.
 */
export class SoundMixer {
  static instance = null;
  
  constructor(scene) {
    if ( SoundMixer.instance ) {
      throw "there can be only one";
    }
    this.scene = scene;
  }
  
  init() {
    this.createPanel();
    
    this.label = this.textBlock(this.nameText);
    this.label.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.panel.addControl(this.label);

    this.input = this.inputText('name');
    this.input.onTextChangedObservable.add(()=>this.changeCallback(this.input.text))
    this.input.onBlurObservable.add(()=>this.blurCallback())
    this.panel.addControl(this.input);

    this.speechInput.addNoMatch((phrases)=>console.log('no match:',phrases));
    this.speechInput.start();
  }

  show() {
    let sounds = {
      avatar: [],
      spatial: [],
      other: []
    };
    this.scene.mainSoundTrack.soundCollection.forEach( sound => {
      if (sound._connectedTransformNode) {
        if ( typeof sound._connectedTransformNode.VRObject != "undefined") {
          // sound stream of an avatar
          console.log("Avatar sound: "+sound.name, sound);
          sounds.avatar.push(sound);
        } else {
          // spatial sound not managed by the server
          console.log("Scene sound: "+sound.name, sound);
          sounds.spatial.push(sound);
        }
      } else {
        // not a spatial sound
        console.log("Other sound: "+sound.name, sound);
        sounds.other.push(sound);
      }
    });
    console.log(sounds);
    if ( this.form ) {
      this.form.dispose();
      this.form = null;
    }
    this.form = new MixerForm();
    this.form.init();   
  }
 
  dispose() {
    if ( this.form ) {
      this.form.dispose();
      this.form = null;
    }
    SoundMixer.instance = null;
  }
  
  static getInstance(scene) {
    if ( ! SoundMixer.instance ) {
      SoundMixer.instance = new SoundMixer(scene);
    }
    return SoundMixer.instance;
  }
}