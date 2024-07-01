import { BasicScript } from "./basic-script.js";
import { ImageArea } from "../ui/widget/image-area.js";

export class SharedFile extends BasicScript {
  async init() {
    this.imageArea = new ImageArea(this.scene, this.vrObject.content.fileName);
    this.imageArea.addHandles = false;
    this.imageArea.position = new BABYLON.Vector3(0, 1, 0); // TODO
    this.imageArea.width = 512;
    this.imageArea.height = 512;
    this.imageArea.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;
    this.imageArea.show();
    this.imageArea.loadUrl('/content/icons/file.png');
    this.imageArea.onClick(() => console.log("TODO Download ", this.vrObject.content));
  }
  
  dispose() {
    if ( this.imageArea ) {
      this.imageArea.dispose();
    }
  }
}