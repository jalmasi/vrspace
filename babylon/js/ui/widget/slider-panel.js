/**
 * Base class for vertical and horizontal slider panel
 */
class SliderPanel {
  constructor(size,text,min,max,value,vertical) {
    /** Number of decimals, that value is rounded to, default 2 */
    this.decimals = 2;
    /** Current slider value, rounded */
    this.value = value;
    
    this.plane = BABYLON.MeshBuilder.CreatePlane("Plane-Slider:"+text, {width: size, height: size});

    this.advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(this.plane,256,256);

    this.panel = new BABYLON.GUI.StackPanel();
    this.panel.isVertical = vertical;
    this.panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.panel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    this.advancedTexture.addControl(this.panel);

    this.header = new BABYLON.GUI.TextBlock("Text-Slider:"+text);
    this.header.text = text+": "+value;
    this.header.width = ((text.length+(""+max).length)*this.header.fontSizeInPixels)+"px";
    this.header.color = "white";
    this.panel.addControl(this.header); 

    this.slider = new BABYLON.GUI.Slider("Slider:"+text);
    this.slider.isVertical = vertical;
    this.slider.minimum = min;
    this.slider.maximum = max;
    this.slider.value = value;
    this.slider.onValueChangedObservable.add((value) =>{
        this.value = value.toFixed(this.decimals);
        this.header.text = text+": "+this.value;
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

/**
 * Reusable SliderPicker Panel: creates a Plane, AdvancedTexture, and vertical StackPanel that contains
 * name of the slider, and the Slider. 
 */
export class VerticalSliderPanel extends SliderPanel {
  constructor(size,text="Value",min=0,max=100,value=0) {
    super(size,text,min,max,value,true);

    this.header.height = "30px";

    this.slider.height = "220px";
    this.slider.width = "20px";

  }
}

/**
 * Reusable SliderPicker Panel: creates a Plane, AdvancedTexture, and horizontal StackPanel that contains
 * name of the slider, and the Slider. 
 */
export class HorizontalSliderPanel extends SliderPanel {
  constructor(size,text="Value",min=0,max=100,value=0) {
    super(size,text,min,max,value,false);
    
    this.panel.height = "40px";

    this.header.width = ((text.length+(""+max).length)*this.header.fontSizeInPixels)+"px";

    this.slider.width = "220px";
    this.slider.height = this.header.fontSizeInPixels + "px";
  }
  
  dispose() {
    this.panel.dispose();
    this.header.dispose();
    this.slider.dispose();
    this.advancedTexture.dispose();
  }
}