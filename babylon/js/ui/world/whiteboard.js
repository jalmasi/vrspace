import { ImageArea } from "../widget/image-area.js";
import { ColorPickerPanel } from '../widget/colorpicker-panel.js';
import { SliderPanel } from '../widget/slider-panel.js';

export class Whiteboard extends ImageArea {
  constructor(scene, name="Whiteboard-root") {
    super(scene, name);
    this.backgroundColor = new BABYLON.Color3(1,1,1);
    this.foregroundColor = new BABYLON.Color3(0,0,0);
    this.lineWidth = 1;
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
    this.canvas.fillStyle = this.backgroundColor.toHexString();
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

    this.buttonUndo = new BABYLON.GUI.HolographicButton("undo");
    this.buttonUndo.imageUrl = VRSPACEUI.contentBase+"/content/icons/undo.png";
    VRSPACEUI.guiManager.addControl(this.buttonUndo);
    this.buttonUndo.backMaterial.alpha = this.handles.material.alpha;
    this.buttonUndo.linkToTransformNode(this.handles.box);
    this.buttonUndo.position = new BABYLON.Vector3(10,0,0);
    this.buttonUndo.scaling = new BABYLON.Vector3(2,2,2);
    this.buttonUndo.text = "Undo";
    this.buttonUndo.onPointerDownObservable.add( ()=>{
      this.undo();
    });
    
    this.widthPanel = new SliderPanel(3, "Width", 1,20,1);
    this.widthPanel.plane.parent = this.handles.box;
    this.widthPanel.plane.position = new BABYLON.Vector3(43,0,0);
    this.widthPanel.slider.onValueChangedObservable.add(value=>{
      this.lineWidth=value;
      this.canvas.lineWidth=value;
    });
    
    this.foregroundSelector = new ColorPickerPanel(4,"Foreground",this.foregroundColor);
    this.foregroundSelector.plane.parent = this.handles.box;
    this.foregroundSelector.plane.position = new BABYLON.Vector3(46,0,0);
    this.foregroundSelector.picker.onValueChangedObservable.add( val => {
      this.foregroundColor = val;
      this.canvas.strokeStyle = this.foregroundColor.toHexString();
    });

    this.backgroundSelector = new ColorPickerPanel(4,"Background",this.backgroundColor);
    this.backgroundSelector.plane.parent = this.handles.box;
    this.backgroundSelector.plane.position = new BABYLON.Vector3(50,0,0);
    this.backgroundSelector.picker.onValueChangedObservable.add( val => {
      this.imageData = this.canvas.getImageData(0,0,this.width,this.height);
      this.backgroundColor = val;
      this.canvas.fillStyle = this.backgroundColor.toHexString();
      this.canvas.fillRect(0,0,this.width-1,this.height-1);
      this.texture.update();
    });
    
  }
  
  click(x,y) {
    super.click(x,y);

    this.canvas.save();
    this.imageData = this.canvas.getImageData(0,0,this.width,this.height);
    
    this.canvas.beginPath();
    this.canvas.moveTo(x, y);
    this.scene.activeCamera.detachControl();
  }
  
  pointerDrag(x,y) {
    //console.log("Drag "+x+","+y);
    this.canvas.lineTo(x,y);
    this.canvas.stroke();
    this.texture.update();
  }

  pointerUp() {
    //console.log("unclick");
    this.scene.activeCamera.attachControl();
  }

  undo() {
    this.canvas.restore();
    if ( this.imageData ) {
      this.canvas.putImageData(this.imageData,0,0);
      this.texture.update();
      this.imageData = null; 
    }
  }  
  dispose() {
    this.buttonClose.dispose();
    // TODO other elements
    super.dispose();
  }
  
  close() {
    this.dispose();
  }
}