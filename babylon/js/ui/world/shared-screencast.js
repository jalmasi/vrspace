import { Screencast } from "./screencast.js";

/**
Simple screen sharing component that allows anybody to share their screen in the fixed place in the world,
but only one person can share the screen at the same time.
Creates a plane (screenShareMesh) to start/stop sharing.
Properties of created meshes (position etc) are safe to be changed after creation.
Utilizies base Screencast class for state management, receiving side is implemented by RemoteScreen.
*/
export class SharedScreencast extends Screencast {
  /**
   * Creates but hides meshes.
   * 
   * @param world the world
   * @param name screen share name, displayed when sharing. Defaults to user name or id.
   */
  constructor(world, name) {
    super(world, name);

    /** Create manipulation handles? Default false */
    this.addHandles = false;

    this.isSharing = false;
        
    this.screenShareMesh = BABYLON.MeshBuilder.CreatePlane('screencast-button', {width:1, height:.5}, this.scene);
    this.screenShareMesh.position = new BABYLON.Vector3(0, 1, 0);
    this.screenShareMesh.rotation = new BABYLON.Vector3(0, Math.PI, 0);
    this.screenShareMesh.material = new BABYLON.StandardMaterial('shareScreen', this.scene);
    this.screenShareMesh.material.emissiveColor = BABYLON.Color3.White();
    this.screenShareMesh.material.backFaceCulling = false;
    this.screenShareMesh.material.diffuseTexture = new BABYLON.DynamicTexture("screenShareTexture", {width:128, height:64}, this.scene);
    this.writeText(this.text);
    this.screenShareMesh.setEnabled(false);
  }

  /**
   * Sets up pointer event listener to call startSharing/stopSharing */  
  init() {
    super.init();
    this.screenShareMesh.setEnabled(true);
    this.world.worldManager.mediaStreams.addStreamListener(this.client.id, mediaStream => this.streamPlaying(mediaStream));
    
    this.scene.onPointerPick = (e,p) => {
      console.log("Picked ", p.pickedMesh.name);
      
      if ( p.pickedMesh.name === this.screenShareMesh.name) {
        if ( ! this.screenShare && ! this.isSharing ) {
          console.log('start sharing screen');
          this.startSharing();
        } else if (this.screenShare && this.isSharing) {
          console.log('stop sharing screen');
          this.stopSharing();
        }
      }
    }
  }
  
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

  sharing(state) {
    super.sharing(state);
    this.isSharing = state;
    if ( state ) {
      this.writeText('Sharing: '+vrObject.properties.screenName);
    } else {
      this.writeText(this.text);
    }
  }
  
  dispose() {
    super.dispose();
    this.screenShareMesh.dispose();
  }
}