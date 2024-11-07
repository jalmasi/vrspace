import {Form} from './form.js';
import {HorizontalSliderPanel} from './slider-panel.js';

class MixerForm extends Form {
  constructor() {
    super();
    this.smallFontSize = this.fontSize/2;
    this.smallHeightInPixels = this.heightInPixels/2;
  }
  
  init( sounds = {
        avatar: [],
        spatial: [],
        other: []
  }) {
    this.createPanel();
    this.grid = new BABYLON.GUI.Grid();
    this.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.grid.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;

    this.grid.addColumnDefinition(0.5);
    this.grid.addColumnDefinition(0.5);

    this.grid.addRowDefinition(this.heightInPixels, true);
    this.grid.addControl(this.textBlock("Main volume"), 0, 0);
    this.grid.addControl( this.slider(), 0, 1 );

    this.grid.addRowDefinition(this.heightInPixels, true);
    this.grid.addControl(this.textBlock("Avatars"), this.grid.rowCount, 0);
    this.showSounds(sounds.avatar);
    
    this.grid.addRowDefinition(this.heightInPixels, true);
    this.grid.addControl(this.textBlock("Spatial"), this.grid.rowCount, 0);
    this.showSounds(sounds.spatial);

    this.grid.addRowDefinition(this.heightInPixels, true);
    this.grid.addControl(this.textBlock("Other"), this.grid.rowCount, 0);
    this.showSounds(sounds.other);
    
    this.addControl(this.grid);

    // CHECKME: HUD?
    VRSPACEUI.hud.addForm(this,768,this.heightInPixels*(this.grid.rowCount+1));
    //VRSPACEUI.hud.addForm(this,512,512);
  }

  showSounds(list) {
    let fontSize = this.fontSize;
    let heightInPixels = this.heightInPixels;
    this.fontSize = this.smallFontSize;
    this.heightInPixels = this.smallHeightInPixels;
    for ( let row = this.grid.rowCount, i=0; i < list.length; row++, i++ ) {
      this.grid.addRowDefinition(this.heightInPixels, true);
      // CHECKME: sound names?
      this.grid.addControl(this.textBlock(list[i].name), row, 0);
      this.grid.addControl( this.slider(), row, 1 );
    }
    this.fontSize = fontSize;
    this.heightInPixels = heightInPixels;
  }
  
  slider(value=100) {
    let sliderPanel = new HorizontalSliderPanel("",1,100,value);
    sliderPanel.panel.height = "100%";
    sliderPanel.slider.height = "50%";
    sliderPanel.header.height = "50%";
    sliderPanel.header.fontSizeInPixels = this.smallFontSize/2;
    sliderPanel.panel.isVertical = true;
    sliderPanel.setDecimals(0);
    return sliderPanel.panel;
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
    this.form.init(sounds);
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