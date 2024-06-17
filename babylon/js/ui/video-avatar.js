import { Avatar } from './avatar.js';
/**
A disc that shows video stream. Until streaming starts, altText is displayed on the cylinder.
It can be extended, and new class provided to WorldManager factory.
*/
export class VideoAvatar extends Avatar {
  constructor( scene, callback, customOptions ) {
    super(scene);
    this.video = true;
    this.callback = callback;
    this.deviceId = null;
    this.radius = 1;
    this.altText = "N/A";
    this.altImage = null;
    this.textStyle = "bold 64px monospace";
    this.textColor = "black";
    this.backColor = "white";
    this.maxWidth = 640;
    this.maxHeight = 640;
    /** Should show() start video? */
    this.autoStart = true;
    /** Should own video avatar be attached to hud? */
    this.autoAttach = true;
    this.attached = false;
    this.displaying="NONE";
    if ( customOptions ) {
      for(var c of Object.keys(customOptions)) {
        this[c] = customOptions[c];
      }
    }
  }
  /**
  Show the avatar. Used for both own and remote avatars.
   */
  async show() {
    if ( ! this.mesh ) {
      if ( this.autoAttach ) {
        this.cameraTracker = () => this.cameraChanged();
      }
      this.mesh = BABYLON.MeshBuilder.CreateDisc("VideoAvatar", {radius:this.radius}, this.scene);
      //mesh.visibility = 0.95;
      this.mesh.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
      this.mesh.position = new BABYLON.Vector3( 0, this.radius, 0);
      this.mesh.material = new BABYLON.StandardMaterial("WebCamMat", this.scene);
      this.mesh.material.emissiveColor = new BABYLON.Color3.White();
      this.mesh.material.specularColor = new BABYLON.Color3.Black();
 
      // used for collision detection (3rd person view)
      this.mesh.ellipsoid = new BABYLON.Vector3(this.radius, this.radius, this.radius);

      // glow layer may make the texture invisible, needd to turn of glow for the mesh
      if ( this.scene.effectLayers ) {
        this.scene.effectLayers.forEach( (layer) => {
          if ( 'GlowLayer' === layer.getClassName() ) {
            layer.addExcludedMesh(this.mesh);
          }
        });
      }     
      // display alt text before video texture loads:
      this.displayAlt();
    
      if ( this.autoStart ) {
        await this.displayVideo();
      }
    }
  }

  /** dispose of everything */  
  dispose() {
    if ( this.mesh.parent ) {
      this.mesh.parent.dispose();
    }
    if ( this.mesh.material ) {
      if ( this.mesh.material.diffuseTexture ) {
        this.mesh.material.diffuseTexture.dispose();
      }
      this.mesh.material.dispose();
    }
    if ( this.mesh ) {
      this.mesh.dispose();
      delete this.mesh;
    }
  }
  
  /**
  Display and optionally set altText.
   */
  displayAltText(text) {
    this.displaying="TEXT";
    if ( text ) {
      this.altText = text;
    }
    if ( this.mesh.material.diffuseTexture ) {
       this.mesh.material.diffuseTexture.dispose();
    }
    this.mesh.material.diffuseTexture = new BABYLON.DynamicTexture("WebCamTexture", {width:128, height:128}, this.scene);
    this.mesh.material.diffuseTexture.drawText(this.altText, null, null, this.textStyle, this.textColor, this.backColor, false, true);    
  }
  
  /**
  Display and optionally set altImage
  @param image path to the image file
   */
  displayImage(image) {
    this.displaying="IMAGE";
    if ( image ) {
      this.altImage = image;
    }
    if ( this.mesh.material.diffuseTexture ) {
       this.mesh.material.diffuseTexture.dispose();
    }
    this.mesh.material.diffuseTexture = new BABYLON.Texture(this.altImage, this.scene, null, false);    
  }
  
  /** Displays altImage if available, altText otherwise  */
  displayAlt() {
    if ( this.altImage ) {
      this.displayImage();
    } else {
      this.displayAltText();
    }
  }

  /** 
  Display video from given device, used for own avatar.
   */
  async displayVideo( deviceId ) {
    if ( this.displaying === "VIDEO" ) {
      return;
    }
    if ( deviceId ) {
      this.deviceId = deviceId;
    }
    if ( ! this.deviceId ) {
      try {
        // prompts for permission to use camera
        await navigator.mediaDevices.getUserMedia({video:true});
      } catch(err) {
        console.log("User permission denied ", err);
        return;
      }
      var devices = await navigator.mediaDevices.enumerateDevices();
      for (var idx = 0; idx < devices.length; ++idx) {
        if (devices[idx].kind === "videoinput") {
          console.log(devices[idx]);
          this.deviceId = devices[idx].deviceId;
          break;
        }
      }
    }
    if ( this.deviceId ) {
      BABYLON.VideoTexture.CreateFromWebCamAsync(this.scene, { maxWidth: this.maxWidth, maxHeight: this.maxHeight, deviceId: this.deviceId }).then( (texture) => {
        if ( this.mesh.material.diffuseTexture ) {
           this.mesh.material.diffuseTexture.dispose();
        }
        this.mesh.material.diffuseTexture = texture;
        this.displaying="VIDEO";
        if ( this.callback ) {
          this.callback();
        }
      });
    }
  }
  
  /**
  Create and display VideoTexture from given MediaStream.
   */
  displayStream( mediaStream ) {
    if ( mediaStream ) {
      // CHECKME: otherwise error?
      BABYLON.VideoTexture.CreateFromStreamAsync(this.scene, mediaStream).then( (texture) => {
        if ( this.mesh.material.diffuseTexture ) {
           this.mesh.material.diffuseTexture.dispose();
        }
        this.mesh.material.diffuseTexture = texture;
        this.displaying="STREAM";
      });
    }
  }
  
  /**
  Rescale own avatar and attach to current camera at given position
  @param position default 50cm ahead, 15cm right, 15cm below.
   */
  attachToCamera( position ) {
    this.mesh.billboardMode = BABYLON.Mesh.BILLBOARDMODE_NONE;
    this.mesh.parent = this.camera;
    if ( position ) {
      this.mesh.position = position;
    } else {
      this.mesh.position = new BABYLON.Vector3( .15, -.15, .5 );
      var scale = (this.radius/2)/20; // 5cm size
      this.mesh.scaling = new BABYLON.Vector3(scale, scale, scale);
    }
    this.cameraChanged();
    this.attached = true;
    this.scene.onActiveCameraChanged.add( this.cameraTracker );
  }
  
  /** Rescale own avatar and detach from camera */
  detachFromCamera() {
    if ( this.attached ) {
      this.mesh.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;
      this.mesh.position = this.camera.position; // CHECKME: must be the same
      console.log("Mesh position: "+this.mesh.position);
      this.mesh.scaling = new BABYLON.Vector3(1, 1, 1);
      this.scene.onActiveCameraChanged.remove( this.cameraTracker );
      this.mesh.parent = null;
      this.attached = false;
    }
  }
 
  /** Called when active camera changes/avatar attaches to camera */ 
  cameraChanged() {
    if ( this.autoAttach && this.attached ) {
      console.log("Camera changed: "+this.scene.activeCamera.getClassName()+" new position "+this.scene.activeCamera.position);
      if ( this.scene.activeCamera.getClassName() == 'UniversalCamera' ) {
        this.camera = this.scene.activeCamera;
        this.attached = true;
        this.mesh.parent = this.camera;
      }
    }
  }
 
  getUrl() {
    return "video";
  }
  
  basePosition() {
    return new BABYLON.Vector3(this.mesh.position.x, this.mesh.position.y-this.radius, this.mesh.position.z);
  }

  topPositionRelative() {
    return new BABYLON.Vector3(0, this.userHeight-this.radius, 0);
  }
  
  baseMesh() {
    return this.mesh;
  }

  /** Remote emoji event routed by WorldManager. Video avatar looks the oposite way, so this just blows the particles to the opposite direction */  
  async emoji(client, direction=3) {
    super.emoji(client, -direction);
  }
    
}