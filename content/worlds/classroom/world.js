import { World, OpenViduStreams } from '../../../babylon/vrspace-ui.js';

export class Classroom extends World {
  async createCamera() {
    //lecturer view
    //this.camera = this.universalCamera(new BABYLON.Vector3(0, 2, 0));
    //this.camera.setTarget(new BABYLON.Vector3(0,2,10));
    this.camera = this.universalCamera(new BABYLON.Vector3(-6, 2, 16));
    this.camera.setTarget(new BABYLON.Vector3(0,2,0));
  }
  async createLights() {
    var light = new BABYLON.DirectionalLight("light", new BABYLON.Vector3(-1, -1, 0), this.scene);
    light.intensity = 2;
    var light1 = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 1, 0), this.scene);
    return light1;
  }
  async createSkyBox() {
    var skybox = BABYLON.Mesh.CreateBox("skyBox", 10000, this.scene);
    var skyboxMaterial = new BABYLON.StandardMaterial("skyBox", this.scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.disableLighting = true;
    skybox.material = skyboxMaterial;
    skybox.infiniteDistance = true;
    skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("//www.babylonjs.com/assets/skybox/TropicalSunnyDay", this.scene);
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
    return skybox;
  }
  
  createGround() {
    this.ground = BABYLON.MeshBuilder.CreateDisc("ground", {radius:100}, this.scene);
    this.ground.rotation = new BABYLON.Vector3( Math.PI/2, 0, 0 );
    this.ground.position = new BABYLON.Vector3( 0, 0.1, 0 );
    this.ground.parent = this.floorGroup;
    this.ground.isVisible = false;
    this.ground.checkCollisions = true;
    return this.ground;
  }
  
  getFloorMeshes() {
    return [this.ground];
  }
  
  isSelectableMesh(mesh) {
    // pPlane5_pantalla_0 - board
    // pCube30_blanco_0 - lecturer desk front
    return mesh === this.screenShareMesh;
  }

  setMeshCollisions(mesh, state) {
    //mesh.checkCollisions = state; // no collisions ever    
  }
  
  loaded(file, mesh) {
    //super.loaded(file, mesh); // FIXME: calling initXR() twice
    mesh.scaling = new BABYLON.Vector3(0.3,0.3,0.3);
    
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
  
  entered( welcome ) {

    this.screenShareMesh = BABYLON.MeshBuilder.CreatePlane('shareScreen', {width:1, height:.5}, this.scene);
    this.screenShareMesh.position = new BABYLON.Vector3(-0.04, 1, 1.2);
    this.screenShareMesh.rotation = new BABYLON.Vector3(0, Math.PI, 0);
    this.screenShareMesh.material = new BABYLON.StandardMaterial('shareScreen', this.scene);;
    this.screenShareMesh.material.emissiveColor = BABYLON.Color3.White();
    this.screenShareMesh.material.diffuseTexture = new BABYLON.DynamicTexture("screenShareTexture", {width:128, height:64}, this.scene);
    this.writeText('Share screen');

    // HD resolution 16:9
    this.videoMesh = BABYLON.MeshBuilder.CreatePlane('videoScreen', {width:16/3, height:9/3}, this.scene);
    this.videoMesh.position = new BABYLON.Vector3(0, 3, -.4);
    this.videoMesh.rotation = new BABYLON.Vector3(0, Math.PI, 0);
    this.videoMesh.material = new BABYLON.StandardMaterial('video', this.scene);
    this.videoMesh.material.emissiveColor = BABYLON.Color3.White();
    this.videoMesh.setEnabled(false);
    
    if ( ! this.worldManager.mediaStreams ) {
      this.worldManager.mediaStreams = new OpenViduStreams(this.scene, 'videos');
      this.worldManager.pubSub(welcome.client, false); // audio only
    }
    this.worldManager.mediaStreams.playStream = ( client, mediaStream ) => {
      console.log('mapping incoming screen share of '+client.id);
      if ( this.screenShare && client.id == this.screenShare.properties.clientId ) {
        BABYLON.VideoTexture.CreateFromStreamAsync(this.scene, mediaStream).then( (texture) => {
          if ( this.videoMesh.material.diffuseTexture ) {
             this.videoMesh.material.diffuseTexture.dispose();
          }
          this.videoMesh.material.diffuseTexture = texture;
          this.videoMesh.material.diffuseTexture.vScale = -1
          this.videoMesh.setEnabled(true);
        });
      }
    }
    this.worldManager.debug = true;

    this.scene.onPointerPick = (e,p) => {
      console.log("Picked ", p.pickedMesh.name);
      
      if ( p.pickedMesh.name === this.screenShareMesh.name) {
        if ( ! this.screenShare ) {
          console.log('start sharing screen');
          this.worldManager.VRSPACE.createSharedObject({
            properties:{ screenName:'teacher', clientId: welcome.client.id },
            active:true
          }, (obj)=>{
            console.log("Created new VRObject", obj);
            this.worldManager.mediaStreams.shareScreen();
          });
        } else {
          console.log('stop sharing screen');
          this.worldManager.mediaStreams.stopSharingScreen();
          this.worldManager.VRSPACE.deleteSharedObject(this.screenShare);
        }
      }
      
    }

    // this gets triggers whenever any client receives any new VRobject
    this.worldManager.VRSPACE.addSceneListener( (sceneEvent) => {
      console.log(sceneEvent);
      // identify the object
      if ( sceneEvent.added && sceneEvent.added.properties && sceneEvent.added.properties.screenName) {
        // and NOW install event handler
        // (obviously, installing/overriding the handler at class level makes it easier)
        sceneEvent.added.myEventChanged = (o) => {
          console.log("Screen share starting: "+o.myEvent);
        };
        // keep the reference, share the event when touched on
        this.screenShare = sceneEvent.added;
        this.writeText('Sharing: '+sceneEvent.added.properties.screenName);
      } else if ( sceneEvent.removed && this.screenShare && sceneEvent.removed.id == this.screenShare.id) {
        console.log("Screen share removed");
        this.screenShare = null;
        this.videoMesh.setEnabled(false);
        this.writeText('Share screen');
      }
      
    });
    
  }
}

export const WORLD = new Classroom();