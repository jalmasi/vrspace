import { World, OpenViduStreams } from '../../../babylon/js/vrspace-min.js';

export class Classroom extends World {
  constructor() {
    super();
    this.file = null;
    this.worldObjects = {
      "scene.gltf":{
        instances:[
          {
            scale:{x:0.3,y:0.3,z:0.3}
          }
        ]
      },
      "city/scene.gltf":{
        instances:[
          {
            scale:{x:200,y:200,z:200},
            position:{x:100,y:68.7,z:-350},
            rotation:{x:0,y:5.69,z:0}
          }
        ]
      }
    }
  }
  async createCamera() {
    //lecturer view
    //this.camera = this.universalCamera(new BABYLON.Vector3(0, 2, 0));
    //this.camera.setTarget(new BABYLON.Vector3(0,2,10));
    this.camera = this.universalCamera(new BABYLON.Vector3(-6, 2, 16));
    this.camera.setTarget(new BABYLON.Vector3(0,2,0));
    this.camera.speed = .2;
    // collision debug
    //this.camera.onCollide = (mesh)=>console.log('collided with '+mesh.id);
    return this.camera;
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
    this.ground.position = new BABYLON.Vector3( 0, -0.05, 0 );
    this.ground.parent = this.floorGroup;
    this.ground.isVisible = false;
    this.ground.checkCollisions = true;
    return this.ground;
  }
  
  createPhysics() {
    this.scene.gravity = new BABYLON.Vector3(0,-.05,0);
    
    // walls mess with collision detection, easy to get stuck
    // so add two invisible planes just for collision detection
    var wall1 = BABYLON.MeshBuilder.CreatePlane('wall1', {width:18, height:3}, this.scene);
    wall1.position = new BABYLON.Vector3(7.8, 2, 9);
    wall1.rotation = new BABYLON.Vector3(0, Math.PI/2, 0);
    wall1.checkCollisions = true;
    wall1.visibility = 0;

    var wall2 = BABYLON.MeshBuilder.CreatePlane('wall2', {width:14, height:3}, this.scene);
    wall2.position = new BABYLON.Vector3(-7.8, 2, 9);
    wall2.rotation = new BABYLON.Vector3(0, -Math.PI/2, 0);
    wall2.checkCollisions = true;
    wall2.visibility = 0;
  }
  
  isSelectableMesh(mesh) {
    // pPlane5_pantalla_0 - board
    // pCube30_blanco_0 - lecturer desk front
    // pCube78, pCube81 (transform), pCube78_puerta_0, pCube81_puerta_0 - doors
    return mesh === this.screenShareMesh;
  }

  setMeshCollisions(mesh, state) {
    if (
      // doors: 
      mesh.name != 'pCube78_puerta_0' && mesh.name != 'pCube81_puerta_0'
      // fila1-fila6 = rows with tables and chairs
      // (actual meshes are named like pCubeSomething)
      && ! (
        mesh.parent &&
        mesh.parent.parent &&
        mesh.parent.parent.parent &&
        mesh.parent.parent.parent.name.startsWith('fila')
      ) 
    ) {
      mesh.checkCollisions = state;
    }
  }
  
  // executed once the world is loaded
  loaded(file, mesh) {
    
    this.floorMeshes = [
      this.scene.getMeshByID('pCube36_suelo_text_0'),
      this.scene.getMeshByID('pCube49_suelo_text_0'),
      this.scene.getMeshByID('pCube50_suelo_text_0'),
      this.scene.getMeshByID('pCube51_suelo_text_0'),
      this.ground
    ];
    
  }

  // executed once connected to the server and entered the space
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
          this.worldManager.VRSPACE.createSharedObject({
            properties:{ screenName:'teacher', clientId: welcome.client.id },
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
        this.writeText('Share screen');
      }
      
    });
    
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

export const WORLD = new Classroom();