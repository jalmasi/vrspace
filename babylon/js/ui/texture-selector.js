import {ScrollablePanel} from "./scrollable-panel.js";
import {Form} from './form.js';

class SearchForm extends Form {
  constructor(callback) {
    super();
    this.callback = callback;
    this.fontSize = 48;
    this.heightInPixels = 48;
    this.color = "white";
    this.background = "black";
    this.submitColor = "green";
    this.verticalPanel = false;
  }
  init() {
    this.panel = new BABYLON.GUI.StackPanel();
    this.panel.isVertical = this.verticalPanel;
    this.panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.panel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    this.panel.width = 1;
    this.panel.height = 1;

    this.panel.addControl(this.textBlock("Search textures:"));    

    this.input = this.inputText('search');
    this.panel.addControl(this.input);

    var enter = this.submitButton("submit", () => this.callback(this.input.text));
    this.panel.addControl(enter);
    
    //input.focus(); // not available in babylon 4
    this.speechInput.addNoMatch((phrases)=>console.log('no match:',phrases));
    this.speechInput.start();
  }
  keyboard(input, advancedTexture) {
    var keyboard = BABYLON.GUI.VirtualKeyboard.CreateDefaultLayout('search-keyboard');
    keyboard.fontSizeInPixels = 36;
    keyboard.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    if (this.keyboardRows) {
      this.keyboardRows.forEach(row=>keyboard.addKeysRow(row));
    }
    advancedTexture.addControl(keyboard);
    keyboard.connect(input);
    this.vKeyboard = keyboard;
    return keyboard;
  }
  dispose() {
    if ( this.vKeyboard ) {
      this.vKeyboard.dispose();
      delete this.vKeyboard;
    }
    this.input.dispose();
    delete this.input;
    this.panel.dispose();
    delete this.panel;
    this.speechInput.dispose();
    delete this.speechInput;
  }
}

/**
 * Makes API calls to server to list and search know textures.
 * Displays results in a ScrollablePanel.
 */
export class TextureSelector {
  constructor( scene, callback ) {
    this.scene = scene;
    this.callback = callback;
    this.rows = 4;
    this.index = 0;
    this.textures = null;
  }
  
  doFetch(url) {
      fetch(url).then(response => {
          response.json().then( obj => {
            this.textures = obj;
            this.hide();
            this.makeUI();
          });
      }).catch( err => console.log(err));
  }
  
  makeUI() {
    this.texturePanel = new ScrollablePanel(this.scene, "Textures");
    this.cols = this.texturePanel.panel.columns;
    this.texturePanel.relocatePanel();
    this.showImages();
    this.searchForm();
  }
  show() {
    this.doSearch();
  }
  searchForm() {
    VRSPACEUI.hud.newRow(); // stops speech recognition
    this.form = new SearchForm((text)=>this.doSearch(text));
    this.form.init(); // starts speech recognition
    if ( VRSPACEUI.hud.inXR() ) {
      let texture = VRSPACEUI.hud.addForm(this.form,1024,512);
      this.form.keyboard(this.form.input,texture);
    } else {
      VRSPACEUI.hud.addForm(this.form,1024,64);
    }
  }
  
  clearForm() {
    if ( this.form ) {
      this.form.dispose();
      delete this.form;
    }
  }
  
  doSearch(text) {
    if ( text ) {
      this.doFetch("/textures/search?pattern="+text);
    } else {
      this.doFetch("/textures/list");
    }
  }
  
  previous() {
    if ( this.index > 0 ) {
      this.index -= this.rows*this.cols
    }
    this.showImages();
  }

  next() {
    if ( this.index < this.textures.length-this.rows*this.cols) {
      this.index += this.rows*this.cols;
    }
    this.showImages();
  }

  showImages() {
    this.texturePanel.beginUpdate(
      this.index > 0, 
      this.index <= this.textures.length-this.rows*this.cols, 
      ()=>this.previous(), 
      ()=>this.next()
    );
    for ( var i = this.index; i < this.index+this.cols*this.rows && i < this.textures.length ; i++ ) {
      let imgUrl = this.textures[i];
      let text = imgUrl.split('/');
      this.texturePanel.addButton(text, imgUrl, ()=>this.callback(imgUrl));
    }
    this.texturePanel.endUpdate(false);
  }
  
  hide() {
    this.clearForm();
    if ( this.texturePanel ) {
      this.texturePanel.dispose();
      delete this.texturePanel;
      VRSPACEUI.hud.clearRow();
    }
  }
  
}