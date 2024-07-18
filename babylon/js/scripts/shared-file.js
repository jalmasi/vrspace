import { BasicScript } from "./basic-script.js";
import { ImageArea } from "../ui/widget/image-area.js";
import { Label } from "../ui/widget/label.js";

export class SharedFile extends BasicScript {
  init() {
    this.imageArea = new ImageArea(this.scene, this.vrObject.content.fileName);
    this.imageArea.addHandles = false;
    let pos = this.vrObject.position;
    this.imageArea.position = new BABYLON.Vector3(pos.x, pos.y, pos.z);
    this.imageArea.width = 256;
    this.imageArea.height = 256;
    this.imageArea.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;
    this.imageArea.show();
    this.imageArea.areaPlane.rotation = new BABYLON.Vector3(0,Math.PI,0);
    this.imageArea.loadUrl('/content/icons/file.png');
    this.imageArea.onClick(() => this.download());
    
    this.label = new Label(this.vrObject.content.fileName, new BABYLON.Vector3(0, .2, 0), this.imageArea.group);
    this.label.height = 0.1;
    this.label.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER
    this.label.display();
    
    return this.imageArea.group;
  }
  
  dispose() {
    if ( this.imageArea ) {
      this.imageArea.dispose();
      this.label.dispose();
    }
  }
  
  download() {
    console.log("Downloading ", this.vrObject.content);
    let path = "/content/tmp/"+this.vrObject.content.fileName;
    // https://stackoverflow.com/questions/32545632/how-can-i-download-a-file-using-window-fetch
    fetch(path).then(res=>{
      return res.blob();
    }).then(blob=>{
      const href = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), {
        href,
        style: "display:none",
        download: this.vrObject.content.fileName
      });
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(href);
      a.remove();
    });
  }
}