import {ScrollablePanel} from "./scrollable-panel.js";
import {Form} from '../widget/form.js';

class SearchForm extends Form {
  constructor(callback) {
    super();
    this.callback = callback;
  }
  init() {
    this.createPanel();
    this.panel.addControl(this.textBlock("Search textures:"));

    this.input = this.inputText('search');
    this.panel.addControl(this.input);

    var enter = this.submitButton("submit", () => this.callback(this.input.text));
    this.panel.addControl(enter);
    
    //input.focus(); // not available in babylon 4
    this.speechInput.start();
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
  endpoint() {
    return VRSPACEUI.contentBase+"/vrspace/api/textures";
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
      this.form.keyboard(texture);
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
      this.doFetch(this.endpoint()+"/search?pattern="+text);
    } else {
      this.doFetch(this.endpoint()+"/list");
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