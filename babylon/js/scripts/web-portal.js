import { BasicScript } from "./basic-script.js";
import { Portal } from "../ui/world/portal.js";
import { ServerFolder } from "../core/server-folder.js";

export class WebPortal extends BasicScript {
  constructor(world, vrObject) {
    super(world, vrObject);
  }
  async init() {
    var name = this.vrObject.description;
    if (!name) {
      name = "Portal_" + this.vrObject.id;
    }
    var serverFolder = new ServerFolder("/content/worlds", name, this.vrObject.thumbnail);
    var portal = new Portal(this.scene, serverFolder, (p) => this.enterPortal(p));
    portal.alwaysShowTitle = true;
    console.log("loading portal " + name);
    portal.loadAt(this.vrObject.position.x, this.vrObject.position.y, this.vrObject.position.z, Math.PI / 2 - this.vrObject.rotation.y).then(()=>{} );
    if (this.vrObject.url) {
      portal.setTitle(this.vrObject.url);
      portal.enabled(this.vrObject.available);
    }
    return portal.group;
  }
  enterPortal(portal) {
    if (this.vrObject.available) {
      var avatarUrl = this.VRSPACE.me.mesh;
      if (avatarUrl.startsWith('/')) {
        if (window.location.hostname != 'localhost') {
          avatarUrl = window.location.protocol + "//" + window.location.hostname + avatarUrl;
        }
      }
      console.log("Entering portal " + this.vrObject.url + " as " + avatarUrl);
      window.open(this.vrObject.url + "?avatarUrl=" + avatarUrl, "_self");
    }
  }
}