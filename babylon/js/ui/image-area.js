import { ManipulationHandles } from "./manipulation-handles.js";

/**
 * An area somewhere in space, like a screen, displaying a texture.
 */
export class ImageArea {
  /**
   * Creates the area with default values. 
   * By default, it's sized and positioned to be attached to the camera, and includes manipulation handles
   */
  constructor(scene) {
    this.scene = scene;
    this.size = .2;
    this.position = new BABYLON.Vector3(0, 0, .3);
    this.addHandles = true;
    this.canMinimize = true;
    this.width = 2048;
    this.height = 1024;
    this.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.text = "";
    this.group = new BABYLON.TransformNode("ImageArea-root", this.scene);
    this.attachedToHud = false;
    this.attachedToCamera = false;
    this.visible = false;
    this.texture = null;
    this.noiseTexture = null;
  }
  
  show () {
    if ( this.visible ) {
      return;
    }
    this.visible = true;
    this.group.position = this.position;
    this.ratio = this.width/this.height;

    this.material = new BABYLON.StandardMaterial("ImageMaterial", this.scene);
    this.material.emissiveColor = new BABYLON.Color3(0,1,0);
    this.material.disableLighting = true;
    this.material.backFaceCulling = false;
    this.noiseTexture = new BABYLON.NoiseProceduralTexture(this.name+"-perlin", 256, this.scene);
    this.material.diffuseTexture = this.noiseTexture;
    this.noiseTexture.octaves = 10;
    this.noiseTexture.persistence = 1.5;
    this.noiseTexture.animationSpeedFactor = 3;

    this.plane = BABYLON.MeshBuilder.CreatePlane("ImageAreaPlane", {width:this.size*this.ratio,height:this.size}, this.scene);
    this.plane.parent = this.group;
    this.plane.material = this.material;
    this.plane.visibility = 0.1;

    if (this.addHandles) {
      this.createHandles();
    }
  }
  texturesDispose() {
    if ( this.noiseTexture ) {
      this.noiseTexture.dispose();
      this.noiseTexture = null;
    }
    if ( this.texture ) {
      this.texture.dispose();
      this.texture = null;
    }
  }
  fullyVisible() {
    this.material.emissiveColor = new BABYLON.Color3(1,1,1);
    this.plane.visibility = 1;
  }
  loadUrl(url) {
    let texture = new BABYLON.Texture(url, this.scene);
    this.texturesDispose();
    this.material.diffuseTexture = texture;
    this.texture = texture;
    this.fullyVisible();
  }
  loadData(data, name="bufferedTexture") {
    console.log("Loading texture, size "+data.size);
    this.texturesDispose();
    let texture = BABYLON.Texture.LoadFromDataString(name,data,this.scene);
    this.material.diffuseTexture = texture;
    this.texture = texture;
    this.fullyVisible();
  }

  /**
   * Creates manipulation handles. Left and right handle resize, and top and bottom move it.
   */
  createHandles() {
    this.handles = new ManipulationHandles(this.plane, this.size*this.ratio, this.size, this.scene);
    this.handles.material = new BABYLON.StandardMaterial("TextAreaMaterial", this.scene);
    this.handles.material.alpha = 0.75;
    this.handles.material.diffuseColor = new BABYLON.Color3(.2,.2,.3);
    this.handles.canMinimize = this.canMinimize;
    this.handles.show();
  }
  /**
   * Removes manipulation handles.
   */
  removeHandles() {
    if ( this.handles ) {
      this.handles.dispose();
      this.handles = null;
    }
  }
  /** Clean up. */
  dispose() {
    if (this.attachedToHud) {
      VRSPACEUI.hud.removeAttachment(this.plane);
    }
    this.removeHandles();
    this.plane.dispose();
    this.texturesDispose();
    this.material.dispose();
  }

  /**
   * Attach it to the hud. It does not resize automatically, just sets the parent.
   */
  attachToHud() {
    this.group.parent = VRSPACEUI.hud.root;
    this.attachedToCamera = false;
    this.attachedToHud = true;
    VRSPACEUI.hud.addAttachment(this.plane);
    if ( this.handles ) {
      this.handles.handles.forEach( h => VRSPACEUI.hud.addAttachment(h));
    }
  }
  /**
   * Attach it to the camera. It does not resize automatically, just sets the parent.
   * It does not automatically switch to another camera if active camera changes.
   * @param camera currently active camera
   */
  attachToCamera(camera = this.scene.activeCamera) {
    this.group.parent = camera;
    this.attachedToCamera = true;
    this.attachedToHud = false;
    VRSPACEUI.hud.removeAttachment(this.plane);
    if ( this.handles ) {
      this.handles.handles.forEach( h => VRSPACEUI.hud.addAttachment(h));
    }
  }
  /**
   * Detach from whatever attached to, i.e. drop it where you stand.
   */
  detach() {
    this.group.parent = null;
    this.attachedToCamera = false;
    this.attachedToHud = false;
    VRSPACEUI.hud.removeAttachment(this.plane);
    if ( this.handles ) {
      this.handles.handles.forEach( h => VRSPACEUI.hud.addAttachment(h));
    }
  }
}
