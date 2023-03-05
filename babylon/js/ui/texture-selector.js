import {ScrollablePanel} from "./scrollable-panel.js";

export class TextureSelector {
  constructor( scene, callback ) {
    this.scene = scene;
    this.callback = callback;
    this.rows = 4;
    this.index = 0;
    this.doFetch("/textures/list");
  }
  
  doFetch(url) {
      fetch(url).then(response => {
          response.json().then( obj => this.textures = obj);
      }).catch( err => console.log(err));
  }
  
  show() {
    this.texturePanel = new ScrollablePanel(this.scene, "Textures");
    this.cols = this.texturePanel.panel.columns;
    this.texturePanel.relocatePanel();
    this.showImages();
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
    this.texturePanel.dispose();
  }
  
}