import { ImageArea } from "../widget/image-area.js";

export class Whiteboard extends ImageArea {
  constructor(scene, name="Whiteboard-root") {
    super(scene, name);
    this.background = new BABYLON.Color3(1,1,1);
    this.foreground = new BABYLON.Color3(0,0,0);
  }
  
  show() {
    super.show();
    this.ui();

    this.texturesDispose();
    //new DynamicTexture(name, options, scene?, generateMipMaps?, samplingMode?, format?, invertY?)
    this.texture = new BABYLON.DynamicTexture(
      "Whiteboard", 
      {width: this.width, height: this.height}, 
      this.scene, 
      false, 
      BABYLON.Texture.TRILINEAR_SAMPLINGMODE, 
      BABYLON.Engine.TEXTUREFORMAT_RGBA, 
      false
    );
    this.material.diffuseTexture = this.texture;
    
    this.fullyVisible();
    
    this.canvas = this.texture.getContext();
    this.canvas.fillStyle = this.background.toHexString();
    this.canvas.fillRect(0,0,this.width-1,this.height-1);
    this.texture.update();
    
  }
  
  ui() {
    this.buttonClose = new BABYLON.GUI.HolographicButton("close");
    this.buttonClose.imageUrl = VRSPACEUI.contentBase+"/content/icons/close.png";
    VRSPACEUI.guiManager.addControl(this.buttonClose);
    this.buttonClose.backMaterial.alpha = this.handles.material.alpha;
    this.buttonClose.linkToTransformNode(this.handles.box);
    this.buttonClose.position = new BABYLON.Vector3(5,0,0);
    this.buttonClose.scaling = new BABYLON.Vector3(2,2,2);
    this.buttonClose.text = "Close";
    this.buttonClose.onPointerDownObservable.add( ()=>this.close() );
    this.buttonClose.isVisible = true;
  }

  click(x,y) {
    super.click(x,y);
  }
  
  pointerUp() {
    console.log("unclick");
  }
  
  pointerDrag(x,y) {
    console.log("Drag "+x+","+y);
  }

  dispose() {
    this.buttonClose.dispose();
    super.dispose();
  }
  
  close() {
    this.dispose();
  }
}