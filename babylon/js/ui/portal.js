import {VRSPACEUI} from './vrspace-ui.js';

/**
Portal is an entrance to other worlds, disabled by default.
 */
export class Portal {
  /** Create a portal
  @param scene babylonjs scene
  @param serverFolder containing world class and content
  @param callback to execute when portal is activated (clicked, tapped)
  @param shadowGenerator optionally, portal can cast shadows
   */
  constructor( scene, serverFolder, callback, shadowGenerator ) {
    this.scene = scene;
    this.serverFolder = serverFolder;
    this.callback = callback;
    this.name = serverFolder.name;
    this.subTitle = null;
    if ( serverFolder.relatedUrl() ) {
      this.thumbnail = new BABYLON.Texture(serverFolder.relatedUrl());
    }
    this.shadowGenerator = shadowGenerator;
    this.isEnabled = false;
    // used in dispose:
    this.controls = [];
    this.textures = [];
    this.materials = [];
  }
  /** handy, returns base url and folder name */
  worldUrl() {
    return this.serverFolder.baseUrl+this.serverFolder.name;
  }
  /** dispose of everything */
  dispose() {
    this.group.dispose();
    if (this.thumbnail) {
      this.thumbnail.dispose();
    }
    this.material.dispose();
    for ( var i = 0; i < this.controls.length; i++ ) {
      // CHECKME doesn's seem required
      this.controls[i].dispose();
    }
    for ( var i = 0; i < this.textures.length; i++ ) {
      this.textures[i].dispose();
    }
    for ( var i = 0; i < this.materials.length; i++ ) {
      this.materials[i].dispose();
    }
  }
  /** Load and display portal at given coordinates. Copies existing portal mesh to new coordinates and angle.
  @param x
  @param y
  @param z
  @param angle
   */
  async loadAt(x,y,z,angle) {
    this.group = new BABYLON.TransformNode('Portal:'+this.name);
    this.group.position = new BABYLON.Vector3(x,y,z);
    this.group.rotationQuaternion = new BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y,angle);

    if (this.shadowGenerator) {
      var clone = VRSPACEUI.portal.clone();
      clone.parent = this.group;
      var meshes = clone.getChildMeshes();
      for ( var i = 0; i < meshes.length; i++ ) {
        this.shadowGenerator.getShadowMap().renderList.push(meshes[i]);
      }
    } else {
      VRSPACEUI.copyMesh(VRSPACEUI.portal, this.group);
    }

    var plane = BABYLON.Mesh.CreatePlane("PortalEntrance:"+this.name, 1.60, this.scene);
    plane.parent = this.group;
    plane.position = new BABYLON.Vector3(0,1.32,0);
    var observable = (e) => {
      if(e.type == BABYLON.PointerEventTypes.POINTERDOWN){
        var p = e.pickInfo;
        if ( p.pickedMesh == plane ) {
          if ( this.isEnabled ) {
            console.log("Entering "+this.name);
            this.scene.onPointerObservable.clear();
            this.enter();
          } else {
            console.log("Not entering "+this.name+" - disabled");
          }
        }
      }
    };
    this.scene.onPointerObservable.add(observable);

    this.material = new BABYLON.StandardMaterial(this.name+"-noise", this.scene);
    plane.material = this.material;

    this.material.disableLighting = true;
    this.material.backFaceCulling = false;
    var noiseTexture = new BABYLON.NoiseProceduralTexture(this.name+"-perlin", 256, this.scene);
    this.material.lightmapTexture = noiseTexture;
    noiseTexture.octaves = 4;
    noiseTexture.persistence = 1.2;
    noiseTexture.animationSpeedFactor = 2;
    plane.visibility = 0.85;
    this.textures.push( noiseTexture );

    this.title = BABYLON.MeshBuilder.CreatePlane("Text:"+this.name, {height:1,width:2}, this.scene);
    this.title.parent = this.group;
    this.title.position = new BABYLON.Vector3(0,2.5,0);
    this.title.isVisible = false;

    var titleTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(this.title, 128,128);
    this.materials.push(this.title.material);
    
    this.titleText = new BABYLON.GUI.TextBlock();
    this.titleText.color = "white";
    this.showTitle();

    titleTexture.addControl(this.titleText);
    //this.controls.push(titleText); // CHECKME doesn's seem required
    this.textures.push(titleTexture);
    
    return this;
  }
  showTitle() {
    if ( this.titleText ) {
      if ( this.subTitle) {
        this.titleText.text = this.name.toUpperCase()+'\n'+this.subTitle;
      } else {
        this.titleText.text = this.name;
      }
    }
  }
  setTitle(title) {
    this.subTitle = title;
    this.showTitle();
  }
  getTitle() {
    return this.subTitle;
  }
  /** Enables or disables the portal
  @param enable
   */
  enabled(enable) {
    if ( enable ) {
      this.material.emissiveTexture = this.thumbnail;
    } else {
      this.material.emissiveTexture = null;
    }
    this.title.isVisible = enable;
    this.isEnabled = enable;
  }
  /** Executes callback on entry */
  enter() {
    if ( this.callback ) {
      this.callback(this);
    }
  }
}

