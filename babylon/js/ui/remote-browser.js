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
    let activeElement = response.headers.get('active-element');
    if ( "input" === activeElement || "textarea" === activeElement) {
      console.log("TODO input required: "+activeElement);
    }
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
  async forward() {
    let response = await fetch("/webbrowser/forward");
    let bytes = await response.blob();
    this.loadData(bytes);
  }
  async back() {
    let response = await fetch("/webbrowser/back");
    let bytes = await response.blob();
    this.loadData(bytes);
  }
  
  show() {
    super.show();

    this.buttonBack = new BABYLON.GUI.HolographicButton("back");
    this.buttonBack.imageUrl = VRSPACEUI.contentBase+"/content/icons/back.png";
    VRSPACEUI.guiManager.addControl(this.buttonBack);
    this.buttonBack.linkToTransformNode(this.handles.box);
    this.buttonBack.position = new BABYLON.Vector3(5,0,0);
    this.buttonBack.scaling = new BABYLON.Vector3(2,2,2);
    this.buttonBack.text = "Back";
    this.buttonBack.onPointerDownObservable.add( ()=>this.back() );
    
    this.buttonForward = new BABYLON.GUI.HolographicButton("forward");
    this.buttonForward.imageUrl = VRSPACEUI.contentBase+"/content/icons/forward.png";
    VRSPACEUI.guiManager.addControl(this.buttonForward);
    this.buttonForward.linkToTransformNode(this.handles.box);
    this.buttonForward.position = new BABYLON.Vector3(49,0,0);
    this.buttonForward.scaling = new BABYLON.Vector3(2,2,2);
    this.buttonForward.text = "Forward";
    this.buttonForward.onPointerDownObservable.add( ()=>this.forward() );
    
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
    this.buttonBack.dispose();
    this.buttonForward.dispose();
  }
}