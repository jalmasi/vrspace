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
    this.autoResize = true;
    this.visible = false;
    this.noiseTexture = null;
    this.callback = null; // CHECKME - onClick only used in test to start the video
    this.pointerIsDown = false;
  }

  /** Show the area, optionally also creates manipulation handles */  
  show () {
    if ( this.visible ) {
      return;
    }
    this.visible = true;
    this.group.billboardMode = this.billboardMode;
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

    this.areaPlane = BABYLON.MeshBuilder.CreatePlane("ImageAreaPlane", {width:1,height:1}, this.scene);
    this.areaPlane.scaling.x = this.size*this.ratio;
    this.areaPlane.scaling.y = this.size;
    this.areaPlane.parent = this.group;
    this.areaPlane.material = this.material;
    this.areaPlane.visibility = 0.1;

    this.areaPlane.enablePointerMoveEvents = true;
    //this.areaPlane.pointerOverDisableMeshTesting = true; // no effect

    if (this.addHandles) {
      this.createHandles();
    }
    
    this.clickHandler = this.scene.onPointerObservable.add((pointerInfo) => {
      //console.log(pointerInfo.type+" "+pointerInfo.pickInfo.hit+" "+(this.areaPlane == pointerInfo.pickInfo.pickedMesh));
      if ( pointerInfo.type == BABYLON.PointerEventTypes.POINTERDOWN
        && pointerInfo.pickInfo.hit
        && this.areaPlane == pointerInfo.pickInfo.pickedMesh
      ) {
        //console.log("Clicked: x="+x+" y="+y+" coord "+pointerInfo.pickInfo.getTextureCoordinates() );
        let coords = pointerInfo.pickInfo.getTextureCoordinates();
        let y = Math.round(this.height*(1-coords.y));
        let x = Math.round(coords.x*this.width);
        this.click(x,y);
        this.pointerIsDown = true;
      } else if ( pointerInfo.type == BABYLON.PointerEventTypes.POINTERUP && this.pointerIsDown ) {
        this.pointerIsDown = false;
        this.pointerUp();
      } else if ( this.pointerIsDown 
        && pointerInfo.type == BABYLON.PointerEventTypes.POINTERMOVE 
        && pointerInfo.pickInfo.hit
        && this.areaPlane == pointerInfo.pickInfo.pickedMesh
      ) {
        let coords = pointerInfo.pickInfo.getTextureCoordinates();
        let y = Math.round(this.height*(1-coords.y));
        let x = Math.round(coords.x*this.width);
        this.pointerDrag(x,y);
      }
    });
    
  }
  
  /**
   * Internally used while replacing the texture
   * @private
   */
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
  
  /**
   * Internally used after texture is set, sets emissiveColor and visibility
   */
  fullyVisible() {
    this.material.emissiveColor = new BABYLON.Color3(1,1,1);
    this.areaPlane.visibility = 1;
  }
  
  /**
   * Load the texture from the url
   */
  loadUrl(url) {
    let texture = new BABYLON.Texture(url, this.scene);
    this.texturesDispose();
    this.material.diffuseTexture = texture;
    this.texture = texture;
    this.fullyVisible();
    this.resizeArea(texture.getSize().width, texture.getSize().height);
  }

  /**
   * Load texture from the data buffer, e.g. blob
   */
  loadData(data, name="bufferedTexture") {
    console.log("Loading texture, size "+data.size);
    this.texturesDispose();
    let texture = BABYLON.Texture.LoadFromDataString(name,data,this.scene);
    this.material.diffuseTexture = texture;
    this.texture = texture;
    this.fullyVisible();
    this.resizeArea(texture.getSize().width, texture.getSize().height);
  }

  /** Load video texture from the url, and by default also creates and plays the spatial sound. */
  loadVideo(url, playSound=true) {
    let texture = new BABYLON.VideoTexture(null, url, this.scene);
    this.texturesDispose();
    this.material.diffuseTexture = texture;
    this.texture = texture;
    this.fullyVisible();
    console.log("Loaded video "+url+" playing sound: "+playSound);
    if ( playSound ) {
      this.sound = new BABYLON.Sound(
        "videoTextureSound",
        texture.video,
        this.scene, null, {
          //loop: true,
          autoplay: true,
          spatialSound: true,
          //streaming: false,
          distanceModel: "linear",
          maxDistance: 10,
          panningModel: "equalpower" // or "HRTF"
        });
      this.sound.attachToMesh(this.areaPlane);
      this.attachVolumeControl();
    }
    console.log(texture.video.videoWidth+"x"+texture.video.videoHeight);
    // resize the plane
    texture.video.onresize = (event) => {
      this.resizeArea(texture.video.videoWidth,texture.video.videoHeight);
    }
  }
  
  /**
   * Load a MediaStream, and resize the plane
   */
  loadStream(mediaStream) {
    BABYLON.VideoTexture.CreateFromStreamAsync(this.scene, mediaStream).then( (texture) => {
      this.texturesDispose();
      this.texture = texture;
      this.material.diffuseTexture = texture;
      this.material.diffuseTexture.vScale = -1
      this.fullyVisible();
    });

    let mediaTrackSettings = mediaStream.getVideoTracks()[0].getSettings();
    //console.log('Playing video track', mediaTrackSettings);
    /*
    // local:
    frameRate: 30
    height: 2160
    width: 3840
    // remote:
    aspectRatio: 1.7774436090225565
    deviceId: "96a38882-6269-454e-8009-3d3960b343ba"
    frameRate: 30
    height: 1330
    resizeMode: "none"
    width: 2364
    */
    // now resize the area
    this.resizeArea(mediaTrackSettings.width, mediaTrackSettings.height);
  }
  
  /** Internally used to resize the plane once video/image resolution is known */
  resizeArea(width, height) {
    if ( this.autoResize && width && height ) {
      //console.log("ImageArea resizing to "+width+"x"+height);
      this.width = width;
      this.height = height;
      this.ratio = this.width/this.height;
      this.areaPlane.scaling.x = this.size*this.ratio;
      this.areaPlane.scaling.y = this.size;
      if ( this.addHandles ) {
        if ( this.handles ) {
          this.handles.dispose();
        }
        this.createHandles();
      }
    }
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
    this.attachVolumeControl();
  }

  attachVolumeControl() {
    if ( this.handles && this.sound && !this.handles.onMinMax ) {
      this.handles.onMinMax = minimized => {
        console.log("Minimized: "+minimized);
        if ( minimized ) {
          this.sound.setVolume(0,1);
        } else {
          this.sound.setVolume(1,1);
        }
      }
    }
  }

  /** Called on pointer event, passed texture coordinates. Executes callback */
  async click(x,y) {
    if ( this.callback ) {
      this.callback(this,x,y);
    }
  }

  /** Called on pointer event */
  pointerUp() {
  }

  /** Called on pointer event, passed texture coordinates */  
  pointerDrag(x, y) {
  }
  
  /**
   * Set click event handler here
   * @param callback executed on pointer click, passed Control argument
   */
  onClick(callback) {
    this.callback = callback;   
  }

  /** Clean up. */
  dispose() {
    super.dispose();
    if ( this.clickHandler) {
      this.scene.onPointerObservable.remove(this.clickHandler);
    }
    if ( this.sound ) {
      this.sound.dispose();
    }
    this.texturesDispose();
  }

}
