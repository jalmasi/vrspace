import { VRSPACEUI } from "../vrspace-ui.js";

class SliderPanel {
  constructor(text,min,max,value,vertical) {
    /** Number of decimals, that value is rounded to, default 2 */
    this.decimals = 2;
    /** Current slider value, rounded */
    this.value = value;
    this.text = text;
    
    this.panel = new BABYLON.GUI.StackPanel();
    this.panel.isVertical = vertical;
    this.panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.panel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;

    this.header = new BABYLON.GUI.TextBlock("Text-Slider:"+text);
    this.header.width = ((text.length+(""+max).length)*this.header.fontSizeInPixels)+"px";
    this.header.color = "white";
    this.showValue(value);
    this.panel.addControl(this.header); 

    this.slider = new BABYLON.GUI.Slider("Slider:"+text);
    this.slider.isVertical = vertical;
    this.slider.minimum = min;
    this.slider.maximum = max;
    this.slider.value = value;
    this.slider.onValueChangedObservable.add(value => this.showValue(value));
    this.panel.addControl(this.slider);
  }

  showValue(value) {
    this.value = value.toFixed(this.decimals);
    if ( this.text ) {
      this.header.text = this.text+": "+this.value;
    } else {
      this.header.text = this.value;
    }
  }

  setDecimals(decimals) {
    this.decimals = decimals;
    this.showValue(this.slider.value);
  }

  dispose() {
    this.panel.dispose();
    this.header.dispose();
    this.slider.dispose();
    if ( this.advancedTexture ) {
      this.advancedTexture.dispose();
    }
  }

  createPlane(size,width=256,height=256) {
    this.plane = BABYLON.MeshBuilder.CreatePlane("Plane-Slider:"+this.text, {width: size, height: size});
    this.plane.isNearPickable = VRSPACEUI.allowHands;
    this.advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(this.plane,width,height);
    this.advancedTexture.addControl(this.panel);
    return this.plane;
  }  
}

/**
 * Reusable SliderPicker Panel: creates a vertical StackPanel that contains
 * name of the slider, and the Slider. 
 */
export class VerticalSliderPanel extends SliderPanel {
  constructor(text="Value",min=0,max=100,value=0) {
    super(text,min,max,value,true);
    this.header.height = "30px";
    this.slider.height = "220px";
    this.slider.width = "20px";
  }
}

/**
 * Reusable SliderPicker Panel: creates a horizontal StackPanel that contains
 * name of the slider, and the Slider. 
 */
export class HorizontalSliderPanel extends SliderPanel {
  constructor(text="Value",min=0,max=100,value=0) {
    super(text,min,max,value,false);
    this.panel.height = "40px";
    this.header.width = ((text.length+(""+max).length)*this.header.fontSizeInPixels)+"px";
    this.slider.width = "220px";
    this.slider.height = this.header.fontSizeInPixels + "px";
  }
}

/**
 * Reusable SliderPicker Panel: creates a Plane, AdvancedTexture, and vertical StackPanel that contains
 * name of the slider, and the Slider. 
 */
export class VerticalSliderPlane extends VerticalSliderPanel {
  constructor(size,text="Value",min=0,max=100,value=0) {
    super(text,min,max,value,true);
    this.createPlane(size);
  }
}

/**
 * Reusable SliderPicker Panel: creates a Plane, AdvancedTexture, and horizontal StackPanel that contains
 * name of the slider, and the Slider. 
 */
export class HorizontalSliderPlane extends HorizontalSliderPanel {
  constructor(size,text="Value",min=0,max=100,value=0) {
    super(text,min,max,value,false);
    this.createPlane(size);
  }
}