import {VRSPACEUI} from '../vrspace-ui.js';

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
    this.alwaysShowTitle = false;
    this.imageUrl = null;
    if ( serverFolder.relatedUrl() ) {
      this.imageUrl = serverFolder.relatedUrl();
      this.thumbnail = new BABYLON.Texture(this.imageUrl);
    }
    this.shadowGenerator = shadowGenerator;
    this.isEnabled = false;
    // used in dispose:
    this.controls = [];
    this.textures = [];
    this.materials = [];
    this.soundUrl = VRSPACEUI.contentBase+"/babylon/portal/couchhero_portal-idle.mp3";
    this.soundDistance = 5;
    this.soundVolume = .5;
    
  }
  /** handy, returns base url and folder name */
  worldUrl() {
    return this.serverFolder.baseUrl+this.serverFolder.name;
  }
  /** dispose of everything */
  dispose() {
    this.playSound(false);
    if (this.sound) {
      this.sound.dispose();
    }
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
    if ( this.pointerTracker ) {
      this.scene.onPointerObservable.remove(this.pointerTracker);
      delete this.pointerTracker;
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
    this.pointerTracker = (e) => {
      if(e.type == BABYLON.PointerEventTypes.POINTERDOWN){
        var p = e.pickInfo;
        if ( p.pickedMesh == plane ) {
          if ( this.isEnabled ) {
            console.log("Entering "+this.name);
            this.enter();
          } else {
            console.log("Not entering "+this.name+" - disabled");
          }
        }
      }
    };
    this.scene.onPointerObservable.add(this.pointerTracker);

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

    this.title = BABYLON.MeshBuilder.CreatePlane("Text:"+this.name, {height:2,width:4}, this.scene);
    this.title.parent = this.group;
    this.title.position = new BABYLON.Vector3(0,2.5,0);
    this.title.isVisible = this.alwaysShowTitle;

    var titleTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(this.title, 256,256);
    this.materials.push(this.title.material);
    
    this.titleText = new BABYLON.GUI.TextBlock();
    this.titleText.color = "white";
    this.showTitle();

    titleTexture.addControl(this.titleText);
    //this.controls.push(titleText); // CHECKME doesn's seem required
    this.textures.push(titleTexture);
    
    this.attachSound();
    
    return this;
  }
  attachSound() {
    if ( this.soundUrl ) {
      this.sound = new BABYLON.Sound(
        "portalSound",
        this.soundUrl,
        this.scene, null, {
          loop: true,
          autoplay: false,
          spatialSound: true,
          streaming: false,
          distanceModel: "linear",
          maxDistance: this.soundDistance, // default 100, used only when linear
          panningModel: "equalpower" // or "HRTF"
        });
      this.sound.attachToMesh(this.group);
      this.sound.setVolume(this.soundVolume);
    }
  }
  playSound(enable) {
    if ( this.sound ) {
      if ( enable ) {
        this.sound.play();
        // chrome hacks
        BABYLON.Engine.audioEngine.audioContext?.resume();
        BABYLON.Engine.audioEngine.setGlobalVolume(1);        
      } else if ( this.sound ) {
        this.sound.stop();
      }
    }
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
    this.title.isVisible = enable || this.alwaysShowTitle;
    this.isEnabled = enable;
    this.playSound(enable);
  }
  /** Executes callback on entry */
  enter() {
    if ( this.callback ) {
      this.callback(this);
    }
  }
}

