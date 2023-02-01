import { BasicScript } from "./basic-script.js";
import { Portal } from "../ui/portal.js";
import { ServerFolder } from "../ui/server-folder.js";

export class WebPortal extends BasicScript {
  constructor(world, vrObject) {
    super(world, vrObject);
  }
  async init() {
    var name = this.vrObject.name;
    if ( ! name ) {
      name = "Portal_"+this.vrObject.id;
    }
    var serverFolder = new ServerFolder("/content/worlds", name);
    var portal = new Portal( this.scene, serverFolder, (p)=>this.enterPortal(p));
    console.log("loading portal "+name);
    portal.loadAt(this.vrObject.position.x, this.vrObject.position.y, this.vrObject.position.z, Math.PI/2-this.vrObject.rotation.y);
    if ( this.vrObject.url ) {
      portal.setTitle(this.vrObject.url);
      portal.enabled(true);
    }
    return portal.group;
  }
  enterPortal(portal) {
    console.log("Entering portal "+this.vrObject.url);
  }
}