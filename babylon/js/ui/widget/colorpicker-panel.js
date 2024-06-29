/**
 * Reusable ColorPicker Panel: creates a Plane, AdvancedTexture, and vertical StackPanel that contains
 * name of the color, and color picker itself. 
 */
export class ColorPickerPanel {
  constructor(size, text="Color",color=new BABYLON.Color3()) {
    this.plane = BABYLON.MeshBuilder.CreatePlane("Plane-Picker:"+text, {width: size, height: size});

    this.advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(this.plane,256,256);
    this.panel = new BABYLON.GUI.StackPanel();
    this.panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.panel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    this.advancedTexture.addControl(this.panel);
    
    this.header = new BABYLON.GUI.TextBlock("Text-Picker:"+text);
    this.header.text = text;
    this.header.height = "30px";
    this.header.color = "white";
    this.panel.addControl(this.header); 

    this.picker = new BABYLON.GUI.ColorPicker("Picker:"+text);
    this.picker.value = color;
    this.picker.height = "150px";
    this.picker.width = "150px";
    this.picker.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;

    this.panel.addControl(this.picker);
  }
  
  dispose() {
    this.panel.dispose();
    this.header.dispose();
    this.picker.dispose();
    this.advancedTexture.dispose();
  }
}