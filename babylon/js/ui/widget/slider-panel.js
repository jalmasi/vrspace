/**
 * Reusable SliderPicker Panel: creates a Plane, AdvancedTexture, and vertical StackPanel that contains
 * name of the slider, and the Slider. 
 */
export class SliderPanel {
  constructor(size,text="Value",min=0,max=100,value=0) {
    this.plane = BABYLON.MeshBuilder.CreatePlane("Plane-Slider:"+text, {width: size, height: size});

    this.advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(this.plane,256,256);

    this.panel = new BABYLON.GUI.StackPanel();
    this.panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.panel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    this.advancedTexture.addControl(this.panel);

    this.header = new BABYLON.GUI.TextBlock("Text-Slider:"+text);
    this.header.text = text+": "+value;
    this.header.height = "30px";
    this.header.color = "white";
    this.panel.addControl(this.header); 

    this.slider = new BABYLON.GUI.Slider("Slider:"+text);
    this.slider.minimum = min;
    this.slider.maximum = max;
    this.slider.value = value;
    this.slider.isVertical = true;
    this.slider.height = "220px";
    this.slider.width = "20px";
    this.slider.onValueChangedObservable.add((value) =>{
        this.header.text = text+": "+value;
    });
    this.panel.addControl(this.slider);

  }
  dispose() {
    this.panel.dispose();
    this.header.dispose();
    this.slider.dispose();
    this.advancedTexture.dispose();
  }
}