import { TextWriter } from './text-writer.js';
import { EmojiParticleSystem } from './emoji-particle-system.js';
/**
A disc that shows video stream. Until streaming starts, altText is displayed on the cylinder.
It can be extended, and new class provided to WorldManager factory.
*/
export class VideoAvatar {
  /** Whether to display the name above the head, default true 
   * @static*/
  static displayName = true;
  /** Should written/spoken text be displayed above the head, default true 
   * @static*/
  static displayText = true;
  constructor( scene, callback, customOptions ) {
    this.scene = scene;
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
    /** Compatbility with Avatar class */
    this.userHeight = 1.8;
    /** Compatbility with Avatar class */
    this.name = null;
    this.displaying="NONE";
    this.emojiParticleSystem = null;
    this.writer = new TextWriter(this.scene);
    this.writer.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    /** Whether to display the name above the head, defaults to value of static displayName */
    this.displayName = this.constructor.displayName;
    /** Should written/spoken text be displayed above the head, defaults to value of static displayText */
    this.displayText = this.constructor.displayText;
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
 
  /** Compatbility with Avatar class */
  getUrl() {
    return "video";
  }
  
  basePosition() {
    return new BABYLON.Vector3(this.mesh.position.x, this.mesh.position.y-this.radius, this.mesh.position.z);
  }

  baseMesh() {
    return this.mesh;
  }

  headPos() {
    return new BABYLON.Vector3(this.mesh.position.x, this.mesh.position.y+this.radius, this.mesh.position.z);    
  }
 
  /** 
  Set the name and display it above the avatar 
  @param name 
  */
  async setName(name) {
    if ( this.writer && this.displayName ) {
      this.writer.clear(this.baseMesh());
      //this.writer.relativePosition = this.rootMesh.position.add(new BABYLON.Vector3(0,.4+this.height(),0));
      this.writer.relativePosition = new BABYLON.Vector3(0,.4+this.userHeight-this.radius,0);
      this.writer.write(this.baseMesh(), name);
    }
    this.name = name;
  }

  /** Remote event routed by WorldManager, displays whatever user wrote above avatar's head*/  
  async wrote(client) {
    if ( this.writer && this.displayText ) {
      var limit = 20;
      var text = [this.name];
      var line = '';
      client.wrote.split(' ').forEach((word) => {
        if ( line.length + word.length > limit ) {
          text.push(line);
          line = '';
        }
        line += word + ' ';
      });
      text.push(line);

      this.writer.clear(this.baseMesh());
      // height() uses headPos that isn't safe to use at all times
      // rootMesh position changes with animation fixes etc
      //this.writer.relativePosition = this.rootMesh.position.add(new BABYLON.Vector3(0,.4+this.height()+.2*(text.length-1),0));
      this.writer.relativePosition = new BABYLON.Vector3(0,.4+this.userHeight+.2*(text.length-1)-this.radius,0);
      this.writer.writeArray(this.baseMesh(), text);
    }
  }
  
  /** Remote emoji event routed by WorldManager */  
  async emoji(client) {
    let url = client.emoji;
    console.log("Remote emoji: "+url);
    if ( url == null ) {
      // cleanup existing particle system
      if (this.emojiParticleSystem) {
        this.emojiParticleSystem.stop();
      }
    } else {
      // start emoji particle system
      if ( ! this.emojiParticleSystem ) {
        this.emojiParticleSystem = new EmojiParticleSystem(this.scene);
      }
      this.emojiParticleSystem.init(url, this, -5).start();
    }
  }
    
}