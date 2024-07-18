import { SharedFile } from "./shared-file.js";
import { ImageArea } from "../ui/widget/image-area.js";
import { VRSPACE } from "../client/vrspace.js";

export class SharedImage extends SharedFile {
  init() {
    console.log("Remote image", this.vrObject);

    this.imageArea = new ImageArea(this.scene, this.vrObject.content.fileName);
    this.imageArea.addHandles = this.isMine();
    let pos = this.vrObject.position;
    this.imageArea.position = new BABYLON.Vector3(pos.x, pos.y, pos.z);
    this.imageArea.width = 256;
    this.imageArea.height = 256;

    this.imageArea.show();
    
    let rot = this.vrObject.rotation;
    this.imageArea.group.rotation = new BABYLON.Vector3(rot.x, rot.y, rot.z);

    // CHECKME: Do we want to allow download?
    //this.imageArea.onClick(() => this.download());
    
    let path = "/content/tmp/"+this.vrObject.content.fileName;
    this.imageArea.loadUrl(path);

    if ( this.isMine() ) {
      this.imageArea.handles.positionCallback = (pos, rot) => this.positionChanged(pos, rot);
      this.imageArea.handles.sizeCallback = (scaling) => this.scaleChanged(scaling);
    }
    
    return this.imageArea.group;
  }
  positionChanged(pos, rot) {
    VRSPACE.sendEvent(this.vrObject, {position:{x:pos.x, y:pos.y, z:pos.z}, rotation:{x:rot.x, y:rot.y, z:rot.z}});
  }
  scaleChanged(scaling) {
    VRSPACE.sendEvent(this.vrObject, {scale:{x:scaling.x, y:scaling.y, z:scaling.z}})
  }
  dispose() {
    if ( this.imageArea ) {
      this.imageArea.dispose();
    }
  }

}