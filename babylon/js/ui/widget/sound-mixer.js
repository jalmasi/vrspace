import {Form} from './form.js';
import {HorizontalSliderPanel} from './slider-panel.js';
import { MediaStreams } from '../../core/media-streams.js';

class MixerForm extends Form {
  constructor(scene) {
    super();
    this.scene = scene;
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

    this.grid.paddingLeft=10;
    this.grid.paddingTop=10;
    this.grid.addColumnDefinition(0.5);
    this.grid.addColumnDefinition(0.5);

    this.grid.addRowDefinition(this.heightInPixels, true);
    this.grid.addControl(this.textBlock("Main volume"), 0, 0);
    this.grid.addControl( this.slider(volume=>this.scene.mainSoundTrack.setVolume(volume/100),this.scene.mainSoundTrack._outputAudioNode.gain.value*100,this.fontSize*0.7), 0, 1 );

    this.grid.addRowDefinition(this.heightInPixels, true);
    this.grid.addControl(this.textBlock("Avatars"), this.grid.rowCount, 0);
    let distanceSlider = new HorizontalSliderPanel("Range",10,1000,MediaStreams.soundProperties.maxDistance);
    distanceSlider.panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    distanceSlider.header.width = "110px";
    distanceSlider.setDecimals(0);
    distanceSlider.slider.onValueChangedObservable.add(value=>MediaStreams.soundProperties.maxDistance=value);
    this.grid.addControl( distanceSlider.panel, 1, 1 );
    this.showSounds(sounds.avatar);
    
    this.grid.addRowDefinition(this.heightInPixels, true);
    this.grid.addControl(this.textBlock("Spatial"), this.grid.rowCount, 0);
    this.showSounds(sounds.spatial);

    this.grid.addRowDefinition(this.heightInPixels, true);
    this.grid.addControl(this.textBlock("Other"), this.grid.rowCount, 0);
    this.showSounds(sounds.other);
    
    this.addControl(this.grid);

    // CHECKME: HUD?
    let texture = VRSPACEUI.hud.addForm(this,768,this.heightInPixels*4+this.smallHeightInPixels*(Math.max(this.grid.rowCount-3,1)));
    texture.background="#808080";
    //VRSPACEUI.hud.addForm(this,512,512);
  }

  showSounds(list) {
    let fontSize = this.fontSize;
    let heightInPixels = this.heightInPixels;
    this.fontSize = this.smallFontSize;
    this.heightInPixels = this.smallHeightInPixels;
    for ( let row = this.grid.rowCount, i=0; i < list.length; row++, i++ ) {
      let sound = list[i];
      this.grid.addRowDefinition(this.heightInPixels, true);
      // CHECKME: sound names?
      this.grid.addControl(this.textBlock(sound.name), row, 0);
      this.grid.addControl( this.slider(value=>sound.setVolume(value/100), sound.getVolume()*100), row, 1 );
    }
    this.fontSize = fontSize;
    this.heightInPixels = heightInPixels;
  }
  
  slider(callback, value=100, fontSize=this.smallFontSize/2) {
    let sliderPanel = new HorizontalSliderPanel("",1,100,value);
    sliderPanel.panel.height = "100%";
    sliderPanel.slider.height = "50%";
    sliderPanel.header.height = "50%";
    sliderPanel.header.fontSizeInPixels = fontSize;
    //sliderPanel.panel.isVertical = true;
    sliderPanel.setDecimals(0);
    sliderPanel.slider.onValueChangedObservable.add(value=>callback(value));
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
    this.sounds = {
      avatar: [],
      spatial: [],
      other: []
    };
    this.scene.mainSoundTrack.soundCollection.forEach( sound => {
      if (sound._connectedTransformNode) {
        if ( typeof sound._connectedTransformNode.VRObject != "undefined") {
          // sound stream of an avatar
          console.log("Avatar sound: "+sound.name, sound);
          this.sounds.avatar.push(sound);
        } else {
          // spatial sound not managed by the server
          console.log("Scene sound: "+sound.name, sound);
          this.sounds.spatial.push(sound);
        }
      } else {
        // not a spatial sound
        console.log("Other sound: "+sound.name, sound);
        this.sounds.other.push(sound);
      }
    });
    console.log(this.sounds);
  }

  show() {
    if ( this.form ) {
      this.form.dispose();
      this.form = null;
    }
    this.init();
    this.form = new MixerForm(this.scene);
    this.form.init(this.sounds);
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