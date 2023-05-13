import { ImageArea } from './image-area.js';

export class RemoteBrowser extends ImageArea {
  async available() {
    let response = await fetch("/webbrowser/available")
    let result = await response.json();
    return "true" === result;
  }
  async get(url) {
    this.url = url;
    let response = await fetch("/webbrowser/get?url="+url);
    let bytes = await response.blob();
    this.loadData(bytes,url);
  }
  async click(x,y) {
    let response = await fetch("/webbrowser/click?x="+x+"&y="+y);
    let bytes = await response.blob();
    this.loadData(bytes);
  }
  async scroll(pixels) {
    let response = await fetch("/webbrowser/scroll?pixels="+pixels);
    let bytes = await response.blob();
    this.loadData(bytes);
  }
  async close() {
    let response = await fetch("/webbrowser/close");
    if ( response.status == 204 ) {
      this.dispose();
    } else {
      let bytes = await response.blob();
      this.loadData(bytes);
    }
  }
  
  show() {
    super.show();
    this.clickHandler = this.scene.onPointerObservable.add((pointerInfo) => {
      if ( pointerInfo.type == BABYLON.PointerEventTypes.POINTERDOWN
        && pointerInfo.pickInfo.hit
        && this.plane == pointerInfo.pickInfo.pickedMesh
      ) {
        let coords = pointerInfo.pickInfo.getTextureCoordinates();
        let y = Math.round(this.height*(1-coords.y));
        let x = Math.round(coords.x*this.width);
        console.log("Clicked: x="+x+" y="+y+" coord "+pointerInfo.pickInfo.getTextureCoordinates() );
        this.click(x,y);
      }
    });
  }
  dispose() {
    super.dispose();
    if ( this.clickHandler) {
      this.scene.onPointerObservable.remove(this.clickHandler);
    }
  }
}