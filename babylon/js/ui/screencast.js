import { OpenViduStreams } from './media-streams.js';

/**
Simple screen sharing component. Creates two planes: 
one (screenShareMesh) to start/stop sharing, 
and the other one (videoMesh) to display the video stream.
Properties of created meshes (position etc) are safe to be changed after creation.
Creates and deletes a server-side object for synchronization.
*/
export class Screencast {
  /**
   * Creates but hides meshes.
   * 
   * @param world the world
   * @param name screen share name, displayed when sharing. Defaults to user name or id.
   */
  constructor(world, name) {
    /** text to display on the share screen button, by default Share screen */
    this.text = 'Share screen';
    this.world = world;
    this.scene = world.scene;
    this.name = name;
    
    this.screenShareMesh = BABYLON.MeshBuilder.CreatePlane('screencast-button', {width:1, height:.5}, this.scene);
    this.screenShareMesh.position = new BABYLON.Vector3(0, 1, 0);
    this.screenShareMesh.rotation = new BABYLON.Vector3(0, Math.PI, 0);
    this.screenShareMesh.material = new BABYLON.StandardMaterial('shareScreen', this.scene);;
    this.screenShareMesh.material.emissiveColor = BABYLON.Color3.White();
    this.screenShareMesh.material.backFaceCulling = false;
    this.screenShareMesh.material.diffuseTexture = new BABYLON.DynamicTexture("screenShareTexture", {width:128, height:64}, this.scene);
    this.writeText(this.text);
    this.screenShareMesh.setEnabled(false);

    // HD resolution 16:9
    this.videoMesh = BABYLON.MeshBuilder.CreatePlane('screencast-videoScreen', {width:16/3, height:9/3}, this.scene);
    this.videoMesh.position = new BABYLON.Vector3(0, 3, 0);
    this.videoMesh.rotation = new BABYLON.Vector3(0, Math.PI, 0);
    this.videoMesh.material = new BABYLON.StandardMaterial('screencast-video', this.scene);
    this.videoMesh.material.emissiveColor = BABYLON.Color3.White();
    this.videoMesh.setEnabled(false);
  }

  /**
  Initialize the sharing component. Requires functional WorldManager attached to the world,
  so is safe to call from World.entered() method, or after it has been called.
   */  
  init() {
    this.worldManager = this.world.worldManager;
    var client = this.worldManager.VRSPACE.me;
    
    this.screenShareMesh.setEnabled(true);
    if ( ! this.worldManager.mediaStreams ) {
      this.worldManager.mediaStreams = new OpenViduStreams(this.scene, 'videos');
      this.worldManager.pubSub(client, false); // audio only
    }
    this.worldManager.mediaStreams.playStream = ( client, mediaStream ) => {
      console.log('mapping incoming screen share of '+client.id+" to ",this.screenShare);
      if ( this.screenShare && client.id == this.screenShare.properties.clientId ) {
        this.showVideo(mediaStream);
      }
    }
    //this.worldManager.debug = true;

    this.scene.onPointerPick = (e,p) => {
      console.log("Picked ", p.pickedMesh.name);
      
      if ( p.pickedMesh.name === this.screenShareMesh.name) {
        if ( ! this.screenShare ) {
          console.log('start sharing screen');
          var screenName = this.name;
          if ( ! screenName ) {
            if ( client.name ) {
              screenName = client.name;
            } else {
              screenName = 'u'+client.id;
            }
          }
          this.worldManager.VRSPACE.createSharedObject({
            properties:{ screenName:screenName, clientId: client.id },
            active:true
          }, (obj)=>{
            console.log("Created new VRObject", obj);
            this.worldManager.mediaStreams.shareScreen(()=>{
              // end callback, executed when user presses browser stop share button
              this.deleteSharedObject();
            }).then((mediaStream)=>{
              console.log("streaming",mediaStream);
              this.showVideo(mediaStream);
            }).catch((e) => {
              console.log('sharing denied', e);
              this.deleteSharedObject();
            });
          });
        } else {
          console.log('stop sharing screen');
          this.worldManager.mediaStreams.stopSharingScreen();
          this.deleteSharedObject();
        }
      }
      
    }

    // this gets triggers whenever any client receives any new VRobject
    this.worldManager.VRSPACE.addSceneListener( (sceneEvent) => {
      console.log(sceneEvent);
      // identify the object
      if ( sceneEvent.added && sceneEvent.added.properties && sceneEvent.added.properties.screenName) {
        // keep the reference, share the event when touched on
        this.screenShare = sceneEvent.added;
        this.writeText('Sharing: '+sceneEvent.added.properties.screenName);
        this.showNoise();
      } else if ( sceneEvent.removed && this.screenShare && sceneEvent.removed.id == this.screenShare.id) {
        console.log("Screen share removed");
        this.screenShare = null;
        this.removeScreen();
        this.writeText(this.text);
      }
      
    });

  }
  
  // internal methods
  writeText( text, where ) {
    if ( ! where ) {
      where = this.screenShareMesh;
    }
    var material = where.material;
    material.diffuseTexture.drawText(text, 
      null, 
      null, 
      'bold 12px monospace', 
      'black', 
      'white', 
      true, 
      true
    );
  }

  showVideo( mediaStream ) {
    BABYLON.VideoTexture.CreateFromStreamAsync(this.scene, mediaStream).then( (texture) => {
      if ( this.videoMesh.material.diffuseTexture ) {
         this.videoMesh.material.diffuseTexture.dispose();
      }
      this.videoMesh.material.diffuseTexture = texture;
      this.videoMesh.material.diffuseTexture.vScale = -1
      this.videoMesh.setEnabled(true);
    });
  }
  
  showNoise() {
    if ( this.videoMesh.material.diffuseTexture ) {
       this.videoMesh.material.diffuseTexture.dispose();
    }
    var noiseTexture = new BABYLON.NoiseProceduralTexture(this.name+"-perlin", 256, this.scene);
    this.videoMesh.material.diffuseTexture = noiseTexture;
    noiseTexture.octaves = 8;
    noiseTexture.persistence = 2;
    noiseTexture.animationSpeedFactor = 10;
    this.videoMesh.setEnabled(true);
  }
  
  removeScreen() {
    if ( this.videoMesh.material.diffuseTexture ) {
       this.videoMesh.material.diffuseTexture.dispose();
    }
    this.videoMesh.setEnabled(false);    
  }

  deleteSharedObject() {
    if ( this.screenShare ) {
      this.worldManager.VRSPACE.deleteSharedObject(this.screenShare);
    }
  }

}