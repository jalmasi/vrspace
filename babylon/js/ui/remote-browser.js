import { ImageArea } from './image-area.js';
import { InputForm } from './input-form.js';
import { VRSPACEUI } from './vrspace-ui.js';

export class RemoteBrowser extends ImageArea {
  constructor(scene) {
    super(scene);
    this.size = .3;
    this.position = new BABYLON.Vector3(0, .15, -0.05);
    this.depth = 0;
    this.maxDepth = 0;
    this.inputForm = new InputForm("Enter");
  }
  endpoint() {
    return VRSPACEUI.contentBase+"/vrspace/api/webbrowser"
  }
  async available() {
    let response = await fetch(this.endpoint()+"/available")
    let result = await response.json();
    return "true" === result;
  }
  async get(url) {
    this.url = url;
    let response = await fetch(this.endpoint()+"/get?url="+url);
    let bytes = await response.blob();
    this.loadData(bytes,url);
    this.processHeaders(response.headers);
  }
  async click(x,y) {
    let response = await fetch(this.endpoint()+"/click?x="+x+"&y="+y);
    let bytes = await response.blob();
    let activeElement = response.headers.get('active-element');
    if ( "input" === activeElement || "textarea" === activeElement) {
      console.log("TODO input required: "+activeElement);
      this.inputForm.setEnabled(true);
    }
    this.loadData(bytes);
    this.processHeaders(response.headers);
  }
  async enter(text) {
    this.inputForm.setEnabled(false);
    let response = await fetch(this.endpoint()+"/enter?text="+text);
    let bytes = await response.blob();
    this.loadData(bytes);
  }
  async scroll(pixels) {
    let response = await fetch(this.endpoint()+"/scroll?pixels="+pixels);
    let bytes = await response.blob();
    this.loadData(bytes);
  }
  async close() {
    let response = await fetch(this.endpoint()+"/close");
    if ( response.status == 204 ) {
      this.dispose();
    } else {
      let bytes = await response.blob();
      this.loadData(bytes);
      this.processHeaders(response.headers);
    }
  }
  async forward() {
    let response = await fetch(this.endpoint()+"/forward");
    let bytes = await response.blob();
    this.loadData(bytes);
    this.processHeaders(response.headers);
  }
  async back() {
    let response = await fetch(this.endpoint()+"/back");
    if ( response.status == 204 ) {
      this.dispose();
    } else {
      let bytes = await response.blob();
      this.loadData(bytes);
      this.processHeaders(response.headers);
    }
  }
  async quit() {
    await fetch(this.endpoint()+"/quit");
    this.dispose();
  }
  processHeaders(headers) {
    let depth = headers.get("history-position");
    let maxDepth = headers.get("history-length");
    let windows = headers.get("browser-windows");
    if ( depth && maxDepth ) {
      console.log("Depth: "+depth+" max "+maxDepth+" clicked "+headers.get("clicked-element")+" active "+headers.get("active-element")+" windows "+windows);
      this.depth = depth;
      this.maxDepth = maxDepth;
      this.buttonForward.isVisible = depth < maxDepth;
    }
    this.buttonBack.isVisible = (depth != 0);
    this.buttonClose.text = "Close:"+windows;
  }
  show() {
    super.show();

    this.buttonClose = new BABYLON.GUI.HolographicButton("close");
    this.buttonClose.imageUrl = VRSPACEUI.contentBase+"/content/icons/close.png";
    VRSPACEUI.guiManager.addControl(this.buttonClose);
    this.buttonClose.linkToTransformNode(this.handles.box);
    this.buttonClose.position = new BABYLON.Vector3(5,0,0);
    this.buttonClose.scaling = new BABYLON.Vector3(2,2,2);
    this.buttonClose.text = "Close";
    this.buttonClose.onPointerDownObservable.add( ()=>this.close() );
    this.buttonClose.isVisible = true;
    
    this.buttonBack = new BABYLON.GUI.HolographicButton("back");
    this.buttonBack.imageUrl = VRSPACEUI.contentBase+"/content/icons/back.png";
    VRSPACEUI.guiManager.addControl(this.buttonBack);
    this.buttonBack.linkToTransformNode(this.handles.box);
    this.buttonBack.position = new BABYLON.Vector3(8,0,0);
    this.buttonBack.scaling = new BABYLON.Vector3(2,2,2);
    this.buttonBack.text = "Back";
    this.buttonBack.onPointerDownObservable.add( ()=>this.back() );
    this.buttonBack.isVisible = false;
    
    this.buttonForward = new BABYLON.GUI.HolographicButton("forward");
    this.buttonForward.imageUrl = VRSPACEUI.contentBase+"/content/icons/forward.png";
    VRSPACEUI.guiManager.addControl(this.buttonForward);
    this.buttonForward.linkToTransformNode(this.handles.box);
    this.buttonForward.position = new BABYLON.Vector3(46,0,0);
    this.buttonForward.scaling = new BABYLON.Vector3(2,2,2);
    this.buttonForward.text = "Forward";
    this.buttonForward.onPointerDownObservable.add( ()=>this.forward() );
    this.buttonForward.isVisible = false;

    this.buttonQuit = new BABYLON.GUI.HolographicButton("quit");
    this.buttonQuit.imageUrl = VRSPACEUI.contentBase+"/content/icons/delete.png";
    VRSPACEUI.guiManager.addControl(this.buttonQuit);
    this.buttonQuit.linkToTransformNode(this.handles.box);
    this.buttonQuit.position = new BABYLON.Vector3(55,0,0);
    //this.buttonQuit.scaling = new BABYLON.Vector3(2,2,2);
    this.buttonQuit.text = "Quit";
    this.buttonQuit.onPointerDownObservable.add( ()=>this.quit() );
    
    this.inputForm.size = .1;
    let formPlane = this.inputForm.init();
    formPlane.parent = this.group;
    formPlane.position = new BABYLON.Vector3(0,-0.12,-.05);
    formPlane.setEnabled(false);
    this.inputForm.addListener(text=>this.enter(text));
    
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
    this.inputForm.dispose();
    this.buttonBack.dispose();
    this.buttonForward.dispose();
    this.buttonQuit.dispose();
  }
}