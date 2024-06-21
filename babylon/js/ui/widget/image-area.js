import { ManipulationHandles } from "./manipulation-handles.js";
import { BaseArea } from './base-area.js';

/**
 * An area somewhere in space, like a screen, displaying a texture.
 */
export class ImageArea extends BaseArea {
  /**
   * Creates the area with default values. 
   * By default, it's sized and positioned to be attached to the camera, and includes manipulation handles
   */
  constructor(scene, name="ImageArea-root") {
    super(scene, name);
    this.position = new BABYLON.Vector3(0, 0, .3);
    this.width = 2048;
    this.height = 1024;
    this.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.text = "";
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

    this.this.areaPlane = BABYLON.MeshBuilder.CreatePlane("ImageAreaPlane", {width:this.size*this.ratio,height:this.size}, this.scene);
    this.areaPlane.parent = this.group;
    this.areaPlane.material = this.material;
    this.areaPlane.visibility = 0.1;

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
    this.areaPlane.visibility = 1;
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
    this.handles = new ManipulationHandles(this.areaPlane, this.size*this.ratio, this.size, this.scene);
    this.handles.material = new BABYLON.StandardMaterial("TextAreaMaterial", this.scene);
    this.handles.material.alpha = 0.75;
    this.handles.material.diffuseColor = new BABYLON.Color3(.2,.2,.3);
    this.handles.canMinimize = this.canMinimize;
    this.handles.show();
  }

  /** Clean up. */
  dispose() {
    super.dispose();
    this.texturesDispose();
  }

}
