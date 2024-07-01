import { BasicScript } from "./basic-script.js";
import { ImageArea } from "../ui/widget/image-area.js";
import { Label } from "../ui/widget/label.js";

export class SharedFile extends BasicScript {
  async init() {
    this.imageArea = new ImageArea(this.scene, this.vrObject.content.fileName);
    this.imageArea.addHandles = false;
    let pos = this.vrObject.position;
    this.imageArea.position = new BABYLON.Vector3(pos.x, pos.y, pos.z); // TODO move it in front of avatar
    this.imageArea.width = 256;
    this.imageArea.height = 256;
    this.imageArea.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;
    this.imageArea.show();
    this.imageArea.areaPlane.rotation = new BABYLON.Vector3(0,Math.PI,0);
    this.imageArea.loadUrl('/content/icons/file.png');
    this.imageArea.onClick(() => console.log("TODO Download ", this.vrObject.content));
    
    this.label = new Label(this.vrObject.content.fileName, new BABYLON.Vector3(0, .2, 0), this.imageArea.group);
    this.label.height = 0.1;
    this.label.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER
    this.label.display();
  }
  
  dispose() {
    if ( this.imageArea ) {
      this.imageArea.dispose();
      this.label.dispose();
    }
  }
}