import {ScrollablePanel} from "./scrollable-panel.js";

export class TextureSelector {
  constructor( scene ) {
    this.scene = scene;
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
      var imgUrl = this.textures[i];
      //var text = imgUrl.substring(imgUrl.lastIndexOf('/')+1);
      var text = imgUrl.split('/');
      this.texturePanel.addButton(text, imgUrl);
    }
    this.texturePanel.endUpdate(false);
  }
  
  hide() {
    this.texturePanel.dispose();
  }
  
}