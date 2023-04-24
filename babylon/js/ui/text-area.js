export class TextArea {
  constructor(scene) {
    this.scene = scene;
    this.size = .2;
    this.position = new BABYLON.Vector3(-.05, 0, .3);
    this.alpha = 0.7;
    this.maxRows = 27;
    this.maxCols = 58;
    this.fontSize = 16;
    this.width = 512;
    this.height = 512;
    this.textWrapping = true;
    this.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.text = "";
  }
  show () {
    this.group = new BABYLON.TransformNode("TextArea", this.scene);
    this.group.position = this.position;
  
    this.material = new BABYLON.StandardMaterial("TextAreaMaterial", this.scene);
    this.material.alpha = this.alpha;
    this.material.diffuseColor = new BABYLON.Color3(.2,.2,.3);
  
    this.selectedMaterial = new BABYLON.StandardMaterial("selectedMaterial", this.scene);
    this.selectedMaterial.alpha = this.alpha;
    this.selectedMaterial.diffuseColor = new BABYLON.Color3(.2,.5,.2);
  
    this.alertMaterial = new BABYLON.StandardMaterial("alertMaterial", this.scene);
    this.alertMaterial.alpha = this.alpha;
    this.alertMaterial.diffuseColor = new BABYLON.Color3(.3, 0, 0);
  
    this.textAreaPlane = BABYLON.Mesh.CreatePlane("TextAreaPlane", this.size, this.scene);
    this.textAreaPlane.parent = this.group;
  
    this.backgroundPlane = BABYLON.Mesh.CreatePlane("BackgroundPlane", this.size*1.05, this.scene);
    this.backgroundPlane.position = new BABYLON.Vector3(0, 0, this.size/100);
    this.backgroundPlane.parent = this.group;
    this.backgroundPlane.material = this.material;
  
    this.leftHandle = BABYLON.Mesh.CreateSphere("leftHandle");
    this.leftHandle.scaling = new BABYLON.Vector3(this.size/50,this.size,this.size/50);
    this.leftHandle.position = new BABYLON.Vector3(-this.size/2-this.size/20, 0, 0);
    this.leftHandle.parent = this.group;
    this.leftHandle.material = this.material;
  
    this.rightHandle = BABYLON.Mesh.CreateSphere("rightHandle");
    this.rightHandle.scaling = new BABYLON.Vector3(this.size/50,this.size,this.size/50);
    this.rightHandle.position = new BABYLON.Vector3(this.size/2+this.size/20, 0, 0);
    this.rightHandle.parent = this.group;
    this.rightHandle.material = this.material;
  
    this.topHandle = BABYLON.Mesh.CreateSphere("topHandle");
    this.topHandle.scaling = new BABYLON.Vector3(this.size,this.size/50,this.size/50);
    this.topHandle.position = new BABYLON.Vector3(0, this.size/2+this.size/20, 0);
    this.topHandle.parent = this.group;
    this.topHandle.material = this.material;
  
    this.bottomHandle = BABYLON.Mesh.CreateSphere("bottomHandle");
    this.bottomHandle.scaling = new BABYLON.Vector3(this.size,this.size/50,this.size/50);
    this.bottomHandle.position = new BABYLON.Vector3(0, -this.size/2-this.size/20, 0);
    this.bottomHandle.parent = this.group;
    this.bottomHandle.material = this.material;
  
    this.bottomHandle.opposite = this.topHandle;
    this.topHandle.opposite = this.bottomHandle;
    this.leftHandle.opposite = this.rightHandle;
    this.rightHandle.opposite = this.leftHandle;
  
    this.handles = [ this.leftHandle, this.topHandle, this.rightHandle, this.bottomHandle ];
  
    var advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(
      this.textAreaPlane,
      this.width,
      this.height,
      false // mouse events disabled
    );
  
    this.textBlock = new BABYLON.GUI.TextBlock();
    this.textBlock.widthInPixels = this.width;
    this.textBlock.textWrapping = this.textWrapping;
    this.textBlock.color = "white";
    this.textBlock.fontSize = this.fontSize;
    this.textBlock.fontFamily = "monospace";
    this.textBlock.textHorizontalAlignment = this.textHorizontalAlignment;
    this.textBlock.textVerticalAlignment = this.textVerticalAlignment;

    this.textBlock.text = "text is required to compute fontOffset used for font rendering";
    this.textBlock.computeExpectedHeight(); // and now we have textBlock.fontOffset
    this.textBlock.text = this.text;
    
    advancedTexture.addControl(this.textBlock);
  }
  write(string) {
    this.text += string;
    this.textBlock.text = this.text;
  }
  writeln(string) {
    this.write("\n"+string);
  }
  getMaxRows() {
    return Math.floor(this.height/(this.textBlock.fontOffset.height));
  }
  getMaxCols() {
    // font offset on android is not integer
    return Math.floor(this.height/(Math.ceil(this.textBlock.fontOffset.height)/2));
  }
}