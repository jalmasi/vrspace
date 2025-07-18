import { SharedFile } from "./shared-file.js";
import { ImageArea } from "../ui/widget/image-area.js";

export class SharedVideo extends SharedFile {
  async init() {
    console.log("Remote video", this.vrObject);

    this.imageArea = new ImageArea(this.scene, this.vrObject.content.fileName);
    this.imageArea.addHandles = this.isMine();
    this.imageArea.canClose = this.isMine();
    this.imageArea.onClose = () => this.unpublish();
    let pos = this.vrObject.position;
    this.imageArea.position = new BABYLON.Vector3(pos.x, pos.y, pos.z);
    this.imageArea.width = 256;
    this.imageArea.height = 256;

    this.imageArea.show();
    
    let rot = this.vrObject.rotation;
    this.imageArea.group.rotation = new BABYLON.Vector3(rot.x, rot.y, rot.z);

    // CHECKME: Do we want to allow download?
    this.imageArea.onClick(() => this.download());
    
    let path = "/content/tmp/"+this.vrObject.content.fileName;
    this.imageArea.loadVideo(path);

    if ( this.isMine() ) {
      this.imageArea.handles.positionCallback = (pos, rot) => this.positionChanged(pos, rot);
      this.imageArea.handles.sizeCallback = (scaling) => this.scaleChanged(scaling);
    }
    
    return this.imageArea.group;
  }
  
}